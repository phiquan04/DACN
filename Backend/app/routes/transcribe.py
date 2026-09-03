import os
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from sqlalchemy.orm import Session

from app.dependencies import UserResponse, get_current_user, get_optional_user_id
from app.models import TranscriptionSegment, TranscriptionSession
from app.models.database import get_db
from app.schemas.transcription import VideoHistoryDetail, VideoHistoryItem, VideoHistoryPage
from app.services import youtube_transcription as yt

router = APIRouter()

HISTORY_PAGE_SIZE = 12


def _find_session(db: Session, user_id: int, video_id: str) -> Optional[TranscriptionSession]:
    return db.query(TranscriptionSession).filter(
        TranscriptionSession.user_id == user_id,
        TranscriptionSession.video_id == video_id,
    ).first()


def _upsert_completed_session(
    db: Session,
    user_id: int,
    youtube_url: str,
    video_id: str,
    video_title: str,
    channel_id: str,
    channel_title: str,
    thumbnail: str,
    translated: list,
) -> Optional[int]:
    """Save a finished transcript to history. Reuses the 'watched' row for this
    video (created when the user opened it) instead of creating a duplicate."""
    try:
        session = _find_session(db, user_id, video_id)
        if session:
            session.source_url = youtube_url
            session.status = 'completed'
            session.segment_count = len(translated)
            session.video_title = video_title
            session.channel_id = channel_id
            session.channel_title = channel_title
            session.thumbnail = thumbnail
            session.segments = []  # cascade='all, delete-orphan' drops the old rows
            db.flush()
        else:
            session = TranscriptionSession(
                user_id=user_id,
                source_url=youtube_url,
                source_type='youtube',
                status='completed',
                segment_count=len(translated),
                video_id=video_id,
                video_title=video_title,
                channel_id=channel_id,
                channel_title=channel_title,
                thumbnail=thumbnail,
            )
            db.add(session)
            db.flush()

        db.add_all([
            TranscriptionSegment(
                session_id=session.id,
                start_time=seg["start"],
                end_time=seg["end"],
                japanese_text=seg["japanese"],
                vietnamese_text=seg["vietnamese"],
            )
            for seg in translated
        ])
        db.commit()
        db.refresh(session)
        return session.id
    except Exception as e:
        print(f"Failed to save TranscriptionSession: {e}", flush=True)
        db.rollback()
        return None


