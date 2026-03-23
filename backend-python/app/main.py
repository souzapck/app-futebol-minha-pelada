from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import Base, engine, SessionLocal
from . import models, schemas, crud, team_balancer
from sqlalchemy import func
from pydantic import BaseModel

#Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Jogadores

@app.get("/api/players")
def read_players(db: Session = Depends(get_db)):
    # 1. Pega todos os jogadores
    players = db.query(models.Player).all()
    
    # 2. Pega todos os usuários de login
    users = db.query(models.User).all()
    
    # 3. Cria um dicionário rápido para saber quem é admin (ex: { 7: True, 8: False })
    admin_map = {u.player_id: u.is_admin for u in users}
    
    # 4. Mistura os dados: devolve o jogador junto com a informação de admin dele
    result = []
    for p in players:
        p_dict = {
            "id": p.id,
            "name": p.name,
            "position": p.position,
            "rating": p.rating,
            "shirt_number": p.shirt_number,
            "phone": p.phone,
            "is_admin": admin_map.get(p.id, False) # Aqui está o segredo da chave!
        }
        result.append(p_dict)
        
    return result


@app.post("/api/players", response_model=schemas.Player)
def create_player(player: schemas.PlayerCreate, db: Session = Depends(get_db)):
    return crud.create_player(db, player)

@app.put("/api/players/{player_id}", response_model=schemas.Player)
def update_player(player_id: int, player_update: schemas.PlayerCreate, db: Session = Depends(get_db)):
    db_player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not db_player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    
    db_player.name = player_update.name
    db_player.rating = player_update.rating
    db_player.position = player_update.position
    db_player.shirt_number = player_update.shirt_number
    db_player.phone = player_update.phone
    
    db.commit()
    db.refresh(db_player)
    return db_player


# Jogos

@app.get("/api/matches")  # <-- Tirei o response_model
def list_matches(db: Session = Depends(get_db)):
    # Lê todos os jogos direto do banco
    return db.query(models.Match).order_by(models.Match.id.desc()).all()

