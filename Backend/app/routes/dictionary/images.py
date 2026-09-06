"""Community-contributed images attached to a dictionary word."""
import asyncio
from typing import List, Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, UserResponse
from app.models.database import get_db, DictionaryImage, DictionaryImageVote
from app.schemas.dictionary import ImageItem, ImageVoteRequest
from app.utils.cloudinary import init_cloudinary

init_cloudinary()

router = APIRouter()

MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _image_to_item(record: DictionaryImage, requesting_user_id: Optional[int]) -> ImageItem:
    upvotes = sum(1 for v in record.votes if v.vote_type == 'up')
    downvotes = sum(1 for v in record.votes if v.vote_type == 'down')
    my_vote = next((v.vote_type for v in record.votes if v.user_id == requesting_user_id), None)
    return ImageItem(
        id=record.id, image_url=record.image_url, caption=record.caption or "",
        uploaded_by=record.uploaded_by, uploader_username=record.uploader.username if record.uploader else "",
        status=record.status, upvotes=upvotes, downvotes=downvotes, my_vote=my_vote,
        created_at=record.created_at.isoformat() if record.created_at else "",
    )


@router.get("/images/{word}", response_model=List[ImageItem])
async def get_images(word: str, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    records = (
        db.query(DictionaryImage)
        .options(selectinload(DictionaryImage.votes))
        .filter(DictionaryImage.word == word)
        .order_by(DictionaryImage.created_at.desc())
        .all()
    )
    return [_image_to_item(r, user_id) for r in records]


@router.post("/images", response_model=ImageItem)
async def upload_image(
    word: str = Form(...),
    caption: str = Form(""),
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Missing 'word'")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    content = await file.read(MAX_UPLOAD_IMAGE_BYTES + 1)
    if len(content) > MAX_UPLOAD_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB)")

    try:
        upload_result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: cloudinary.uploader.upload(content, folder="dictionary_images"),
        )
    except Exception as e:
        print(f"[Cloudinary upload] Error: {e}", flush=True)
        raise HTTPException(status_code=502, detail="Failed to upload image")

    record = DictionaryImage(
        word=word,
        image_url=upload_result["secure_url"],
        cloudinary_public_id=upload_result.get("public_id"),
        caption=caption or None,
        uploaded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return _image_to_item(record, current_user.id)


@router.delete("/images/{image_id}")
async def delete_image(
    image_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(DictionaryImage).filter(DictionaryImage.id == image_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")
    if record.uploaded_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own images")

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


@router.post("/images/{image_id}/vote", response_model=ImageItem)
async def vote_image(
    image_id: int,
    req: ImageVoteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.vote_type not in ('up', 'down'):
        raise HTTPException(status_code=400, detail="vote_type must be 'up' or 'down'")
    record = db.query(DictionaryImage).filter(DictionaryImage.id == image_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Image not found")

    existing = db.query(DictionaryImageVote).filter(
        DictionaryImageVote.image_id == image_id,
        DictionaryImageVote.user_id == current_user.id,
    ).first()

    if existing and existing.vote_type == req.vote_type:
        db.delete(existing)  # clicking the same vote again toggles it off
    elif existing:
        existing.vote_type = req.vote_type
    else:
        db.add(DictionaryImageVote(image_id=image_id, user_id=current_user.id, vote_type=req.vote_type))
    db.commit()
    db.refresh(record)
    return _image_to_item(record, current_user.id)
