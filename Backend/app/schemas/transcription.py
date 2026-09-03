from typing import List, Optional

from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    start: float
    end: float
    japanese: str
    vietnamese: str


class TranscribeResponse(BaseModel):
    segments: List[TranscriptSegment]
    history_id: Optional[int] = None


class VideoHistoryItem(BaseModel):
    id: int
    video_id: str
    video_title: str
    channel_title: str
    thumbnail: str
    segment_count: int
    has_script: bool
    created_at: str


class VideoHistoryPage(BaseModel):
    items: List[VideoHistoryItem]
    total: int
    page: int
    page_size: int
    total_all: int
    total_completed: int


class VideoHistoryDetail(BaseModel):
    id: int
    video_id: str
    video_title: str
    channel_id: str
    channel_title: str
    thumbnail: str
    segments: List[TranscriptSegment]
    created_at: str
