from sqlalchemy.orm import Session
from app.database import engine, SessionLocal
from app.models import Base, Player
from app.database import Base

# Lista de todos os jogadores
JOGADORES = [
    ("Adamilson", 4.0, "ATA", 6, "48 99920-1398"),
    ("Biano", 3.5, "ZAG", 4, "48 99661-8359"),
    ("Douglas", 4.0, "MEI", 11, "48 99953-5310"),
    ("Douglas Gaucho", 2.0, "MEI", 4, "51 99710-1380"),
    ("Douglas Cunhado", 4.5, "MEI", None, None),
    ("Gauchinho", 2.0, "GOL", None, None),
    ("Hentony", 3.0, "MEI", 10, "48 98455-3623"),
    ("Isaac", 3.5, "MEI", 2, "48 98818-9816"),
    ("Israel", 2.5, "MEI", 79, "48 98433-9723"),
    ("Johny", 2.5, "ZAG", 5, "48 9205-7176"),
    ("Jose", 2.5, "GOL", 12, "48 99211-6714"),
    ("Kiko", 3.5, "GOL", 1, "48 9992-6882"),
    ("Kleiton", 2.5, "ZAG", 9, "48 98429-4941"),
    ("Leandro CRF", 3.0, "ATA", None, "48 99845-7260"),
    ("Maicon", 2.5, "ZAG", 8, "48 99206-2528"),
    ("Marcio", 3.0, "MEI", 17, "48 99101-4803"),
    ("Patrick", 3.5, "MEI", 20, "48 99970-8632"),
    ("Vagner", 3.0, "ATA", 2, "48 99108-8717"),
    ("Rodolfo", 3.0, "ATA", 5, "48 99921-3378"),
    ("Geron", 2.0, "ZAG", 6, "48 98416-1810"),
    ("Convidado 1", 3.0, "MEI", None, None),
    ("Convidado 2", 3.0, "MEI", None, None),
    ("Convidado 3 ", 3.0, "MEI", None, None),
    ("Convidado 4", 3.0, "MEI", None, None),
]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Criar tabelas
Base.metadata.create_all(bind=engine)

# Importar jogadores
db = next(get_db())
print("Importando jogadores...")

for nome, rating, posicao, camisa, celular in JOGADORES:
    player = Player(
        name=nome, 
        rating=rating, 
        position=posicao,
        shirt_number=camisa,
        phone=celular
    )
    db.add(player)
    print(f"✅ Inserido: {nome} | Camisa: {camisa} | Pos: {posicao}")

db.commit()
db.close()

print("\n🎉 Todos os 20 jogadores foram importados!")
print("Rode o backend novamente: uvicorn app.main:app --reload --port 4000")
