from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import bcrypt
import jwt
from jwt import InvalidTokenError
from pydantic import BaseModel
from config import get_config

# Configuration
config = get_config()

# bcrypt only ever looks at the first 72 bytes of a password. Older bcrypt
# releases truncated silently (which is how every hash already in the
# database was made); newer ones raise instead. Truncating here keeps both
# behaviours identical, so existing passwords keep verifying across upgrades.
_BCRYPT_MAX_BYTES = 72


class TokenData(BaseModel):
    user_id: int
    username: str
    role: str = "user"
    token_version: int = 0
    exp: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


def _password_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("ascii")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash. A stored value that isn't a valid
    bcrypt hash counts as a mismatch rather than an error, so a corrupt row
    yields "wrong password" instead of a 500."""
    try:
        return bcrypt.checkpw(_password_bytes(plain_password), hashed_password.encode("ascii"))
    except (ValueError, AttributeError, UnicodeEncodeError):
        return False

def create_access_token(
    user_id: int, username: str, role: str = "user", token_version: int = 0,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a JWT access token.

    `token_version` is the user's User.token_version at issue time, carried as
    the "ver" claim: bumping the column (logout, password change, lock)
    invalidates every token issued before it — see app/dependencies.py.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "ver": token_version,
        "type": "access",
        "exp": expire
    }

    return jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)

def verify_token(token: str) -> Optional[TokenData]:
    """Verify and decode a JWT access token"""
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        user_id: int = payload.get("user_id")
        username: str = payload.get("username")
        role: str = payload.get("role", "user")

        if user_id is None or username is None:
            return None

        # Tokens issued before the "ver" claim existed count as version 0,
        # which is also the column's default — they stay valid until the
        # user's version is first bumped.
        return TokenData(user_id=user_id, username=username, role=role, token_version=payload.get("ver", 0))
    except InvalidTokenError:
        return None

def create_refresh_token(user_id: int, token_version: int = 0) -> str:
    """Create a long-lived JWT refresh token, used only to mint new access
    tokens via /auth/refresh. Carries a 'type' claim (and no username/role)
    so it can't be presented in place of an access token — verify_token
    above already rejects it since it has no 'username' claim, and
    verify_refresh_token below rejects an access token the same way."""
    expire = datetime.now(timezone.utc) + timedelta(days=config.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "user_id": user_id,
        "ver": token_version,
        "type": "refresh",
        "exp": expire
    }
    return jwt.encode(to_encode, config.SECRET_KEY, algorithm=config.ALGORITHM)

def verify_refresh_token(token: str) -> Optional[Tuple[int, int]]:
    """Verify a refresh token and return (user_id, token_version) it was
    issued for, or None. The caller compares the version against the user's
    current one — see /auth/refresh."""
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        if payload.get("type") != "refresh" or payload.get("user_id") is None:
            return None
        return payload["user_id"], payload.get("ver", 0)
    except InvalidTokenError:
        return None
