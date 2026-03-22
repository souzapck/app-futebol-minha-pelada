import sqlite3
# Troque para o nome real do seu banco
conn = sqlite3.connect("pelada.db") 
cursor = conn.cursor()

cursor.execute("SELECT id, phone FROM users WHERE is_admin = 1 LIMIT 1")
admin = cursor.fetchone()

if admin:
    nova_senha = input("Digite a nova senha: ")
    # AGORA COM A PALAVRA CORRETA: "password"
    cursor.execute("UPDATE users SET password = ? WHERE id = ?", (nova_senha, admin[0]))
    conn.commit()
    print("✅ Senha alterada com sucesso!")
