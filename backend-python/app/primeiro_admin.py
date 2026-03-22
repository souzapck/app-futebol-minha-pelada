import psycopg2

print("🌟 Conectando ao Banco da Nuvem...")

MEU_NOME = "Patrick"
MEU_NUMERO = "48999708632"
MINHA_SENHA = "8632"

try:
    conn = psycopg2.connect(
        host="db.kryojhxwmlkufzavjmgj.supabase.co",
        database="postgres",
        user="postgres",
        password="Pa13be11so.89", 
        port="5432"
    )
    cursor = conn.cursor()
    
    print("🔨 Construindo a tabela de Jogadores...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            position VARCHAR(10),
            rating FLOAT,
            shirt_number INTEGER,
            phone VARCHAR(20)
        );
    """)

    print("🔨 Construindo a tabela de Usuários...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            phone VARCHAR(20),
            password VARCHAR(200),
            is_admin BOOLEAN,
            player_id INTEGER REFERENCES players(id)
        );
    """)
    conn.commit() # Salva as tabelas

    print("👤 Inserindo o Administrador...")
    # 1. Cria o Jogador
    cursor.execute("""
        INSERT INTO players (name, position, rating, shirt_number, phone)
        VALUES (%s, 'MEI', 5.0, 10, %s) RETURNING id;
    """, (MEU_NOME, MEU_NUMERO))
    
    player_id = cursor.fetchone()[0]

    # 2. Cria o Usuário Admin
    cursor.execute("""
        INSERT INTO users (phone, password, is_admin, player_id)
        VALUES (%s, %s, true, %s);
    """, (MEU_NUMERO, MINHA_SENHA, player_id))

    conn.commit()
    cursor.close()
    conn.close()

    print(f"✅ SUCESSO! O banco foi construído e o Admin {MEU_NOME} foi salvo na Nuvem!")
    print("Vá no seu aplicativo oficial (no celular ou Vercel) e faça o login com o seu número e a senha 123.")

except Exception as e:
    print("❌ Erro:", e)
