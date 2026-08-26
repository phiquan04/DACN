from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import UserResponse, get_current_user
from app.utils.zego_token import generate_token04, get_zego_credentials

router = APIRouter(prefix="/meeting", tags=["meeting"])

TOKEN_EFFECTIVE_SECONDS = 3600


class MeetingTokenRequest(BaseModel):
    room_id: str = Field(..., min_length=1, max_length=64)


class MeetingTokenResponse(BaseModel):
    token: str
    app_id: int
    user_id: str
    user_name: str


@router.post("/token", response_model=MeetingTokenResponse)
def create_meeting_token(
    body: MeetingTokenRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """Issues a ZegoCloud room-join token server-side so ZEGO_SERVER_SECRET never reaches the browser."""
    try:
        app_id, secret = get_zego_credentials()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    user_id = str(current_user.id)
    token = generate_token04(app_id, user_id, secret, TOKEN_EFFECTIVE_SECONDS)

    return MeetingTokenResponse(
        token=token,
        app_id=app_id,
        user_id=user_id,
        user_name=current_user.username,
    )
