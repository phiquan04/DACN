from typing import List, Optional

from pydantic import BaseModel

from app.schemas.jlpt import JlptLevel

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
    re-categorize) — separate from editing its words."""
    set_name: Optional[str] = None
    description: Optional[str] = None
    curriculum_id: Optional[int] = None
    category_id: Optional[int] = None


class VocabularySetSummary(BaseModel):
    id: int
    level: JlptLevel
    set_name: str
    description: Optional[str] = None
    status: str
    curriculum_id: Optional[int] = None
    curriculum_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    source_filename: Optional[str] = None
    error_message: Optional[str] = None
    item_count: int = 0
    reviewed_count: int = 0


class VocabularySetReviewOut(VocabularySetSummary):
    items: List[VocabularyItemOut] = []
    ready_to_publish: bool = False