@router.post("/transcribe")
def transcribe(
    youtube_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    video_id: Optional[str] = Form(None),
    video_title: Optional[str] = Form(None),
    channel_id: Optional[str] = Form(None),
    channel_title: Optional[str] = Form(None),
    thumbnail: Optional[str] = Form(None),
    user_id: Optional[int] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    tmp_path = None
    tmp_dir = None

    try:
        if youtube_url and youtube_url.strip():
            print(f"Transcribing YouTube URL: {youtube_url}", flush=True)
            tmp_path = yt.download_youtube_audio(youtube_url.strip())
            tmp_dir = os.path.dirname(tmp_path)

        elif file:
            suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            contents = file.file.read()
            tmp.write(contents)
            tmp.close()
            tmp_path = tmp.name

        else:
            raise HTTPException(
                status_code=400,
                detail="Provide 'youtube_url' as form field or upload a file"
            )

        print(f"Audio file: {tmp_path}", flush=True)
        if not tmp_path or not os.path.exists(tmp_path):
            raise HTTPException(status_code=500, detail="Không thể tải audio từ YouTube")

        try:
            print("Starting transcription...", flush=True)
            segments = yt.transcribe_with_whisper(tmp_path)
            print(f"Transcribed {len(segments)} segments", flush=True)

            if not segments:
                raise HTTPException(status_code=422, detail="Không phát hiện được giọng nói trong video")

            print("Starting translation...", flush=True)
            translated = yt.translate_segments(segments)
            print(f"Translated {len(translated)} segments", flush=True)

            history_id = None
            if user_id is not None and video_id:
                history_id = _upsert_completed_session(
                    db, user_id, youtube_url.strip(), video_id,
                    video_title or "", channel_id or "", channel_title or "", thumbnail or "",
                    translated,
                )

            return {"segments": translated, "history_id": history_id}
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    print(f"Deleted temp file: {tmp_path}", flush=True)
                except Exception as e:
                    print(f"Failed to delete {tmp_path}: {e}", flush=True)
            if tmp_dir and os.path.isdir(tmp_dir):
                try:
                    os.rmdir(tmp_dir)
                    print(f"Deleted temp dir: {tmp_dir}", flush=True)
                except OSError as e:
                    print(f"Failed to delete {tmp_dir}: {e}", flush=True)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Transcribe error: {e}", flush=True)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        if tmp_dir and os.path.isdir(tmp_dir):
            try:
                os.rmdir(tmp_dir)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe/watch")
def mark_video_watched(
    video_id: str = Form(...),
    video_title: str = Form(""),
    channel_id: str = Form(""),
    channel_title: str = Form(""),
    thumbnail: str = Form(""),
    user_id: Optional[int] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Records that a signed-in user opened a video, even if they never generate
    a script for it — so it still shows up under Lịch sử. Best-effort: never
    raises, since a failed history write shouldn't block watching the video."""
    if user_id is None:
        return {"history_id": None}
    try:
        session = _find_session(db, user_id, video_id)
        if session:
            session.video_title = video_title or session.video_title
            session.channel_id = channel_id or session.channel_id
            session.channel_title = channel_title or session.channel_title
            session.thumbnail = thumbnail or session.thumbnail
        else:
            session = TranscriptionSession(
                user_id=user_id,
                source_url=f"https://www.youtube.com/watch?v={video_id}",
                source_type='youtube',
                status='watched',
                segment_count=0,
                video_id=video_id,
                video_title=video_title,
                channel_id=channel_id,
                channel_title=channel_title,
                thumbnail=thumbnail,
            )
            db.add(session)
        db.commit()
        db.refresh(session)
        return {"history_id": session.id}
    except Exception as e:
        print(f"Failed to save watch history: {e}", flush=True)
        db.rollback()
        return {"history_id": None}


@router.post("/transcribe/url")
def transcribe_url(
    youtube_url: str,
    user_id: Optional[int] = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    """Transcribe từ YouTube URL - nhận plain string query param"""
    return transcribe(youtube_url=youtube_url, file=None, user_id=user_id, db=db)


@router.get("/transcribe/history", response_model=VideoHistoryPage)
def get_video_history(
    page: int = 1,
    status: str = 'all',
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    page = max(1, page)
    base_query = db.query(TranscriptionSession).filter(
        TranscriptionSession.user_id == current_user.id,
        TranscriptionSession.status.in_(['watched', 'completed']),
    )

    total_all = base_query.count()
    total_completed = base_query.filter(TranscriptionSession.status == 'completed').count()

    if status == 'completed':
        query = base_query.filter(TranscriptionSession.status == 'completed')
        total = total_completed
    elif status == 'watching':
        query = base_query.filter(TranscriptionSession.status == 'watched')
        total = total_all - total_completed
    else:
        query = base_query
        total = total_all

    records = (
        query.order_by(TranscriptionSession.updated_at.desc())
        .offset((page - 1) * HISTORY_PAGE_SIZE)
        .limit(HISTORY_PAGE_SIZE)
        .all()
    )
    return VideoHistoryPage(
        items=[
            VideoHistoryItem(
                id=r.id,
                video_id=r.video_id or "",
                video_title=r.video_title or "",
                channel_title=r.channel_title or "",
                thumbnail=r.thumbnail or "",
                segment_count=r.segment_count or 0,
                has_script=r.status == 'completed',
                created_at=(r.updated_at or r.created_at).isoformat() + 'Z' if (r.updated_at or r.created_at) else '',
            )
            for r in records
        ],
        total=total,
        page=page,
        page_size=HISTORY_PAGE_SIZE,
        total_all=total_all,
        total_completed=total_completed,
    )


@router.get("/transcribe/history/{history_id}", response_model=VideoHistoryDetail)
def get_video_history_detail(
    history_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(TranscriptionSession).filter(
        TranscriptionSession.id == history_id,
        TranscriptionSession.user_id == current_user.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail='History item not found')

    # Bump updated_at so this video sorts to the top of the history list —
    # opening it counts as "viewing" it, same as watching it the first time.
    record.updated_at = datetime.utcnow()
    db.commit()

    segments = sorted(record.segments, key=lambda s: s.start_time)
    return VideoHistoryDetail(
        id=record.id,
        video_id=record.video_id or "",
        video_title=record.video_title or "",
        channel_id=record.channel_id or "",
        channel_title=record.channel_title or "",
        thumbnail=record.thumbnail or "",
        segments=[
            {
                "start": s.start_time,
                "end": s.end_time,
                "japanese": s.japanese_text,
                "vietnamese": s.vietnamese_text or "",
            }
            for s in segments
        ],
        created_at=record.created_at.isoformat() + 'Z' if record.created_at else '',
    )


@router.delete("/transcribe/history/{history_id}")
def delete_video_history_item(
    history_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(TranscriptionSession).filter(
        TranscriptionSession.id == history_id,
        TranscriptionSession.user_id == current_user.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail='History item not found')
    db.delete(record)
    db.commit()
    return {"success": True}
