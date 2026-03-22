from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Cole a sua URL perfeita aqui (com psycopg2, sua senha e o sslmode no final)
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres.SEU_PROJETO:Pa13be11so.89@SEU_POOLER.pooler.supabase.com:5432/postgres?sslmode=require"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
