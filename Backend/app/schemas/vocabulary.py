from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel

from app.schemas.jlpt import JlptLevel

ReviewRating = Literal['again', 'hard', 'good', 'easy']

# --- Lookup tables: curriculum (bộ giáo trình) & category (danh mục nội dung) ---


class CurriculumIn(BaseModel):
    name: str
    description: Optional[str] = None


class CurriculumPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CurriculumOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    set_count: int = 0


class CategoryIn(BaseModel):
    name: str


class CategoryPatch(BaseModel):
    name: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    set_count: int = 0


# --- Import ---


class ImportVocabularySetResponse(BaseModel):
    set_id: int
    set_name: str
    level: str
    status: str
    item_count: int
    ai_generated_count: int = 0  # số từ có ít nhất 1 trường (nghĩa/câu ví dụ) do AI tự sinh
    skipped_count: int = 0  # số mục AI trả về nhưng thiếu word/meaning_vi nên bị bỏ qua
    failed_batch_count: int = 0  # số batch (nhóm trang) AI xử lý lỗi, các từ trong đó bị mất hoàn toàn


# --- Review: vocabulary items ---


class VocabularyItemCreate(BaseModel):
    """A word the admin adds by hand during review — for a word the AI missed
    entirely when parsing the import."""
    word: str
    reading: Optional[str] = None
    han_viet: Optional[str] = None
    meaning_vi: str
    word_type: Optional[str] = None
    example_sentence_ja: Optional[str] = None
    example_sentence_vi: Optional[str] = None
    admin_notes: Optional[str] = None


class VocabularyItemPatch(BaseModel):
    """Partial update for one word during admin review — only fields actually
    present in the request body are applied."""
    word: Optional[str] = None
    reading: Optional[str] = None
    han_viet: Optional[str] = None
    meaning_vi: Optional[str] = None
    word_type: Optional[str] = None
    example_sentence_ja: Optional[str] = None
    example_sentence_vi: Optional[str] = None
    admin_notes: Optional[str] = None
    is_reviewed: Optional[bool] = None


class VocabularyItemOut(BaseModel):
    id: int
    order_no: int
    word: str
    reading: Optional[str] = None
    han_viet: Optional[str] = None
    meaning_vi: str
    word_type: Optional[str] = None
    example_sentence_ja: Optional[str] = None
    example_sentence_vi: Optional[str] = None
    admin_notes: Optional[str] = None
    is_meaning_ai_generated: bool = False
    is_example_ai_generated: bool = False
    is_reviewed: bool = False


# --- Review: vocabulary sets ---


class VocabularySetPatch(BaseModel):
    """Partial update for the set's own metadata (rename, re-describe,
    re-categorize, lock/unlock) — separate from editing its words."""
    set_name: Optional[str] = None
    description: Optional[str] = None
    curriculum_id: Optional[int] = None
    category_id: Optional[int] = None
    is_locked: Optional[bool] = None


class VocabularySetSummary(BaseModel):
    id: int
    level: JlptLevel
    set_name: str
    description: Optional[str] = None
    status: str
    is_locked: bool = False
    curriculum_id: Optional[int] = None
    curriculum_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    source_filename: Optional[str] = None
    error_message: Optional[str] = None
    item_count: int = 0
    reviewed_count: int = 0
    created_at: datetime
    updated_at: datetime


class VocabularySetReviewOut(VocabularySetSummary):
    items: List[VocabularyItemOut] = []
    ready_to_publish: bool = False


# --- User-facing learning: library, flashcard sessions, SRS review, streaks ---


class VocabularyLearningItemOut(BaseModel):
    id: int
    order_no: int
    word: str
    reading: Optional[str] = None
    han_viet: Optional[str] = None
    meaning_vi: str
    word_type: Optional[str] = None
    example_sentence_ja: Optional[str] = None
    example_sentence_vi: Optional[str] = None
    status: str = 'new'  # 'new' | 'reviewing' | 'learned'
    is_bookmarked: bool = False
    due_at: Optional[datetime] = None


class VocabularySetProgressOut(BaseModel):
    id: int
    level: JlptLevel
    set_name: str
    description: Optional[str] = None
    curriculum_id: Optional[int] = None
    curriculum_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    item_count: int = 0
    learned_count: int = 0
    reviewing_count: int = 0
    new_count: int = 0


