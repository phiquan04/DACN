"""Admin moderation of community-contributed dictionary content (images and
comments): browse/search/filter the queue, change an item's moderation
status, delete it outright, or bulk-approve everything still pending.
Moderation here is purely a post-hoc review — see DEFAULT_MODERATION_STATUS
in app.models.dictionary — so these endpoints never affect what the public
dictionary page shows, only what admins see in the queue."""
import asyncio
from datetime import datetime
from typing import Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.dependencies import UserResponse, require_admin
from app.models.database import get_db, DictionaryComment, DictionaryImage, User
from app.schemas.dictionary import (
    AdminCommentItem, AdminCommentListPage, AdminDictionaryStats, AdminImageItem, AdminImageListPage,
    BulkApproveRequest, BulkApproveResponse, ModerationStatus, UpdateModerationStatusRequest,
)

router = APIRouter(prefix="/admin/dictionary", tags=["admin-dictionary"])

PAGE_SIZE = 10
HIGH_DOWNVOTE_THRESHOLD = -3  # net score (upvotes - downvotes) at or below this counts as "downvote cao"
SortOrder = Optional[str]  # 'newest' | 'score_asc' | 'score_desc'


def _votes(record) -> tuple:
    upvotes = sum(1 for v in record.votes if v.vote_type == 'up')
    downvotes = sum(1 for v in record.votes if v.vote_type == 'down')
    return upvotes, downvotes


def _sort_rows(rows: list, sort: SortOrder) -> list:
    """rows: list of (record, upvotes, downvotes) tuples."""
    if sort == "score_asc":
        return sorted(rows, key=lambda row: row[1] - row[2])
    if sort == "score_desc":
        return sorted(rows, key=lambda row: row[1] - row[2], reverse=True)
    return sorted(rows, key=lambda row: row[0].created_at, reverse=True)  # 'newest' (default)


