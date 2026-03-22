import psycopg2
import bcrypt

print("🔧 Criando a senha criptografada blindada...")

# 1. Usa o motor moderno puro para gerar a senha "123"
senha_bytes = "123".encode('utf-8')
salt = bcrypt.gensalt()
senha_criptografada = bcrypt.hashpw(senha_bytes, salt).decode('utf-8')

print("🌟 Nova senha gerada com sucesso! Conectando ao banco...")

try:
    # 2. Conecta no banco usando o endereço direto
    conn = psycopg2.connect(
        host="db.kryojhxwmlkufzavjmgj.supabase.co",
        database="postgres",
        user="postgres",
        password="Pa13be11so.89", # Sua senha real
        port="5432"
    )
    cursor = conn.cursor()

    # 3. Injeta a senha criptografada no seu usuário
    cursor.execute("""
        UPDATE users SET password = %s WHERE phone = '48999708632'
    """, (senha_criptografada,))
    
    conn.commit()
    cursor.close()
    conn.close()

    print("✅ SUCESSO ABSOLUTO! A senha do Admin foi atualizada para o formato correto!")
    print("Pode ir no aplicativo agora e entrar com o seu número e a senha 123.")

except Exception as e:
    print("❌ Erro ao conectar no banco:", e)
