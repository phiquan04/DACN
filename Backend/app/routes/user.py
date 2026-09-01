from datetime import date

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from app.models.database import get_db, UserInformation
from app.models.user import User
from app.dependencies import get_current_user, UserResponse
from app.utils.auth import hash_password, verify_password
from app.utils.cloudinary import upload_image

router = APIRouter(prefix="/user", tags=["user"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB, same cap as dictionary community images


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    current_jlpt_level: Optional[str] = None
    target_jlpt_level: Optional[str] = None


class UserProfileResponse(UserProfileUpdate):
    email: str
    username: str
    avatar_url: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


def build_profile_response(user, info: UserInformation | None):
    return {
        "email": user.email,
        "username": user.username,
        "first_name": info.first_name if info else None,
        "last_name": info.last_name if info else None,
        "phone": info.phone if info else None,
        "country": info.country if info else None,
        "city": info.city if info else None,
        "avatar_url": info.avatar_url if info else None,
        "date_of_birth": info.date_of_birth if info else None,
        "gender": info.gender if info else None,
        "current_jlpt_level": info.current_jlpt_level if info else None,
        "target_jlpt_level": info.target_jlpt_level if info else None,
    }


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    info = db.query(UserInformation).filter(UserInformation.user_id == current_user.id).first()
    return build_profile_response(current_user, info)


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    data: UserProfileUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    info = db.query(UserInformation).filter(UserInformation.user_id == current_user.id).first()
    if not info:
        info = UserInformation(user_id=current_user.id)
        db.add(info)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(info, field, value)

    db.commit()
    db.refresh(info)
    return build_profile_response(current_user, info)

@router.put("/password")
def change_password(
    data: PasswordChangeRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user or not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")

    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"success": True}


@router.post("/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Kiểm tra loại file
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")

    content = file.file.read(MAX_AVATAR_BYTES + 1)
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB)")

    try:
        # Upload lên Cloudinary
        url = upload_image(content)

        # Lưu URL vào database
        info = db.query(UserInformation).filter(UserInformation.user_id == current_user.id).first()
        if not info:
            info = UserInformation(user_id=current_user.id)
            db.add(info)
        info.avatar_url = url
        db.commit()
        db.refresh(info)
        
        return {"avatar_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.delete("/avatar")
def delete_avatar(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    info = db.query(UserInformation).filter(UserInformation.user_id == current_user.id).first()
    if info:
        info.avatar_url = None
        db.commit()

    return {"avatar_url": None}