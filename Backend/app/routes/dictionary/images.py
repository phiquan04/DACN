"""Community-contributed images attached to a dictionary word."""
import asyncio
from typing import List

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.database import get_db, DictionaryImage
from app.routes.auth import get_current_user, UserResponse
from app.schemas.dictionary import ImageItem
from app.utils.cloudinary import init_cloudinary

init_cloudinary()

router = APIRouter()

MAX_UPLOAD_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("/images/{word}", response_model=List[ImageItem])
async def get_images(word: str, db: Session = Depends(get_db)):
    records = (
        db.query(DictionaryImage)
        .filter(DictionaryImage.word == word)
        .order_by(DictionaryImage.created_at.desc())
        .all()
    )
    return [
        ImageItem(
            id=r.id, image_url=r.image_url, caption=r.caption or "",
            uploaded_by=r.uploaded_by, uploader_username=r.uploader.username if r.uploader else "",
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in records
    ]


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

    return ImageItem(
        id=record.id, image_url=record.image_url, caption=record.caption or "",
        uploaded_by=record.uploaded_by, uploader_username=current_user.username,
        created_at=record.created_at.isoformat() if record.created_at else "",
    )


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
