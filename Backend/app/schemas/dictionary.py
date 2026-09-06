from typing import List, Literal, Optional

from pydantic import BaseModel

ModerationStatus = Literal['pending', 'approved', 'flagged']


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
    kanji: Optional[List[dict]] = []


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
    kanji: Optional[List[dict]] = []
    created_at: str


class VietnameseMeaningRequest(BaseModel):
    vietnamese: str


class HandwritingRecognitionRequest(BaseModel):
    # One list of [x, y] points per stroke, in the order they were drawn.
    strokes: List[List[List[float]]]


class HandwritingRecognitionResponse(BaseModel):
    candidates: List[str]


class ReadingRequest(BaseModel):
    text: str


class TranslateSentenceRequest(BaseModel):
    text: str


class TranslateSentenceResponse(BaseModel):
    translation: str


class ImageItem(BaseModel):
    id: int
    image_url: str
    caption: Optional[str] = ""
    uploaded_by: int
    uploader_username: str
    status: ModerationStatus = 'pending'
    upvotes: int = 0
    downvotes: int = 0
    my_vote: Optional[str] = None
    created_at: str


class ImageVoteRequest(BaseModel):
    vote_type: str  # 'up' or 'down'


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
    status: ModerationStatus = 'pending'
    upvotes: int
    downvotes: int
    my_vote: Optional[str] = None
    created_at: str


# ---------- Admin moderation ----------

class AdminImageItem(BaseModel):
    id: int
    word: str
    image_url: str
    caption: Optional[str] = ""
    status: ModerationStatus
    uploaded_by: int
    uploader_username: str
    upvotes: int
    downvotes: int
    score: int
    created_at: str


class AdminImageListPage(BaseModel):
    items: List[AdminImageItem]
    total: int
    page: int
    page_size: int


class AdminCommentItem(BaseModel):
    id: int
    word: str
    content: str
    status: ModerationStatus
    user_id: int
    username: str
    upvotes: int
    downvotes: int
    score: int
    created_at: str


class AdminCommentListPage(BaseModel):
    items: List[AdminCommentItem]
    total: int
    page: int
    page_size: int


class AdminDictionaryStats(BaseModel):
    total_content: int
    pending_count: int
    today_count: int
    high_downvote_count: int


class UpdateModerationStatusRequest(BaseModel):
    status: ModerationStatus


class BulkApproveRequest(BaseModel):
    # Empty/omitted means "approve every pending item currently in the queue".
    ids: Optional[List[int]] = None


class BulkApproveResponse(BaseModel):
    approved_count: int
