from typing import List, Literal, Optional

from pydantic import BaseModel

JlptLevel = Literal['N1', 'N2', 'N3', 'N4', 'N5']
JLPT_LEVELS: tuple = ('N1', 'N2', 'N3', 'N4', 'N5')

SectionType = Literal['kotoba', 'dokkai', 'choukai']


class MondaiTemplateIn(BaseModel):
    mondai_no: int
    name: Optional[str] = None
    description: Optional[str] = None
    tips: Optional[str] = None
    question_count: Optional[int] = None
    time_minutes: Optional[int] = None


class MondaiTemplateOut(MondaiTemplateIn):
    id: int


class SectionIn(BaseModel):
    section_type: SectionType
    name: str
    order_no: int = 0
    time_minutes: Optional[int] = None
    mondai: List[MondaiTemplateIn] = []


class SectionOut(BaseModel):
    id: int
    section_type: SectionType
    name: str
    order_no: int
    time_minutes: Optional[int] = None
    mondai: List[MondaiTemplateOut] = []


class LevelStructureIn(BaseModel):
    total_time_minutes: Optional[int] = None
    notes: Optional[str] = None
    sections: List[SectionIn] = []


class LevelStructureOut(BaseModel):
    id: int
    level: str
    total_time_minutes: Optional[int] = None
    notes: Optional[str] = None
    sections: List[SectionOut] = []


class LevelStructureSummary(BaseModel):
    level: str
    is_configured: bool
    total_time_minutes: Optional[int] = None
    section_count: int = 0
    mondai_count: int = 0
