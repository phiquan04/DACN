from typing import List, Optional

from pydantic import BaseModel


class LookupRequest(BaseModel):
    word: str


class Definition(BaseModel):
    meaning: str
    pos: str
    pos_label: str = ""


class Example(BaseModel):
    japanese: str
    vietnamese: str


class KanjiInfo(BaseModel):
    literal: str
    on_yomi: List[str] = []
    kun_yomi: List[str] = []
    hanviet: List[str] = []
    meaning: str = ""
    stroke_count: Optional[int] = None
    jlpt: Optional[str] = None
    grade: Optional[str] = None


class LookupResponse(BaseModel):
    word: str
    reading: str
    definitions: List[Definition]
    examples: List[Example]
    synonyms: List[str]
    jlpt: str
    frequency: str
    kanji: List[KanjiInfo] = []


class SaveHistoryRequest(BaseModel):
    user_id: int
    word: str
    reading: Optional[str] = ""
    meaning: Optional[str] = ""
    definitions: Optional[List[dict]] = []
    examples: Optional[List[dict]] = []
    synonyms: Optional[List[str]] = []
    jlpt: Optional[str] = ""
    frequency: Optional[str] = ""


class HistoryItem(BaseModel):
    id: int
    word: str
    reading: Optional[str] = ""
    meaning: Optional[str] = ""
    definitions: Optional[List[dict]] = []
    examples: Optional[List[dict]] = []
    synonyms: Optional[List[str]] = []
    jlpt: Optional[str] = ""
    frequency: Optional[str] = ""
    created_at: str


class VietnameseMeaningRequest(BaseModel):
    vietnamese: str


class ReadingRequest(BaseModel):
    text: str


class ImageItem(BaseModel):
    id: int
    image_url: str
    caption: Optional[str] = ""
    uploaded_by: int
    uploader_username: str
    created_at: str


class CommentVoteRequest(BaseModel):
    vote_type: str  # 'up' or 'down'


class CreateCommentRequest(BaseModel):
    word: str
    content: str


class CommentItem(BaseModel):
    id: int
    word: str
    user_id: int
    username: str
    avatar_url: Optional[str] = None
    content: str
    upvotes: int
    downvotes: int
    my_vote: Optional[str] = None
    created_at: str