@router.get("/stats", response_model=AdminDictionaryStats)
def get_stats(db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    images = db.query(DictionaryImage).options(selectinload(DictionaryImage.votes)).all()
    comments = db.query(DictionaryComment).options(selectinload(DictionaryComment.votes)).all()

    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    pending_count = sum(1 for r in images if r.status == 'pending') + sum(1 for r in comments if r.status == 'pending')
    today_count = (
        sum(1 for r in images if r.created_at and r.created_at >= today_start)
        + sum(1 for r in comments if r.created_at and r.created_at >= today_start)
    )
    high_downvote_count = 0
    for r in images:
        up, down = _votes(r)
        if up - down <= HIGH_DOWNVOTE_THRESHOLD:
            high_downvote_count += 1
    for r in comments:
        up, down = _votes(r)
        if up - down <= HIGH_DOWNVOTE_THRESHOLD:
            high_downvote_count += 1

    return AdminDictionaryStats(
        total_content=len(images) + len(comments),
        pending_count=pending_count,
        today_count=today_count,
        high_downvote_count=high_downvote_count,
    )


@router.get("/images", response_model=AdminImageListPage)
def list_images(
    search: Optional[str] = None,
    status_filter: Optional[ModerationStatus] = Query(None, alias="status"),
    sort: SortOrder = None,
    page: int = 1,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    page = max(1, page)
    query = db.query(DictionaryImage).options(
        joinedload(DictionaryImage.uploader), selectinload(DictionaryImage.votes),
    )
    if search:
        like = f"%{search.strip()}%"
        query = query.outerjoin(User, User.id == DictionaryImage.uploaded_by).filter(
            or_(DictionaryImage.word.ilike(like), DictionaryImage.caption.ilike(like), User.username.ilike(like))
        )
    if status_filter:
        query = query.filter(DictionaryImage.status == status_filter)

    rows = _sort_rows([(r, *_votes(r)) for r in query.all()], sort)

    total = len(rows)
    page_rows = rows[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
    items = [
        AdminImageItem(
            id=r.id, word=r.word, image_url=r.image_url, caption=r.caption or "", status=r.status,
            uploaded_by=r.uploaded_by, uploader_username=r.uploader.username if r.uploader else "",
            upvotes=up, downvotes=down, score=up - down,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r, up, down in page_rows
    ]
    return AdminImageListPage(items=items, total=total, page=page, page_size=PAGE_SIZE)


@router.patch("/images/{image_id}/status", response_model=AdminImageItem)
def update_image_status(
    image_id: int, payload: UpdateModerationStatusRequest,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    record = db.query(DictionaryImage).options(
        joinedload(DictionaryImage.uploader), selectinload(DictionaryImage.votes),
    ).filter(DictionaryImage.id == image_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
    record.status = payload.status
    db.commit()
    db.refresh(record)
    up, down = _votes(record)
    return AdminImageItem(
        id=record.id, word=record.word, image_url=record.image_url, caption=record.caption or "",
        status=record.status, uploaded_by=record.uploaded_by,
        uploader_username=record.uploader.username if record.uploader else "",
        upvotes=up, downvotes=down, score=up - down,
        created_at=record.created_at.isoformat() if record.created_at else "",
    )


@router.delete("/images/{image_id}")
async def delete_image(image_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    record = db.query(DictionaryImage).filter(DictionaryImage.id == image_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")

    if record.cloudinary_public_id:
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, lambda: cloudinary.uploader.destroy(record.cloudinary_public_id)
            )
        except Exception as e:
            print(f"[Cloudinary destroy] Error: {e}", flush=True)  # best-effort; still remove the DB row

    db.delete(record)
    db.commit()
    return {"success": True}


@router.post("/images/bulk-approve", response_model=BulkApproveResponse)
def bulk_approve_images(
    payload: BulkApproveRequest, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    query = db.query(DictionaryImage).filter(DictionaryImage.status == 'pending')
    if payload.ids:
        query = query.filter(DictionaryImage.id.in_(payload.ids))
    records = query.all()
    for r in records:
        r.status = 'approved'
    db.commit()
    return BulkApproveResponse(approved_count=len(records))


@router.get("/comments", response_model=AdminCommentListPage)
def list_comments(
    search: Optional[str] = None,
    status_filter: Optional[ModerationStatus] = Query(None, alias="status"),
    sort: SortOrder = None,
    page: int = 1,
    db: Session = Depends(get_db),
    _admin: UserResponse = Depends(require_admin),
):
    page = max(1, page)
    query = db.query(DictionaryComment).options(
        joinedload(DictionaryComment.author), selectinload(DictionaryComment.votes),
    )
    if search:
        like = f"%{search.strip()}%"
        query = query.outerjoin(User, User.id == DictionaryComment.user_id).filter(
            or_(DictionaryComment.word.ilike(like), DictionaryComment.content.ilike(like), User.username.ilike(like))
        )
    if status_filter:
        query = query.filter(DictionaryComment.status == status_filter)

    rows = _sort_rows([(r, *_votes(r)) for r in query.all()], sort)

    total = len(rows)
    page_rows = rows[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
    items = [
        AdminCommentItem(
            id=r.id, word=r.word, content=r.content, status=r.status,
            user_id=r.user_id, username=r.author.username if r.author else "",
            upvotes=up, downvotes=down, score=up - down,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r, up, down in page_rows
    ]
    return AdminCommentListPage(items=items, total=total, page=page, page_size=PAGE_SIZE)


@router.patch("/comments/{comment_id}/status", response_model=AdminCommentItem)
def update_comment_status(
    comment_id: int, payload: UpdateModerationStatusRequest,
    db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    record = db.query(DictionaryComment).options(
        joinedload(DictionaryComment.author), selectinload(DictionaryComment.votes),
    ).filter(DictionaryComment.id == comment_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Không tìm thấy bình luận")
    record.status = payload.status
    db.commit()
    db.refresh(record)
    up, down = _votes(record)
    return AdminCommentItem(
        id=record.id, word=record.word, content=record.content, status=record.status,
        user_id=record.user_id, username=record.author.username if record.author else "",
        upvotes=up, downvotes=down, score=up - down,
        created_at=record.created_at.isoformat() if record.created_at else "",
    )


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin)):
    record = db.query(DictionaryComment).filter(DictionaryComment.id == comment_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Không tìm thấy bình luận")
    db.delete(record)
    db.commit()
    return {"success": True}


@router.post("/comments/bulk-approve", response_model=BulkApproveResponse)
def bulk_approve_comments(
    payload: BulkApproveRequest, db: Session = Depends(get_db), _admin: UserResponse = Depends(require_admin),
):
    query = db.query(DictionaryComment).filter(DictionaryComment.status == 'pending')
    if payload.ids:
        query = query.filter(DictionaryComment.id.in_(payload.ids))
    records = query.all()
    for r in records:
        r.status = 'approved'
    db.commit()
    return BulkApproveResponse(approved_count=len(records))
