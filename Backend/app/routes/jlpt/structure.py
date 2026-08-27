"""Admin setup of the JLPT exam blueprint for one level: total time budget,
broken down into sections (kotoba/dokkai/choukai) and the mondai within each
section. Configured once per level and reused by every exam imported under
that level (see the import/review endpoints added in a later step)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.dependencies import require_admin, UserResponse
from app.models.database import get_db
from app.models.jlpt import JlptLevelStructure, JlptSection, JlptMondaiTemplate
from app.schemas.jlpt import (
    JLPT_LEVELS, JlptLevel, LevelStructureIn, LevelStructureOut, LevelStructureSummary,
)

router = APIRouter(prefix="/structure", tags=["jlpt-structure"])


def _mondai_out(m: JlptMondaiTemplate) -> dict:
    return {
        "id": m.id, "mondai_no": m.mondai_no, "name": m.name,
        "description": m.description, "tips": m.tips,
        "question_count": m.question_count, "time_minutes": m.time_minutes,
    }


def _section_out(s: JlptSection) -> dict:
    return {
        "id": s.id, "section_type": s.section_type, "name": s.name,
        "order_no": s.order_no, "time_minutes": s.time_minutes,
        "mondai": [_mondai_out(m) for m in s.mondai_templates],
    }


def _structure_out(ls: JlptLevelStructure) -> dict:
    return {
        "id": ls.id, "level": ls.level,
        "total_time_minutes": ls.total_time_minutes, "notes": ls.notes,
        "sections": [_section_out(s) for s in ls.sections],
    }


def _load_structure(db: Session, level: str):
    return (
        db.query(JlptLevelStructure)
        .options(joinedload(JlptLevelStructure.sections).joinedload(JlptSection.mondai_templates))
        .filter(JlptLevelStructure.level == level)
        .first()
    )


@router.get("", response_model=List[LevelStructureSummary])
def list_structures(db: Session = Depends(get_db)):
    existing = {
        ls.level: ls
        for ls in db.query(JlptLevelStructure)
        .options(joinedload(JlptLevelStructure.sections).joinedload(JlptSection.mondai_templates))
        .all()
    }
    summaries = []
    for level in JLPT_LEVELS:
        ls = existing.get(level)
        if not ls:
            summaries.append(LevelStructureSummary(level=level, is_configured=False))
            continue
        mondai_count = sum(len(s.mondai_templates) for s in ls.sections)
        summaries.append(LevelStructureSummary(
            level=level, is_configured=True,
            total_time_minutes=ls.total_time_minutes,
            section_count=len(ls.sections),
            mondai_count=mondai_count,
        ))
    return summaries


@router.get("/{level}", response_model=LevelStructureOut)
def get_structure(level: JlptLevel, db: Session = Depends(get_db)):
    ls = _load_structure(db, level)
    if not ls:
        raise HTTPException(status_code=404, detail=f"Chưa cấu hình cấu trúc đề cho level {level}")
    return _structure_out(ls)


@router.put("/{level}", response_model=LevelStructureOut)
def upsert_structure(
    level: JlptLevel,
    payload: LevelStructureIn,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    section_types = [s.section_type for s in payload.sections]
    if len(section_types) != len(set(section_types)):
        raise HTTPException(status_code=400, detail="Mỗi phần (kotoba/dokkai/choukai) chỉ được khai báo một lần")
    for s in payload.sections:
        mondai_nos = [m.mondai_no for m in s.mondai]
        if len(mondai_nos) != len(set(mondai_nos)):
            raise HTTPException(status_code=400, detail=f"Số thứ tự mondai bị trùng trong phần {s.section_type}")

    level_structure = _load_structure(db, level)
    if not level_structure:
        level_structure = JlptLevelStructure(level=level)
        db.add(level_structure)

    level_structure.total_time_minutes = payload.total_time_minutes
    level_structure.notes = payload.notes

    existing_sections = {s.section_type: s for s in level_structure.sections}
    incoming_types = set(section_types)
    for section_type, section in list(existing_sections.items()):
        if section_type not in incoming_types:
            db.delete(section)

    for s_payload in payload.sections:
        section = existing_sections.get(s_payload.section_type)
        if not section:
            section = JlptSection(level_structure=level_structure, section_type=s_payload.section_type)
            db.add(section)
        section.name = s_payload.name
        section.order_no = s_payload.order_no
        section.time_minutes = s_payload.time_minutes

        existing_mondai = {m.mondai_no: m for m in section.mondai_templates}
        incoming_nos = {m.mondai_no for m in s_payload.mondai}
        for mondai_no, mondai in list(existing_mondai.items()):
            if mondai_no not in incoming_nos:
                db.delete(mondai)

        for m_payload in s_payload.mondai:
            mondai = existing_mondai.get(m_payload.mondai_no)
            if not mondai:
                mondai = JlptMondaiTemplate(section=section, mondai_no=m_payload.mondai_no)
                db.add(mondai)
            mondai.name = m_payload.name
            mondai.description = m_payload.description
            mondai.tips = m_payload.tips
            mondai.question_count = m_payload.question_count
            mondai.time_minutes = m_payload.time_minutes

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "Không thể xóa một phần/mondai đã có câu hỏi thuộc đề thi tham chiếu tới. "
                "Hãy xóa hoặc chuyển các câu hỏi đó trước."
            ),
        )
    return _structure_out(_load_structure(db, level))


@router.delete("/{level}")
def delete_structure(
    level: JlptLevel,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    ls = db.query(JlptLevelStructure).filter(JlptLevelStructure.level == level).first()
    if not ls:
        raise HTTPException(status_code=404, detail=f"Chưa cấu hình cấu trúc đề cho level {level}")
    try:
        db.delete(ls)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Không thể xóa: cấu trúc này đang được đề thi tham chiếu tới.")
    return {"success": True}
