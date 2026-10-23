from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.jlpt import JlptLevel

# --- Lookup tables: curriculum (bộ giáo trình) & category (danh mục nội dung) ---
# Identical shape to app/schemas/vocabulary.py's CurriculumIn/Patch/Out and
# CategoryIn/Patch/Out — kept as separate classes (rather than reused) so the
# grammar content bank's API surface doesn't silently couple to vocabulary's.


class GrammarCurriculumIn(BaseModel):
    name: str
    description: Optional[str] = None


class GrammarCurriculumPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class GrammarCurriculumOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    set_count: int = 0


class GrammarCategoryIn(BaseModel):
    name: str


class GrammarCategoryPatch(BaseModel):
    name: Optional[str] = None


class GrammarCategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    set_count: int = 0


# --- Import ---


class ImportGrammarSetResponse(BaseModel):
    set_id: int
    set_name: str
    level: str
    status: str
    item_count: int
    ai_generated_count: int = 0  # số mục có ít nhất 1 trường (nghĩa/câu ví dụ) do AI tự sinh
    skipped_count: int = 0  # số mục AI trả về nhưng thiếu pattern/meaning_vi nên bị bỏ qua
    failed_batch_count: int = 0  # số batch (nhóm trang) AI xử lý lỗi, các mục trong đó bị mất hoàn toàn


# --- Review: grammar points ---


class GrammarExample(BaseModel):
    japanese: str
    vietnamese: str = ""


class GrammarPointCreate(BaseModel):
    """A grammar point the admin adds by hand during review — for a point
    the AI missed entirely when parsing the import."""
    pattern: str
    meaning_vi: str
    usage_note: Optional[str] = None
    examples: List[GrammarExample] = []
    admin_notes: Optional[str] = None


class GrammarPointPatch(BaseModel):
    """Partial update for one grammar point during admin review — only
    fields actually present in the request body are applied."""
    pattern: Optional[str] = None
    meaning_vi: Optional[str] = None
    usage_note: Optional[str] = None
    examples: Optional[List[GrammarExample]] = None
    admin_notes: Optional[str] = None
    is_reviewed: Optional[bool] = None


class GrammarPointOut(BaseModel):
    id: int
    order_no: int
    pattern: str
    meaning_vi: str
    usage_note: Optional[str] = None
    examples: List[GrammarExample] = []
    admin_notes: Optional[str] = None
    is_meaning_ai_generated: bool = False
    is_example_ai_generated: bool = False
    is_reviewed: bool = False


# --- Review: grammar sets ---


class GrammarSetPatch(BaseModel):
    """Partial update for the set's own metadata (rename, re-describe,
    re-categorize, lock/unlock) — separate from editing its grammar points."""
    set_name: Optional[str] = None
    description: Optional[str] = None
    curriculum_id: Optional[int] = None
    category_id: Optional[int] = None
    is_locked: Optional[bool] = None


class GrammarSetSummary(BaseModel):
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


class GrammarSetReviewOut(GrammarSetSummary):
    items: List[GrammarPointOut] = []
    ready_to_publish: bool = False


# --- Learner-facing library (read-only, published sets only) ---


class GrammarSetDetailOut(GrammarSetSummary):
    items: List[GrammarPointOut] = []
