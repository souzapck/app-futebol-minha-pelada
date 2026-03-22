from app.database import SessionLocal
from app.models import Player

def export_to_txt():
    db = SessionLocal()
    players = db.query(Player).all()
    
    with open("jogadores_backup.txt", "w", encoding="utf-8") as f:
        f.write("JOGADORES = [\n")
        for p in players:
            camisa = p.shirt_number if p.shirt_number else "None"
            telefone = f'"{p.phone}"' if p.phone else "None"
            f.write(f'    ("{p.name}", {p.rating}, "{p.position}", {camisa}, {telefone}),\n')
        f.write("]\n")
        
    print(f"✅ {len(players)} jogadores exportados com sucesso!")
    print("Abra o arquivo 'jogadores_backup.txt' para ver os dados.")

if __name__ == "__main__":
    export_to_txt()
