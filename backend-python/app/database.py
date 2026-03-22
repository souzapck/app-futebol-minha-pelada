from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# ATENÇÃO AQUI: Troque "SUA_SENHA_NOVA_AQUI" pela senha que você criou.
# Não coloque colchetes [ ], nem aspas, nem espaços. Fica assim: ...postgres:12345678@db...
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:Pa13be11so.89@db.kryojhxwmlkufzavjmgj.supabase.co:5432/postgres"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
