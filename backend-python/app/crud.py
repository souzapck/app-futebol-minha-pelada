from sqlalchemy.orm import Session
import models, schemas

# Jogadores
def get_players(db: Session):
    return db.query(models.Player).all()

def create_player(db: Session, player: schemas.PlayerCreate):
    db_player = models.Player(**player.dict())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player

# Jogos
def get_matches(db: Session):
    return db.query(models.Match).order_by(models.Match.date.desc()).all()

def create_match(db: Session, date: str):
    db_match = models.Match(date=date, start_time="21:00", end_time="22:00")
    db.add(db_match)
    db.commit()
    db.refresh(db_match)
    return db_match

# MatchPlayers
def set_match_player_status(db: Session, match_id: int, player_id: int, status: str):
    mp = (
        db.query(models.MatchPlayer)
        .filter(
            models.MatchPlayer.match_id == match_id,
            models.MatchPlayer.player_id == player_id,
        )
        .first()
    )
    if mp:
        mp.status = status
    else:
        mp = models.MatchPlayer(
            match_id=match_id, player_id=player_id, status=status
        )
        db.add(mp)
    db.commit()
    db.refresh(mp)
    return mp

def get_match_players(db: Session, match_id: int):
    # retorna players + status
    from sqlalchemy import select, join
    j = join(models.MatchPlayer, models.Player, models.MatchPlayer.player_id == models.Player.id)
    stmt = select(models.Player, models.MatchPlayer.status).select_from(j).where(
        models.MatchPlayer.match_id == match_id
    )
    return db.execute(stmt).all()

def get_confirmed_players(db: Session, match_id: int):
    from sqlalchemy import select, join
    j = join(models.MatchPlayer, models.Player, models.MatchPlayer.player_id == models.Player.id)
    stmt = select(models.Player).select_from(j).where(
        models.MatchPlayer.match_id == match_id,
        models.MatchPlayer.status == "confirmado",
    )
    return [row[0] for row in db.execute(stmt).all()]
