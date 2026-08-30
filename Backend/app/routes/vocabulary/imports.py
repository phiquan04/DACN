"""Admin import of a vocabulary PDF. Reuses the PDF/vision OCR pipeline from
app.services.vocabulary_ocr, then has the AI structure the extracted text
into word/reading/meaning/example entries — generating a meaning or example
sentence itself (flagged accordingly) when the source PDF doesn't include one.
The AI call is batched a few pages at a time (see vocabulary_ocr.py) since a
vocabulary book can list far more words than fit in one LLM response.

The set is saved as 'processing' before the OCR/AI call so a failure still
leaves a visible, retryable record (status='failed' + error_message) instead
of silently vanishing — the admin can inspect it in the sets list and delete
it before re-importing.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.vocabulary import VocabularyCategory, VocabularyCurriculum, VocabularyItem, VocabularySet
from app.schemas.jlpt import JlptLevel
from app.schemas.vocabulary import ImportVocabularySetResponse
from app.services import vocabulary_ocr

router = APIRouter(prefix="/sets", tags=["vocabulary-sets"])


@router.post("/import", response_model=ImportVocabularySetResponse)
def import_vocabulary_set(
    level: JlptLevel = Form(...),
    set_name: str = Form(...),
    description: Optional[str] = Form(None),
    curriculum_id: Optional[int] = Form(None),
    category_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: UserResponse = Depends(require_admin),
):
    if curriculum_id is not None and not db.query(VocabularyCurriculum).filter(
        VocabularyCurriculum.id == curriculum_id
    ).first():
        raise HTTPException(status_code=400, detail="Bộ giáo trình không tồn tại")
    if category_id is not None and not db.query(VocabularyCategory).filter(
        VocabularyCategory.id == category_id
    ).first():
        raise HTTPException(status_code=400, detail="Danh mục không tồn tại")

    vocab_set = VocabularySet(
        curriculum_id=curriculum_id,
        category_id=category_id,
        level=level,
        set_name=set_name,
        description=description,
        status='processing',
        source_filename=file.filename,
        created_by=admin.id,
    )
    db.add(vocab_set)
    db.commit()
    db.refresh(vocab_set)

    try:
        pages = vocabulary_ocr.extract_pages_from_pdf(file.file.read())
        if not any(p.strip() for p in pages):
            raise ValueError("Không đọc được text từ file PDF")

        parsed = vocabulary_ocr.parse_vocabulary_with_ai(pages, level)
        items = parsed.get('items', [])
        failed_batch_count = parsed.get('failed_batch_count', 0)
        if not items:
            raise ValueError("AI không tách được từ vựng nào từ file")

        # The AI has no enforced output schema, so a garbled OCR row can come
        # back with word/meaning_vi missing or explicitly null — skip those
        # rather than let the NOT NULL insert below raise uncaught (which would
        # leave the set stuck at 'processing' instead of a retryable 'failed').
        skipped_count = 0
        ai_generated_count = 0
        order_no = 0
        for item in items:
            word = (item.get('word') or '').strip()
            meaning = (item.get('meaning_vi') or '').strip()
            if not word or not meaning:
                skipped_count += 1
                continue

            is_meaning_ai = bool(item.get('is_meaning_ai_generated'))
            is_example_ai = bool(item.get('is_example_ai_generated'))
            if is_meaning_ai or is_example_ai:
                ai_generated_count += 1
            db.add(VocabularyItem(
                set_id=vocab_set.id,
                order_no=order_no,
                word=word,
                reading=item.get('reading'),
                han_viet=item.get('han_viet'),
                meaning_vi=meaning,
                word_type=item.get('word_type'),
                example_sentence_ja=item.get('example_sentence_ja'),
                example_sentence_vi=item.get('example_sentence_vi'),
                is_meaning_ai_generated=is_meaning_ai,
                is_example_ai_generated=is_example_ai,
                is_reviewed=False,
            ))
            order_no += 1

        if order_no == 0:
            raise ValueError("AI trả về từ vựng nhưng mọi mục đều thiếu từ hoặc nghĩa, không có gì để lưu")

        vocab_set.status = 'draft'
        vocab_set.item_count = order_no
        db.commit()
        db.refresh(vocab_set)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        vocab_set.status = 'failed'
        vocab_set.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=422, detail=f"Import thất bại: {e}")

    return ImportVocabularySetResponse(
        set_id=vocab_set.id,
        set_name=vocab_set.set_name,
        level=vocab_set.level,
        status=vocab_set.status,
        item_count=vocab_set.item_count,
        ai_generated_count=ai_generated_count,
        skipped_count=skipped_count,
        failed_batch_count=failed_batch_count,
    )
