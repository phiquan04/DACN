"""Admin import of a grammar PDF. Reuses the PDF/vision OCR pipeline from
app.services.grammar_ocr, then has the AI structure the extracted text into
pattern/meaning/usage_note/example entries — generating a meaning or example
sentence itself (flagged accordingly) when the source PDF doesn't include one.
The AI call is batched a few pages at a time (see grammar_ocr.py) since a
grammar book can list far more grammar points than fit in one LLM response.

The set is saved as 'processing' before the OCR/AI call so a failure still
leaves a visible, retryable record (status='failed' + error_message) instead
of silently vanishing — the admin can inspect it in the sets list and delete
it before re-importing. Mirrors app/routes/vocabulary/imports.py exactly.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.grammar_content import GrammarCategory, GrammarCurriculum, GrammarPoint, GrammarSet
from app.schemas.jlpt import JlptLevel
from app.schemas.grammar_content import ImportGrammarSetResponse
from app.services import grammar_ocr

router = APIRouter(prefix="/sets", tags=["grammar-sets"])


@router.post("/import", response_model=ImportGrammarSetResponse)
def import_grammar_set(
    level: JlptLevel = Form(...),
    set_name: str = Form(...),
    description: Optional[str] = Form(None),
    curriculum_id: Optional[int] = Form(None),
    category_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: UserResponse = Depends(require_admin),
):
    if curriculum_id is not None and not db.query(GrammarCurriculum).filter(
        GrammarCurriculum.id == curriculum_id
    ).first():
        raise HTTPException(status_code=400, detail="Bộ giáo trình không tồn tại")
    if category_id is not None and not db.query(GrammarCategory).filter(
        GrammarCategory.id == category_id
    ).first():
        raise HTTPException(status_code=400, detail="Danh mục không tồn tại")

    grammar_set = GrammarSet(
        curriculum_id=curriculum_id,
        category_id=category_id,
        level=level,
        set_name=set_name,
        description=description,
        status='processing',
        source_filename=file.filename,
        created_by=admin.id,
    )
    db.add(grammar_set)
    db.commit()
    db.refresh(grammar_set)

    try:
        pages = grammar_ocr.extract_pages_from_pdf(file.file.read())
        if not any(p.strip() for p in pages):
            raise ValueError("Không đọc được text từ file PDF")

        parsed = grammar_ocr.parse_grammar_with_ai(pages, level)
        items = parsed.get('items', [])
        failed_batch_count = parsed.get('failed_batch_count', 0)
        if not items:
            raise ValueError("AI không tách được mẫu ngữ pháp nào từ file")

        # The AI has no enforced output schema, so a garbled OCR row can come
        # back with pattern/meaning_vi missing or explicitly null — skip those
        # rather than let the NOT NULL insert below raise uncaught (which would
        # leave the set stuck at 'processing' instead of a retryable 'failed').
        skipped_count = 0
        ai_generated_count = 0
        order_no = 0
        for item in items:
            pattern = (item.get('pattern') or '').strip()
            meaning = (item.get('meaning_vi') or '').strip()
            if not pattern or not meaning:
                skipped_count += 1
                continue

            is_meaning_ai = bool(item.get('is_meaning_ai_generated'))
            is_example_ai = bool(item.get('is_example_ai_generated'))
            if is_meaning_ai or is_example_ai:
                ai_generated_count += 1

            # The AI has no enforced output schema for "examples" either — drop
            # any entry that isn't a dict with at least a non-blank Japanese
            # sentence, same tolerance as the pattern/meaning check above.
            examples = [
                {
                    "japanese": (ex.get('japanese') or '').strip(),
                    "vietnamese": (ex.get('vietnamese') or '').strip(),
                }
                for ex in (item.get('examples') or [])
                if isinstance(ex, dict) and (ex.get('japanese') or '').strip()
            ]

            db.add(GrammarPoint(
                set_id=grammar_set.id,
                order_no=order_no,
                pattern=pattern,
                meaning_vi=meaning,
                usage_note=item.get('usage_note'),
                examples=examples,
                is_meaning_ai_generated=is_meaning_ai,
                is_example_ai_generated=is_example_ai,
                is_reviewed=False,
            ))
            order_no += 1

        if order_no == 0:
            raise ValueError("AI trả về mẫu ngữ pháp nhưng mọi mục đều thiếu mẫu câu hoặc nghĩa, không có gì để lưu")

        grammar_set.status = 'draft'
        grammar_set.item_count = order_no
        db.commit()
        db.refresh(grammar_set)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        grammar_set.status = 'failed'
        grammar_set.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=422, detail=f"Import thất bại: {e}")

    return ImportGrammarSetResponse(
        set_id=grammar_set.id,
        set_name=grammar_set.set_name,
        level=grammar_set.level,
        status=grammar_set.status,
        item_count=grammar_set.item_count,
        ai_generated_count=ai_generated_count,
        skipped_count=skipped_count,
        failed_batch_count=failed_batch_count,
    )
