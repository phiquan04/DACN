"""Shared FastAPI auth dependencies used across multiple route modules.

Kept here (not in app/routes/auth.py) so other route files depend on a
neutral shared module instead of importing from a sibling route file.
"""
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import User
from app.models.database import get_db
from app.utils.auth import verify_token


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    role: str
    email_verified: bool = False

    class Config:
        from_attributes = True


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        role=user.role.code if user.role else "user",
        email_verified=bool(user.email_verified),
    )


def _parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
    """Extract the token from an `Authorization: Bearer <token>` header, or None if malformed."""
    try:
        scheme, token = authorization.split()
    except (ValueError, AttributeError):
        return None
    if scheme.lower() != "bearer":
        return None
    return token


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> UserResponse:
    """Required-auth dependency: 401s if the request has no valid, current Bearer token."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = _parse_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token_data = verify_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = db.query(User).filter(User.id == token_data.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return to_user_response(user)


def require_admin(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Required-auth + role dependency: 403s unless the current user's role is 'admin'."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yêu cầu quyền quản trị viên")
    return current_user


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    """Optional-auth dependency: the user_id for a valid Bearer token, or None — never raises."""
    token = _parse_bearer_token(authorization)
    if not token:
        return None
    token_data = verify_token(token)
    return token_data.user_id if token_data else None
