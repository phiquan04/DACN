"""Admin CRUD for the two lookup tables grammar sets are tagged with:
curriculum (bộ giáo trình, e.g. 'Shinkanzen Master N3 Ngữ pháp') and category
(danh mục nội dung, e.g. 'Ngữ pháp giao tiếp'). Both are reused across many
sets, so they're managed as their own small lists rather than free-typed on
every import. Mirrors app/routes/vocabulary/lookups.py exactly."""
import re
import unicodedata
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.grammar_content import GrammarCategory, GrammarCurriculum, GrammarSet
from app.schemas.grammar_content import (
    GrammarCategoryIn, GrammarCategoryOut, GrammarCategoryPatch,
    GrammarCurriculumIn, GrammarCurriculumOut, GrammarCurriculumPatch,
)

router = APIRouter(prefix="", tags=["grammar-content-lookups"])


def _slugify(name: str) -> str:
    normalized = unicodedata.normalize('NFKD', name)
    ascii_only = normalized.encode('ascii', 'ignore').decode('ascii')
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', ascii_only).strip('-').lower()
    return slug or 'category'


# --- Curriculums ---

@router.get("/curriculums", response_model=List[GrammarCurriculumOut])
def list_curriculums(db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    rows = (
        db.query(GrammarCurriculum, func.count(GrammarSet.id))
        .outerjoin(GrammarSet, GrammarSet.curriculum_id == GrammarCurriculum.id)
        .group_by(GrammarCurriculum.id)
        .order_by(GrammarCurriculum.name)
        .all()
    )
    return [
        GrammarCurriculumOut(id=c.id, name=c.name, description=c.description, set_count=count)
        for c, count in rows
    ]


@router.post("/curriculums", response_model=GrammarCurriculumOut)
def create_curriculum(
    payload: GrammarCurriculumIn, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    if db.query(GrammarCurriculum).filter(GrammarCurriculum.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Đã tồn tại bộ giáo trình với tên này")
    curriculum = GrammarCurriculum(name=payload.name, description=payload.description)
    db.add(curriculum)
    db.commit()
    db.refresh(curriculum)
    return GrammarCurriculumOut(id=curriculum.id, name=curriculum.name, description=curriculum.description, set_count=0)


@router.patch("/curriculums/{curriculum_id}", response_model=GrammarCurriculumOut)
def update_curriculum(
    curriculum_id: int, payload: GrammarCurriculumPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    curriculum = db.query(GrammarCurriculum).filter(GrammarCurriculum.id == curriculum_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ giáo trình")
    fields = payload.model_dump(exclude_unset=True)
    if 'name' in fields:
        curriculum.name = fields['name']
    if 'description' in fields:
        curriculum.description = fields['description']
    db.commit()
    db.refresh(curriculum)
    set_count = db.query(GrammarSet).filter(GrammarSet.curriculum_id == curriculum_id).count()
    return GrammarCurriculumOut(id=curriculum.id, name=curriculum.name, description=curriculum.description, set_count=set_count)


@router.delete("/curriculums/{curriculum_id}")
def delete_curriculum(
    curriculum_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    curriculum = db.query(GrammarCurriculum).filter(GrammarCurriculum.id == curriculum_id).first()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ giáo trình")
    in_use = db.query(GrammarSet).filter(GrammarSet.curriculum_id == curriculum_id).count()
    if in_use:
        raise HTTPException(
            status_code=409, detail=f"Không thể xóa vì đang được {in_use} bộ ngữ pháp sử dụng",
        )
    db.delete(curriculum)
    db.commit()
    return {"success": True}


# --- Categories ---

@router.get("/categories", response_model=List[GrammarCategoryOut])
def list_categories(db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    rows = (
        db.query(GrammarCategory, func.count(GrammarSet.id))
        .outerjoin(GrammarSet, GrammarSet.category_id == GrammarCategory.id)
        .group_by(GrammarCategory.id)
        .order_by(GrammarCategory.name)
        .all()
    )
    return [
        GrammarCategoryOut(id=c.id, name=c.name, slug=c.slug, set_count=count)
        for c, count in rows
    ]


@router.post("/categories", response_model=GrammarCategoryOut)
def create_category(
    payload: GrammarCategoryIn, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    if db.query(GrammarCategory).filter(GrammarCategory.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Đã tồn tại danh mục với tên này")
    slug = _slugify(payload.name)
    base_slug, i = slug, 1
    while db.query(GrammarCategory).filter(GrammarCategory.slug == slug).first():
        i += 1
        slug = f"{base_slug}-{i}"
    category = GrammarCategory(name=payload.name, slug=slug)
    db.add(category)
    db.commit()
    db.refresh(category)
    return GrammarCategoryOut(id=category.id, name=category.name, slug=category.slug, set_count=0)


@router.patch("/categories/{category_id}", response_model=GrammarCategoryOut)
def update_category(
    category_id: int, payload: GrammarCategoryPatch,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    category = db.query(GrammarCategory).filter(GrammarCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    fields = payload.model_dump(exclude_unset=True)
    if 'name' in fields:
        category.name = fields['name']
    db.commit()
    db.refresh(category)
    set_count = db.query(GrammarSet).filter(GrammarSet.category_id == category_id).count()
    return GrammarCategoryOut(id=category.id, name=category.name, slug=category.slug, set_count=set_count)


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    category = db.query(GrammarCategory).filter(GrammarCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    in_use = db.query(GrammarSet).filter(GrammarSet.category_id == category_id).count()
    if in_use:
        raise HTTPException(
            status_code=409, detail=f"Không thể xóa vì đang được {in_use} bộ ngữ pháp sử dụng",
        )
    db.delete(category)
    db.commit()
    return {"success": True}
