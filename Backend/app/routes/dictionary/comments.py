"""Community comments (and votes) attached to a dictionary word."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from app.dependencies import get_current_user, UserResponse
from app.models.database import get_db, User, DictionaryComment, DictionaryCommentVote
from app.schemas.dictionary import CommentItem, CommentVoteRequest, CreateCommentRequest

router = APIRouter()


def _comment_to_item(comment: DictionaryComment, requesting_user_id: Optional[int]) -> CommentItem:
    upvotes = sum(1 for v in comment.votes if v.vote_type == 'up')
    downvotes = sum(1 for v in comment.votes if v.vote_type == 'down')
    my_vote = next((v.vote_type for v in comment.votes if v.user_id == requesting_user_id), None)
    return CommentItem(
        id=comment.id, word=comment.word, user_id=comment.user_id,
        username=comment.author.username if comment.author else "",
        avatar_url=comment.author.information.avatar_url if comment.author and comment.author.information else None,
        content=comment.content, status=comment.status, upvotes=upvotes, downvotes=downvotes, my_vote=my_vote,
        created_at=comment.created_at.isoformat() if comment.created_at else "",
    )


@router.get("/comments/{word}", response_model=List[CommentItem])
async def get_comments(word: str, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    comments = (
        db.query(DictionaryComment)
        .options(
            joinedload(DictionaryComment.author).joinedload(User.information),
            selectinload(DictionaryComment.votes),
        )
        .filter(DictionaryComment.word == word)
        .order_by(DictionaryComment.created_at.desc())
        .all()
    )
    return [_comment_to_item(c, user_id) for c in comments]


@router.post("/comments", response_model=CommentItem)
async def create_comment(
    req: CreateCommentRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    word = req.word.strip()
    content = req.content.strip()
    if not word or not content:
        raise HTTPException(status_code=400, detail="Missing 'word' or 'content'")

    comment = DictionaryComment(word=word, user_id=current_user.id, content=content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_to_item(comment, current_user.id)


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(DictionaryComment).filter(DictionaryComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    db.delete(comment)
    db.commit()
    return {"success": True}


@router.post("/comments/{comment_id}/vote", response_model=CommentItem)
async def vote_comment(
    comment_id: int,
    req: CommentVoteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.vote_type not in ('up', 'down'):
        raise HTTPException(status_code=400, detail="vote_type must be 'up' or 'down'")
    comment = db.query(DictionaryComment).filter(DictionaryComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    existing = db.query(DictionaryCommentVote).filter(
        DictionaryCommentVote.comment_id == comment_id,
        DictionaryCommentVote.user_id == current_user.id,
    ).first()

    if existing and existing.vote_type == req.vote_type:
        db.delete(existing)  # clicking the same vote again toggles it off
    elif existing:
        existing.vote_type = req.vote_type
    else:
        db.add(DictionaryCommentVote(comment_id=comment_id, user_id=current_user.id, vote_type=req.vote_type))
    db.commit()
    db.refresh(comment)
    return _comment_to_item(comment, current_user.id)
