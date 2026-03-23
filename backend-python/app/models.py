from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    rating = Column(Float)
    position = Column(String)
    shirt_number = Column(Integer, nullable=True)
    phone = Column(String, nullable=True )#  , unique=True)
    
    #removido pois foi criada a tabela de usuarios
    #is_admin = Column(Boolean, default=False) # Novo campo Admin

# NOVA TABELA DE LOGIN
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True) # Ex: "11999999999"
    password = Column(String) # Ex: "9999" (os 4 últimos)
    player_id = Column(Integer, ForeignKey("players.id"))
    is_admin = Column(Boolean, default=False)

class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, unique=True, index=True)
    is_drawn = Column(Boolean, default=False)
    score_a = Column(Integer, default=0)
    score_b = Column(Integer, default=0)

class MatchPlayer(Base):
    __tablename__ = "match_players"
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    player_id = Column(Integer, ForeignKey("players.id"))
    status = Column(String)
    team = Column(String, nullable=True)
    goals = Column(Integer, default=0)