@app.post("/api/matches")  # <-- Tirei o response_model
async def create_match(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    db_match = models.Match(
        date=data.get("date"),
        is_drawn=False,
        score_a=0,
        score_b=0
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    
    return db_match

# Presenças

@app.post("/api/matches/{match_id}/confirm")
@app.post("/matches/{match_id}/confirm")
async def confirm_player(match_id: int, request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        player_id = data.get("player_id")
        status = data.get("status")
        
        mp = db.query(models.MatchPlayer).filter_by(match_id=match_id, player_id=player_id).first()
        
        if mp:
            mp.status = status
        else:
            mp = models.MatchPlayer(
                match_id=match_id,
                player_id=player_id,
                status=status,
                team=None,
                goals=0
            )
            db.add(mp)
            
        db.commit()
        return {"message": "Presença confirmada"}
        
    except Exception as e:
        # Se algo der errado, isso vai imprimir O MOTIVO REAL no terminal preto do Python!
        print(f"❌ ERRO GRAVE AO SALVAR PRESENÇA: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))




@app.get("/api/matches/{match_id}/players")
def get_match_players(match_id: int, db: Session = Depends(get_db)):
    match_players = db.query(models.MatchPlayer, models.Player)\
                      .join(models.Player, models.MatchPlayer.player_id == models.Player.id)\
                      .filter(models.MatchPlayer.match_id == match_id).all()
    result = []
    for mp, player in match_players:
        result.append({
            "id": player.id,
            "name": player.name,
            "rating": player.rating,
            "position": player.position,
            "shirt_number": player.shirt_number,
            "status": mp.status,
            "team": mp.team,
            "goals": mp.goals
        })
    return result


@app.delete("/api/matches/{match_id}")
def delete_match(match_id: int, db: Session = Depends(get_db)):
    # 1. Busca a partida no banco
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    
    if not match:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    
    # 2. Busca todas as presenças (e GOLS atrelados a ela) para essa partida específica
    # O .delete() aqui limpa os gols, os times sorteados e as confirmações dessa data!
    db.query(models.MatchPlayer).filter(models.MatchPlayer.match_id == match_id).delete()
    
    # 3. Agora sim, exclui a partida raiz da tabela de Matches
    db.delete(match)
    
    # 4. Salva a exclusão geral no banco
    db.commit()
    
    return {"message": "Jogo e todos os gols relacionados foram excluídos com sucesso"}



@app.post("/api/matches/{match_id}/draw")
async def save_draw(match_id: int, request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    
    if data.get("reset"):
        match.is_drawn = False
        match.score_a = 0
        match.score_b = 0
        mps = db.query(models.MatchPlayer).filter_by(match_id=match_id).all()
        for mp in mps:
            mp.team = None
            mp.goals = 0
    else:
        match.is_drawn = True
        for pid in data.get("team_a", []):
            mp = db.query(models.MatchPlayer).filter_by(match_id=match_id, player_id=pid).first()
            if mp: mp.team = "A"
        for pid in data.get("team_b", []):
            mp = db.query(models.MatchPlayer).filter_by(match_id=match_id, player_id=pid).first()
            if mp: mp.team = "B"
            
    db.commit()
    return {"message": "Sorteio processado"}

@app.post("/api/matches/{match_id}/stats")
async def save_stats(match_id: int, request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    match.score_a = data.get("score_a", 0)
    match.score_b = data.get("score_b", 0)
    
    goals = data.get("goals", {})
    for pid_str, goal_count in goals.items():
        mp = db.query(models.MatchPlayer).filter_by(match_id=match_id, player_id=int(pid_str)).first()
        if mp: mp.goals = int(goal_count)
    db.commit()
    return {"message": "Estatísticas salvas"}


# --- RANKING ---

@app.get("/api/ranking")
def get_ranking(db: Session = Depends(get_db)):
    # Busca todos os jogadores
    players = db.query(models.Player).all()
    
    ranking = []
    for p in players:
        # Busca todas as participações DESSE jogador onde o status é 'confirmado' e o jogo foi 'sorteado/jogado'
        # Uma forma simples é buscar os registros na tabela MatchPlayer onde o 'team' não é nulo (só ganha time quem joga)
        participacoes = db.query(models.MatchPlayer)\
                          .filter(models.MatchPlayer.player_id == p.id)\
                          .filter(models.MatchPlayer.team.isnot(None))\
                          .all()
        
        jogos_jogados = len(participacoes)
        
        # Só entra no ranking se jogou pelo menos 1 partida
        if jogos_jogados > 0:
            total_gols = sum(mp.goals or 0 for mp in participacoes)
            media = round(total_gols / jogos_jogados, 2)
            
            ranking.append({
                "id": p.id,
                "name": p.name,
                "position": p.position,
                "shirt_number": p.shirt_number,
                "jogos": jogos_jogados,
                "gols": total_gols,
                "media": media
            })
            
    # Ordena o ranking: 1º por quem tem mais Gols. Se empatar, ganha quem tem maior Média.
    ranking.sort(key=lambda x: (x["gols"], x["media"]), reverse=True)
    return ranking


# --- SISTEMA DE LOGIN E USUÁRIOS ---

# Rota para fazer Login
class LoginRequest(BaseModel):
    phone: str
    password: str

@app.post("/api/login")
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    phone = login_data.phone
    password = login_data.password
    
    # Limpa o telefone caso a pessoa digite espaços ou traços
    phone_limpo = ''.join(filter(str.isdigit, str(phone))) 
    
    user = db.query(models.User).filter(models.User.phone == phone_limpo).first()
    
    if not user or user.password != str(password):
        raise HTTPException(status_code=401, detail="Telefone ou senha incorretos")
        
    # Busca os dados do jogador para enviar pra tela
    player = db.query(models.Player).filter(models.Player.id == user.player_id).first()
    
    return {
        "message": "Login aprovado",
        "user": {
            "player_id": player.id,
            "name": player.name,
            "phone": user.phone,
            "is_admin": user.is_admin
        }
    }

# Rota especial para Sincronizar Jogadores -> Usuários
# Como você já tem jogadores cadastrados, precisamos criar os usuários deles!
@app.get("/api/sync-users")
def sync_users(db: Session = Depends(get_db)):
    players = db.query(models.Player).filter(models.Player.phone.isnot(None)).all()
    atualizados = 0
    criados = 0
    
    for p in players:
        phone_limpo = ''.join(filter(str.isdigit, str(p.phone)))
        if len(phone_limpo) < 10: continue
            
        senha = phone_limpo[-4:]  # Últimos 4 dígitos
        
        user = db.query(models.User).filter(models.User.phone == phone_limpo).first()
        
        if user:
            # ATUALIZA senha/telefone se já existe
            user.password = senha
            user.player_id = p.id
            user.is_admin = "patrick" in p.name.lower()
            atualizados += 1
        else:
            # CRIA novo usuário
            novo_user = models.User(
                phone=phone_limpo,
                password=senha,
                player_id=p.id,
                is_admin="patrick" in p.name.lower()
            )
            db.add(novo_user)
            criados += 1
    
    db.commit()
    return {
        "message": f"{criados} criados + {atualizados} atualizados!",
        "senha_padrao": "últimos 4 dígitos do telefone"
    }



# Criamos um "molde" para receber a nova senha
class PasswordUpdate(BaseModel):
    new_password: str

# ROTA: Trocar a Senha
@app.put("/api/users/{player_id}/password")
def change_password(player_id: int, data: PasswordUpdate, db: Session = Depends(get_db)):
    
    # 1. Tenta achar o usuário de login
    db_user = db.query(models.User).filter(models.User.player_id == player_id).first()
    
    # 2. SE NÃO EXISTIR LOGIN, VAMOS CRIAR NA HORA!
    if not db_user:
        # Busca os dados do jogador para pegar o telefone dele
        player = db.query(models.Player).filter(models.Player.id == player_id).first()
        
        # Se o jogador não tiver telefone, o sistema não consegue criar o login
        if not player or not player.phone:
            raise HTTPException(status_code=400, detail="Este jogador não tem telefone. Edite ele e adicione o WhatsApp primeiro!")
            
        # Cria um novo usuário automaticamente com o telefone do jogador e a senha digitada
        new_user = models.User(
            phone=player.phone, 
            password=data.new_password, 
            is_admin=False, 
            player_id=player.id
        )
        db.add(new_user)
        db.commit()
        return {"message": "Usuário criado e senha definida com sucesso!"}
    
    # 3. SE O USUÁRIO JÁ EXISTIR, APENAS ATUALIZA A SENHA NORMALMENTE
    db_user.password = data.new_password 
    db.commit()
    
    return {"message": "Senha atualizada com sucesso!"}


# ROTA: Dar ou tirar o Administrador
@app.put("/api/users/{player_id}/admin")
def toggle_admin(player_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.player_id == player_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não possui login")
    
    # Inverte o valor atual (Se era True vira False, se era False vira True)
    db_user.is_admin = not db_user.is_admin
    db.commit()
    return {"is_admin": db_user.is_admin}



