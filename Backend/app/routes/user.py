from datetime import date, time

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
from app.models.database import get_db, UserInformation
from app.models.reminder import ReminderTime
from app.models.user import User
from app.dependencies import get_current_user, UserResponse
from app.utils.auth import create_access_token, create_refresh_token, hash_password, verify_password
from app.utils.cloudinary import upload_image

router = APIRouter(prefix="/user", tags=["user"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB, same cap as dictionary community images
MAX_REMINDER_TIMES = 5  # study-reminder slots a learner can register per day


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
    # Revoke every token issued under the old password (other devices, or
    # whoever knew it) and hand this session a fresh pair so the person who
    # just changed the password isn't signed out along with them.
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return {
        "success": True,
        "access_token": create_access_token(
            user_id=user.id, username=user.username, role=current_user.role, token_version=user.token_version,
        ),
        "refresh_token": create_refresh_token(user_id=user.id, token_version=user.token_version),
    }


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


class ReminderSettingsUpdate(BaseModel):
    enabled: bool
    times: List[time] = Field(default_factory=list, max_length=MAX_REMINDER_TIMES)


class ReminderSettingsResponse(BaseModel):
    enabled: bool
    times: List[time]


def _reminder_settings_response(db: Session, user_id: int, enabled: bool) -> ReminderSettingsResponse:
    times = (
        db.query(ReminderTime.time_of_day)
        .filter(ReminderTime.user_id == user_id)
        .order_by(ReminderTime.time_of_day)
        .all()
    )
    return ReminderSettingsResponse(enabled=enabled, times=[t[0] for t in times])


@router.get("/reminder-settings", response_model=ReminderSettingsResponse)
def get_reminder_settings(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _reminder_settings_response(db, user.id, user.reminder_emails_enabled)


@router.put("/reminder-settings", response_model=ReminderSettingsResponse)
def update_reminder_settings(
    data: ReminderSettingsUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Replaces the learner's whole set of reminder times with `data.times`
    (at most 5) and flips the opt-in flag. A full replace (rather than
    incremental add/remove) keeps this endpoint idempotent and matches how
    the profile page's time-slot editor submits the form."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(set(data.times)) != len(data.times):
        raise HTTPException(status_code=400, detail="Các mốc giờ nhắc nhở không được trùng nhau")

    user.reminder_emails_enabled = data.enabled

    db.query(ReminderTime).filter(ReminderTime.user_id == user.id).delete()
    for t in data.times:
        db.add(ReminderTime(user_id=user.id, time_of_day=t))

    db.commit()
    return _reminder_settings_response(db, user.id, user.reminder_emails_enabled)