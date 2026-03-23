from sqlalchemy import create_engine
print("Conectando Supabase...")
engine = create_engine("postgresql+psycopg2://postgres:Pa13be11so.89@db.kryojhxwmlkufzavjmgj.supabase.co:5432/postgres")
with engine.connect() as conn:
    print("✅ Supabase OK!")
