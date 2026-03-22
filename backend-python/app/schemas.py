from pydantic import BaseModel
from typing import Optional

class PlayerBase(BaseModel):
    name: str
    rating: float
    position: str
    shirt_number: Optional[int] = None
    phone: Optional[str] = None

class PlayerCreate(PlayerBase):
    pass

class Player(PlayerBase):
    id: int

    class Config:
        from_attributes = True

# ... Mantenha o resto das classes de Match e MatchPlayer inalteradas ...
class MatchBase(BaseModel):
    date: str

class MatchCreate(MatchBase):
    pass

class Match(MatchBase):
    id: int
    start_time: str
    end_time: str
    class Config:
        from_attributes = True

class MatchPlayerBase(BaseModel):
    match_id: int
    player_id: int
    status: str

class MatchPlayerCreate(MatchPlayerBase):
    pass

class MatchPlayer(MatchPlayerBase):
    id: int
    class Config:
        from_attributes = True
