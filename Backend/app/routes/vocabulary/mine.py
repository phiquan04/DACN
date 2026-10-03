"""'Bộ từ của tôi': a learner's own private vocabulary — a curriculum they
name themselves, containing 'bài' (VocabularySet) they name themselves, each
holding words they add by hand or copy in from a public set. Reuses the same
VocabularyCurriculum/VocabularySet/VocabularyItem tables as the admin-curated
content (see models/vocabulary.py), just with is_private=True and an
owner (created_by / owner_id) instead of an admin. Every query here is
scoped to the current user — there is no cross-user visibility.

Separate from learning.py (browsing/studying published public sets) and
review.py/imports.py (admin curation) — this is the only module where a
plain user can create/edit/delete a VocabularySet or VocabularyItem.
"""
import json
import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.dependencies import UserResponse, get_current_user
from app.models.database import get_db
from app.models.vocabulary import (
    VocabularyCurriculum, VocabularyItem, VocabularyItemProgress, VocabularyReviewLog, VocabularySet,
)
from app.schemas.vocabulary import (
    CopyItemToMineRequest, MyCurriculumIn, MyCurriculumOut, MyCurriculumPatch,
    MyItemCreate, MyItemPatch, MySetDetailOut, MySetIn, MySetOut, MySetPatch, StudyBatchRequest,
    VocabularyItemOut, VocabularyLearningItemOut,
)
from app.services.chat_ai import call_openrouter, require_api_key

router = APIRouter(prefix="/mine", tags=["vocabulary-mine"])


def _delete_progress_for_items(db: Session, item_ids: list) -> None:
    """A word's SRS progress/review-log rows block a hard delete of the word
    (FK constraint) — harmless to wipe here since a private word is never
    reachable by anyone but its owner, so only their own progress can exist
    for it. Must run before the VocabularyItem delete that cascades from
    deleting its VocabularySet/VocabularyCurriculum."""
    if not item_ids:
        return
    db.query(VocabularyReviewLog).filter(VocabularyReviewLog.item_id.in_(item_ids)).delete(synchronize_session=False)
    db.query(VocabularyItemProgress).filter(VocabularyItemProgress.item_id.in_(item_ids)).delete(synchronize_session=False)


def _item_out(item: VocabularyItem) -> VocabularyItemOut:
    return VocabularyItemOut(
        id=item.id, order_no=item.order_no, word=item.word, reading=item.reading, han_viet=item.han_viet,
        meaning_vi=item.meaning_vi, word_type=item.word_type,
        example_sentence_ja=item.example_sentence_ja, example_sentence_vi=item.example_sentence_vi,
        admin_notes=item.admin_notes,
        is_meaning_ai_generated=item.is_meaning_ai_generated,
        is_example_ai_generated=item.is_example_ai_generated,
        is_reviewed=item.is_reviewed,
    )


def _set_out(vocab_set: VocabularySet, progress_by_item: dict) -> MySetOut:
    """learned/reviewing/new_count are aggregated from progress_by_item the
    same way learning.py's _set_progress_out does for public sets, so a
    private 'bài' card can show the same progress bar/stat breakdown. Pass
    an empty dict for a set whose items carry no progress yet (e.g. just
    created)."""
    learned = reviewing = 0
    for item in vocab_set.items:
        p = progress_by_item.get(item.id)
        if p and p.status == 'learned':
            learned += 1
        elif p and p.status == 'reviewing':
            reviewing += 1
    return MySetOut(
        id=vocab_set.id, curriculum_id=vocab_set.curriculum_id, set_name=vocab_set.set_name,
        description=vocab_set.description, item_count=vocab_set.item_count, created_at=vocab_set.created_at,
        learned_count=learned, reviewing_count=reviewing,
        new_count=max(0, len(vocab_set.items) - learned - reviewing),
    )


def _progress_map(db: Session, user_id: int, item_ids: list) -> dict:
    if not item_ids:
        return {}
    rows = db.query(VocabularyItemProgress).filter(
        VocabularyItemProgress.user_id == user_id, VocabularyItemProgress.item_id.in_(item_ids),
    )
    return {p.item_id: p for p in rows}


def _learning_item_out(item: VocabularyItem, progress: Optional[VocabularyItemProgress]) -> VocabularyLearningItemOut:
    return VocabularyLearningItemOut(
        id=item.id, order_no=item.order_no, word=item.word, reading=item.reading, han_viet=item.han_viet,
        meaning_vi=item.meaning_vi, word_type=item.word_type,
        example_sentence_ja=item.example_sentence_ja, example_sentence_vi=item.example_sentence_vi,
        status=progress.status if progress else 'new',
        is_bookmarked=progress.is_bookmarked if progress else False,
        due_at=progress.due_at if progress else None,
    )


