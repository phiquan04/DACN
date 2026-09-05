from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from app.models import User, Role
from app.models.database import get_db
from app.dependencies import UserResponse, get_current_user, to_user_response
from app.services.audit_log import log_event
from app.services.email_verification import confirm_verification_code, send_verification_code
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    Token
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Pydantic schemas
class UserSignUp(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    email: str = Field(..., pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(..., min_length=8)
    first_name: str = Field(default="")
    last_name: str = Field(default="")
    
    class Config:
        json_schema_extra = {
            "example": {
                "username": "john_doe",
                "email": "john@example.com",
                "password": "securepass123",
                "first_name": "John",
                "last_name": "Doe"
            }
        }

class UserSignIn(BaseModel):
    email: str = Field(..., pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(..., min_length=8)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "john@example.com",
                "password": "securepass123"
            }
        }

class SignUpResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class SignInResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class EmailVerificationConfirmRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$')

class EmailVerificationResponse(BaseModel):
    email_verified: bool
    message: str

# Routes
@router.post("/signup", response_model=SignUpResponse, status_code=status.HTTP_201_CREATED)
def sign_up(user_data: UserSignUp, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_user_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_user_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create new user, defaulting to the 'user' role
    default_role = db.query(Role).filter(Role.code == "user").first()
    hashed_password = hash_password(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hashed_password,
        is_active=True,
        role_id=default_role.id if default_role else None,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Snapshot what the response needs before the email attempt below: a failed
    # send ends in a rollback, which expires every object in the session, and
    # re-reading `new_user` afterwards would issue extra queries for values we
    # already have.
    user_response = to_user_response(new_user)

    # Best-effort: get a verification code into their inbox right away. A mail
    # failure must not fail the signup itself — the account already exists and
    # they can request a new code from their profile page.
    ok, _ = send_verification_code(db, new_user)
    if ok:
        db.commit()
    else:
        db.rollback()

    # Create access + refresh tokens
    access_token = create_access_token(
        user_id=user_response.id, username=user_response.username, role=user_response.role
    )
    refresh_token = create_refresh_token(user_id=user_response.id)

    return SignUpResponse(
        user=user_response,
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/signin", response_model=SignInResponse)
def sign_in(user_data: UserSignIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    if not user.is_active:
        detail = f"Tài khoản đã bị khóa: {user.locked_reason}" if user.locked_reason else "Tài khoản đã bị khóa"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    now = datetime.utcnow()
    user.last_login_at = now
    user.last_seen_at = now  # marks them online immediately; kept warm by /auth/heartbeat while the app stays open
    log_event(
        db, subject_user_id=user.id, action="auth.login", description="Đăng nhập vào hệ thống",
        actor_user_id=user.id, actor_role=user.role.code if user.role else "user",
    )
    db.commit()

    access_token = create_access_token(
        user_id=user.id, username=user.username, role=user.role.code if user.role else "user"
    )
    refresh_token = create_refresh_token(user_id=user.id)

    return SignInResponse(
        user=to_user_response(user),
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )

@router.post("/refresh", response_model=RefreshResponse)
def refresh_access_token(req: RefreshRequest, db: Session = Depends(get_db)):
    user_id = verify_refresh_token(req.refresh_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")

    access_token = create_access_token(
        user_id=user.id, username=user.username, role=user.role.code if user.role else "user"
    )
    return RefreshResponse(access_token=access_token, token_type="bearer")

@router.get("/me", response_model=UserResponse)
def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.post("/heartbeat", status_code=status.HTTP_204_NO_CONTENT)
def heartbeat(current_user: UserResponse = Depends(get_current_user), db: Session = Depends(get_db)):
    """Called every ~60s by the frontend while the app is open (see
    hooks/useOnlineHeartbeat.ts) so the admin console can tell who is online
    right now (see admin_users.py's _account_status). If the tab is closed or
    the connection drops, heartbeats simply stop and the account falls back
    to 'inactive' once ONLINE_THRESHOLD_MINUTES passes — no explicit
    disconnect signal needed."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if user:
        user.last_seen_at = datetime.utcnow()
        db.commit()


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(current_user: UserResponse = Depends(get_current_user), db: Session = Depends(get_db)):
    """Marks the account offline immediately on an explicit logout, instead
    of waiting for the heartbeat timeout to expire."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if user:
        user.last_seen_at = None
        db.commit()


@router.post("/verify-email/send", response_model=EmailVerificationResponse)
def send_email_verification(
    current_user: UserResponse = Depends(get_current_user), db: Session = Depends(get_db),
):
    """Email the signed-in user a fresh 6-digit verification code. Rate
    limited by a resend cooldown inside the service."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    ok, message = send_verification_code(db, user)
    if not ok:
        # Nothing is persisted on failure — the pending code row (and the
        # retirement of any previous one) is discarded with the rollback, so a
        # send that never reached the inbox can't invalidate a code the user
        # still has.
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    db.commit()
    return EmailVerificationResponse(email_verified=user.email_verified, message=message)


@router.post("/verify-email/confirm", response_model=EmailVerificationResponse)
def confirm_email_verification(
    req: EmailVerificationConfirmRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check the code the user typed in. A wrong code still commits, so the
    per-code attempt counter can't be reset by simply retrying."""
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    ok, message = confirm_verification_code(db, user, req.code)
    db.commit()
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)

    return EmailVerificationResponse(email_verified=user.email_verified, message=message)
