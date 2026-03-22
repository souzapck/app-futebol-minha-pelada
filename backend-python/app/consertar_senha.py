from database import engine, SessionLocal
from core.security import get_password_hash # Isso vai usar o embaralhador oficial do seu app!
from sqlalchemy import text

print("🔧 Consertando a senha do Admin para o formato seguro...")

# Pega o seu embaralhador e gera a versão secreta de "123"
senha_criptografada = get_password_hash("123")

db = SessionLocal()
try:
    # Atualiza o seu usuário (que tem o número 48984553623) para usar a senha nova segura
    sql = text("UPDATE users SET password = :senha WHERE phone = '48984553623'")
    db.execute(sql, {"senha": senha_criptografada})
    db.commit()
    print("✅ Sucesso! Agora a senha está blindada e o app vai aceitar o login!")
except Exception as e:
    print("❌ Erro:", e)
finally:
    db.close()