class VocabularySetLearningDetailOut(VocabularySetProgressOut):
    items: List[VocabularyLearningItemOut] = []


class StudyBatchRequest(BaseModel):
    """source='sequential' pulls the next untouched words in order_no order
    (so 'study the next 10' naturally continues where the user left off,
    with no offset to track); source='review' pulls words currently due,
    soonest-due first."""
    source: Literal['sequential', 'review']
    count: int = 10


class CrossSetBatchRequest(BaseModel):
    count: int = 10


class ReviewSubmitRequest(BaseModel):
    rating: ReviewRating


class ReviewSubmitResponse(BaseModel):
    item_id: int
    status: str
    due_at: Optional[datetime] = None
    xp_gained: int = 0
    leveled_up: bool = False
    new_level: int = 1


class BookmarkToggleResponse(BaseModel):
    item_id: int
    is_bookmarked: bool


class HeatmapDayOut(BaseModel):
    date: str  # ISO date (YYYY-MM-DD)
    count: int


class StudyOverviewOut(BaseModel):
    streak_days: int = 0
    due_today_count: int = 0
    studied_today_count: int = 0
    daily_goal: int = 20
    heatmap: List[HeatmapDayOut] = []
    xp: int = 0
    level: int = 1
    level_xp_floor: int = 0  # total XP at which the current level started
    level_xp_ceil: int = 100  # total XP needed to reach the next level


class UpdateDailyGoalRequest(BaseModel):
    daily_goal: int


class AchievementOut(BaseModel):
    code: str
    name: str
    description: str
    earned: bool
    progress_current: int
    progress_target: int


class MiniStoryRequest(BaseModel):
    item_ids: List[int]


class MiniStoryResponse(BaseModel):
    story_ja: str
    story_vi: str


# --- User-facing: "Bộ từ của tôi" — a learner's own private curriculum/sets/words ---


class MySetOut(BaseModel):
    """One 'bài' (lesson) inside a learner's own private curriculum. No
    level — a personal list isn't tied to a JLPT level. learned/reviewing/
    new_count mirror VocabularySetProgressOut, so a private 'bài' card can
    show the same progress bar/stat breakdown as a public set's."""
    id: int
    curriculum_id: int
    set_name: str
    description: Optional[str] = None
    item_count: int = 0
    learned_count: int = 0
    reviewing_count: int = 0
    new_count: int = 0
    created_at: datetime


class MySetIn(BaseModel):
    set_name: str
    description: Optional[str] = None


class MySetPatch(BaseModel):
    set_name: Optional[str] = None
    description: Optional[str] = None


class MySetDetailOut(MySetOut):
    items: List[VocabularyItemOut] = []


class MyCurriculumOut(BaseModel):
    """The top-level 'bộ từ vựng của tôi' a learner creates for themselves.
    learned/reviewing/new_count mirror VocabularySetProgressOut's fields,
    aggregated across every item in every 'bài' of this curriculum, from the
    same VocabularyItemProgress rows the public library uses."""
    id: int
    name: str
    description: Optional[str] = None
    item_count: int = 0
    learned_count: int = 0
    reviewing_count: int = 0
    new_count: int = 0
    created_at: datetime
    sets: List[MySetOut] = []


class MyCurriculumIn(BaseModel):
    name: str
    description: Optional[str] = None


class MyCurriculumPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MyItemCreate(BaseModel):
    """A word a learner adds by hand to one of their own 'bài'. Only word +
    meaning are required — when auto_fill is left on, any of
    reading/han_viet/word_type/example left blank gets AI-filled so the
    word still works in every study mode."""
    word: str
    meaning_vi: str
    reading: Optional[str] = None
    han_viet: Optional[str] = None
    word_type: Optional[str] = None
    example_sentence_ja: Optional[str] = None
    example_sentence_vi: Optional[str] = None
    auto_fill: bool = True


class MyItemPatch(BaseModel):
    word: Optional[str] = None
    reading: Optional[str] = None
    han_viet: Optional[str] = None
    meaning_vi: Optional[str] = None
    word_type: Optional[str] = None
    example_sentence_ja: Optional[str] = None
    example_sentence_vi: Optional[str] = None


class CopyItemToMineRequest(BaseModel):
    """Payload for 'Thêm vào bộ của tôi': copies a word from any published
    (public) set into one of the learner's own private 'bài'."""
    item_id: int
    target_set_id: int
