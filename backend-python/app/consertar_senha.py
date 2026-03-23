import psycopg2
import bcrypt

print("🔧 Criando a senha criptografada blindada...")

# 1. Gera a senha "1234" criptografada (padrão bcrypt que o seu app entende)
senha_bytes = "1234".encode('utf-8')
salt = bcrypt.gensalt()
senha_criptografada = bcrypt.hashpw(senha_bytes, salt).decode('utf-8')

print("🌟 Nova senha gerada com sucesso! Conectando ao banco...")

try:
    # 2. Conecta no banco usando o endereço DIRETO (funciona no seu computador)
    conn = psycopg2.connect(
        host="db.kryojhxwmlkufzavjmgj.supabase.co",
        database="postgres",
        user="postgres",
        password="Pa13be11so.89",
        port="5432"
    )
    cursor = conn.cursor()

    # 3. Atualiza o usuário com o NOVO telefone e senha criptografada
    cursor.execute("""
        UPDATE users SET password = %s WHERE phone = '48999708632'
    """, (senha_criptografada,))
    
    conn.commit()
    cursor.close()
    conn.close()

    print("✅ SUCESSO ABSOLUTO! Usuário 48999708632 agora tem senha '1234' criptografada!")
    print("Pode testar o login no app com o novo número e senha 1234.")

except Exception as e:
    print("❌ Erro:", e)