def _curriculum_out(curriculum: VocabularyCurriculum, progress_by_item: dict) -> MyCurriculumOut:
    set_outs = [_set_out(s, progress_by_item) for s in sorted(curriculum.sets, key=lambda s: s.created_at)]
    return MyCurriculumOut(
        id=curriculum.id, name=curriculum.name, description=curriculum.description, created_at=curriculum.created_at,
        item_count=sum(s.item_count for s in set_outs),
        learned_count=sum(s.learned_count for s in set_outs),
        reviewing_count=sum(s.reviewing_count for s in set_outs),
        new_count=sum(s.new_count for s in set_outs),
        sets=set_outs,
    )


def _get_owned_curriculum(
    db: Session, curriculum_id: int, user_id: int, with_items: bool = False,
) -> VocabularyCurriculum:
    query = db.query(VocabularyCurriculum).filter(
        VocabularyCurriculum.id == curriculum_id,
        VocabularyCurriculum.is_private.is_(True),
        VocabularyCurriculum.owner_id == user_id,
    )
    if with_items:
        query = query.options(selectinload(VocabularyCurriculum.sets).selectinload(VocabularySet.items))
    curriculum = query.first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ từ vựng")
    return curriculum


def _get_owned_set(db: Session, set_id: int, user_id: int) -> VocabularySet:
    vocab_set = db.query(VocabularySet).filter(
        VocabularySet.id == set_id,
        VocabularySet.is_private.is_(True),
        VocabularySet.created_by == user_id,
    ).first()
    if not vocab_set:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    return vocab_set


# --- Curriculums ("Bộ") ---


