from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# ATENÇÃO AQUI: Troque "SUA_SENHA_NOVA_AQUI" pela senha que você criou.
# Não coloque colchetes [ ], nem aspas, nem espaços. Fica assim: ...postgres:12345678@db...
#SQLALCHEMY_DATABASE_URL = "postgresql://postgres:Pa13be11so.89@db.kryojhxwmlkufzavjmgj.supabase.co:5432/postgres?sslmode=require"
# O seu endereço real vai ser o que você copiou, mas com esses ajustes:
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres.kryojhxwmlkufzavjmgj:Pa13be11so.89@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require"


engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
