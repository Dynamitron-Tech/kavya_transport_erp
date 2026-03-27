# Driver Scoring Schemas
# Transport ERP — Phase C: Driver Scoring Engine

from pydantic import BaseModel
from typing import Optional


class CoachingNoteCreate(BaseModel):
    note_text: str
    category: Optional[str] = None
