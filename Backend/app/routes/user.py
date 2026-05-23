from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.models.database import get_db, User, UserInformation
from app.routes.auth import get_current_user
from app.utils.cloudinary import upload_image

router = APIRouter(prefix="/user", tags=["user"])


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    facebook_link: Optional[str] = None
    instagram_link: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None


class UserProfileResponse(UserProfileUpdate):
    email: str
    username: str
    avatar_url: Optional[str] = None 


def build_profile_response(user, info: UserInformation | None):
    return {
        "email": user.email,
        "username": user.username,
        "first_name": info.first_name if info else None,
        "last_name": info.last_name if info else None,
        "phone": info.phone if info else None,
        "facebook_link": info.facebook_link if info else None,
        "instagram_link": info.instagram_link if info else None,
        "country": info.country if info else None,
        "city": info.city if info else None,
        "avatar_url": info.avatar_url if info else None, 
    }


@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    info = db.query(UserInformation).filter(UserInformation.user_id == current_user.id).first()
    return build_profile_response(current_user, info)


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    info = db.query(UserInformation).filter(UserInformation.user_id == current_user.id).first()
    if not info:
        info = UserInformation(user_id=current_user.id)
        db.add(info)

    for field, value in data.dict(exclude_unset=True).items():
        setattr(info, field, value)

    db.commit()
    db.refresh(info)
    return build_profile_response(current_user, info)

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Kiểm tra loại file
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    
    try:
        # Upload lên Cloudinary
        url = upload_image(await file.read())
        
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