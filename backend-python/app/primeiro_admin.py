import psycopg2

print("🌟 Reset + Patrick Admin...")

conn = psycopg2.connect(
    host="db.kryojhxwmlkufzavjmgj.supabase.co",
    database="postgres",
    user="postgres",
    password="Pa13be11so.89",
    port="5432"
)
cursor = conn.cursor()

# ZERA TUDO
cursor.execute("DELETE FROM match_players;")
cursor.execute("DELETE FROM matches;")
cursor.execute("DELETE FROM users;")
cursor.execute("DELETE FROM players;")

# Patrick Admin SIMPLES
cursor.execute("""
    INSERT INTO players (name, position, rating, shirt_number, phone)
    VALUES ('Patrick', 'MEI', 3.5, 20, '48999708632') RETURNING id;
""")
player_id = cursor.fetchone()[0]

cursor.execute("""
    INSERT INTO users (phone, password, is_admin, player_id)
    VALUES ('48999708632', '8632', true, %s);
""", (player_id,))

conn.commit()
cursor.close()
conn.close()

print("✅ Patrick Admin criado! Login: 48999708632 / 8632")