@router.get("/curriculums", response_model=list[MyCurriculumOut])
def list_my_curriculums(db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    curriculums = (
        db.query(VocabularyCurriculum)
        .options(selectinload(VocabularyCurriculum.sets).selectinload(VocabularySet.items))
        .filter(VocabularyCurriculum.is_private.is_(True), VocabularyCurriculum.owner_id == current_user.id)
        .order_by(VocabularyCurriculum.created_at.desc())
        .all()
    )
    all_item_ids = [i.id for c in curriculums for s in c.sets for i in s.items]
    progress_by_item = _progress_map(db, current_user.id, all_item_ids)
    return [_curriculum_out(c, progress_by_item) for c in curriculums]


@router.post("/curriculums", response_model=MyCurriculumOut)
def create_my_curriculum(
    payload: MyCurriculumIn, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    curriculum = VocabularyCurriculum(
        name=payload.name, description=payload.description, owner_id=current_user.id, is_private=True,
    )
    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)
    return MyCurriculumOut(
        id=curriculum.id, name=curriculum.name, description=curriculum.description,
        created_at=curriculum.created_at, item_count=0, sets=[],
    )


@router.patch("/curriculums/{curriculum_id}", response_model=MyCurriculumOut)
def update_my_curriculum(
    curriculum_id: int, payload: MyCurriculumPatch,
    db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    curriculum = _get_owned_curriculum(db, curriculum_id, current_user.id, with_items=True)
    fields = payload.model_dump(exclude_unset=True)
    if 'name' in fields and fields['name']:
        curriculum.name = fields['name']
    if 'description' in fields:
        curriculum.description = fields['description']
    db.commit()
    db.refresh(curriculum)
    all_item_ids = [i.id for s in curriculum.sets for i in s.items]
    progress_by_item = _progress_map(db, current_user.id, all_item_ids)
    return _curriculum_out(curriculum, progress_by_item)


@router.delete("/curriculums/{curriculum_id}")
def delete_my_curriculum(
    curriculum_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    curriculum = _get_owned_curriculum(db, curriculum_id, current_user.id)
    for vocab_set in list(curriculum.sets):
        _delete_progress_for_items(db, [i.id for i in vocab_set.items])
        db.delete(vocab_set)  # cascades to its items (VocabularySet.items: cascade='all, delete-orphan')
    db.delete(curriculum)
    db.commit()
    return {"success": True}


# --- Sets ("Bài") ---


@router.post("/curriculums/{curriculum_id}/sets", response_model=MySetOut)
def create_my_set(
    curriculum_id: int, payload: MySetIn,
    db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    _get_owned_curriculum(db, curriculum_id, current_user.id)
    vocab_set = VocabularySet(
        curriculum_id=curriculum_id, level=None, set_name=payload.set_name, description=payload.description,
        status='published', is_private=True, created_by=current_user.id, item_count=0,
    )
    db.add(vocab_set)
    db.commit()
    db.refresh(vocab_set)
    return _set_out(vocab_set, {})


@router.get("/sets/{set_id}", response_model=MySetDetailOut)
def get_my_set(set_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    vocab_set = _get_owned_set(db, set_id, current_user.id)
    items = sorted(vocab_set.items, key=lambda i: i.order_no)
    progress_by_item = _progress_map(db, current_user.id, [i.id for i in items])
    return MySetDetailOut(**_set_out(vocab_set, progress_by_item).model_dump(), items=[_item_out(i) for i in items])


@router.post("/sets/{set_id}/batch", response_model=list[VocabularyLearningItemOut])
def get_my_study_batch(
    set_id: int, payload: StudyBatchRequest,
    db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    """Same batch-picking logic as learning.py's get_study_batch (public
    sets), scoped to a private 'bài' via _get_owned_set instead of the
    published-set query — lets a private set's 'Chế độ học' panel run a real
    SRS session, on the same VocabularyItemProgress rows the public flow
    (and the due/bookmarked cross-set sessions, which already don't filter
    by is_private) uses."""
    vocab_set = _get_owned_set(db, set_id, current_user.id)
    count = max(1, min(payload.count, 200))
    items = sorted(vocab_set.items, key=lambda i: i.order_no)
    progress_by_item = _progress_map(db, current_user.id, [i.id for i in items])

    if payload.source == 'review':
        due = [i for i in items if (p := progress_by_item.get(i.id)) and p.status == 'reviewing']
        due.sort(key=lambda i: progress_by_item[i.id].due_at or datetime.max)
        selected = due[:count]
    else:
        selected = [
            i for i in items
            if (p := progress_by_item.get(i.id)) is None or p.status == 'new'
        ][:count]

    if not selected:
        raise HTTPException(status_code=404, detail="Không còn từ nào phù hợp để tạo bộ flashcard này")
    return [_learning_item_out(i, progress_by_item.get(i.id)) for i in selected]


@router.patch("/sets/{set_id}", response_model=MySetOut)
def update_my_set(
    set_id: int, payload: MySetPatch, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    vocab_set = _get_owned_set(db, set_id, current_user.id)
    fields = payload.model_dump(exclude_unset=True)
    if 'set_name' in fields and fields['set_name']:
        vocab_set.set_name = fields['set_name']
    if 'description' in fields:
        vocab_set.description = fields['description']
    db.commit()
    db.refresh(vocab_set)
    progress_by_item = _progress_map(db, current_user.id, [i.id for i in vocab_set.items])
    return _set_out(vocab_set, progress_by_item)


@router.delete("/sets/{set_id}")
def delete_my_set(set_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    vocab_set = _get_owned_set(db, set_id, current_user.id)
    _delete_progress_for_items(db, [i.id for i in vocab_set.items])
    db.delete(vocab_set)
    db.commit()
    return {"success": True}


# --- Items (words) ---


def _parse_autofill_json(raw: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    try:
        parsed = json.loads(match.group() if match else cleaned)
    except json.JSONDecodeError:
        return {}
    # The model sometimes writes the literal word "null"/"None" instead of a
    # real JSON null (e.g. for han_viet on a pure-kana word) — normalize so
    # that string ends up as None instead of getting saved and displayed as-is.
    for key, value in list(parsed.items()):
        if isinstance(value, str) and value.strip().lower() in ('null', 'none', ''):
            parsed[key] = None
    return parsed


def _autofill_item_fields(word: str, meaning_vi: str) -> dict:
    """Fills whatever of reading/han_viet/word_type/example_sentence_ja(vi)
    the learner left blank when adding a word by hand, the same way an
    admin-imported word gets AI-filled fields when the source didn't have
    them (see vocabulary_ocr._parse_vocabulary_chunk)."""
    api_key = require_api_key()
    prompt = (
        f'Từ vựng tiếng Nhật: "{word}", nghĩa tiếng Việt: "{meaning_vi}".\n'
        'Hãy cung cấp:\n'
        '- reading: cách đọc hiragana\n'
        '- han_viet: âm Hán Việt của từng chữ kanji, phân tách bằng dấu phẩy, viết hoa (VD: "NHÂN, SINH" cho 人生); '
        'null nếu từ viết bằng hiragana/katakana thuần\n'
        '- word_type: loại từ nếu suy luận được (danh từ/động từ/tính từ/phó từ...), null nếu không chắc\n'
        f'- example_sentence_ja: một câu ví dụ tiếng Nhật tự nhiên dùng từ này\n'
        '- example_sentence_vi: bản dịch tiếng Việt của câu ví dụ\n'
        'Chỉ trả về đúng một object JSON với 5 khóa trên, không markdown, không giải thích thêm.'
    )
    try:
        raw = call_openrouter([{"role": "user", "content": prompt}], api_key, temperature=0.3)
    except Exception:
        return {}
    return _parse_autofill_json(raw)


@router.post("/sets/{set_id}/items", response_model=VocabularyItemOut)
def create_my_item(
    set_id: int, payload: MyItemCreate, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    vocab_set = _get_owned_set(db, set_id, current_user.id)

    reading, han_viet, word_type = payload.reading, payload.han_viet, payload.word_type
    example_ja, example_vi = payload.example_sentence_ja, payload.example_sentence_vi
    is_example_ai = False
    missing = not reading or not han_viet or not example_ja or not example_vi
    if payload.auto_fill and missing:
        filled = _autofill_item_fields(payload.word, payload.meaning_vi)
        reading = reading or filled.get('reading') or None
        han_viet = han_viet or filled.get('han_viet') or None
        word_type = word_type or filled.get('word_type') or None
        if not example_ja and filled.get('example_sentence_ja'):
            example_ja = filled.get('example_sentence_ja')
            example_vi = filled.get('example_sentence_vi') or example_vi
            is_example_ai = True

    max_order = db.query(func.max(VocabularyItem.order_no)).filter(VocabularyItem.set_id == set_id).scalar()
    item = VocabularyItem(
        set_id=set_id, order_no=0 if max_order is None else max_order + 1,
        word=payload.word, reading=reading, han_viet=han_viet, meaning_vi=payload.meaning_vi, word_type=word_type,
        example_sentence_ja=example_ja, example_sentence_vi=example_vi,
        is_meaning_ai_generated=False, is_example_ai_generated=is_example_ai, is_reviewed=True,
    )
    db.add(item)
    vocab_set.item_count += 1
    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.patch("/items/{item_id}", response_model=VocabularyItemOut)
def update_my_item(
    item_id: int, payload: MyItemPatch, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    item = (
        db.query(VocabularyItem)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(
            VocabularyItem.id == item_id,
            VocabularySet.is_private.is_(True), VocabularySet.created_by == current_user.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

    fields = payload.model_dump(exclude_unset=True)
    for key in ('word', 'reading', 'han_viet', 'meaning_vi', 'word_type', 'example_sentence_ja', 'example_sentence_vi'):
        if key in fields:
            setattr(item, key, fields[key])
    db.commit()
    db.refresh(item)
    return _item_out(item)


@router.delete("/items/{item_id}")
def delete_my_item(item_id: int, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    item = (
        db.query(VocabularyItem)
        .join(VocabularySet, VocabularySet.id == VocabularyItem.set_id)
        .filter(
            VocabularyItem.id == item_id,
            VocabularySet.is_private.is_(True), VocabularySet.created_by == current_user.id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

    vocab_set = db.query(VocabularySet).filter(VocabularySet.id == item.set_id).first()
    _delete_progress_for_items(db, [item.id])
    db.delete(item)
    if vocab_set:
        vocab_set.item_count = max(0, vocab_set.item_count - 1)
    db.commit()
    return {"success": True}


@router.post("/copy", response_model=VocabularyItemOut)
def copy_item_to_mine(
    payload: CopyItemToMineRequest, db: Session = Depends(get_db), current_user: UserResponse = Depends(get_current_user),
):
    """'Thêm vào bộ của tôi': copies a word from any published public set
    into one of the learner's own private 'bài'. A copy, not a reference —
    the two get independent SRS progress (see VocabularyItemProgress, keyed
    by item_id) and editing/deleting the original never touches the copy."""
    source = db.query(VocabularyItem).join(VocabularySet, VocabularySet.id == VocabularyItem.set_id).filter(
        VocabularyItem.id == payload.item_id,
        VocabularySet.status == 'published', VocabularySet.is_locked.is_(False), VocabularySet.is_private.is_(False),
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")

    target_set = _get_owned_set(db, payload.target_set_id, current_user.id)

    max_order = db.query(func.max(VocabularyItem.order_no)).filter(VocabularyItem.set_id == target_set.id).scalar()
    item = VocabularyItem(
        set_id=target_set.id, order_no=0 if max_order is None else max_order + 1,
        word=source.word, reading=source.reading, han_viet=source.han_viet, meaning_vi=source.meaning_vi,
        word_type=source.word_type,
        example_sentence_ja=source.example_sentence_ja, example_sentence_vi=source.example_sentence_vi,
        is_meaning_ai_generated=source.is_meaning_ai_generated, is_example_ai_generated=source.is_example_ai_generated,
        is_reviewed=True,
    )
    db.add(item)
    target_set.item_count += 1
    db.commit()
    db.refresh(item)
    return _item_out(item)
