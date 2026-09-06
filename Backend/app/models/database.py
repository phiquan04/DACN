"""Backward-compatible re-export barrel.

Models used to live entirely in this file; they're now split by domain
across app/models/*.py (base, user, chat, grammar, transcription,
dictionary, profile). This module re-exports everything so existing
`from app.models.database import ...` imports elsewhere in the codebase
keep working unchanged.
"""
from .base import DATABASE_URL, engine, SessionLocal, Base, BaseModel, get_db, init_db
from .user import Role, User
from .chat import ChatScenario, Conversation, Message
from .grammar import GrammarCorrection
from .transcription import TranscriptionSession, TranscriptionSegment
from .dictionary import SearchHistory, DictionaryImage, DictionaryComment, DictionaryCommentVote
from .profile import UserInformation
from .reminder import ReminderTime
from .jlpt import (
    JlptLevelStructure, JlptSection, JlptMondaiTemplate,
    JlptExam, JlptPassage, JlptQuestion, JlptChoice,
    JlptTestAttempt, JlptTestAttemptAnswer,
    JlptExamSchedule, JlptUserExamPlan,
)
from .vocabulary import VocabularyCurriculum, VocabularyCategory, VocabularySet, VocabularyItem

__all__ = [
    'DATABASE_URL', 'engine', 'SessionLocal', 'Base', 'BaseModel', 'get_db', 'init_db',
    'Role', 'User',
    'ChatScenario', 'Conversation', 'Message',
    'GrammarCorrection',
    'TranscriptionSession', 'TranscriptionSegment',
    'SearchHistory', 'DictionaryImage', 'DictionaryComment', 'DictionaryCommentVote',
    'UserInformation',
    'ReminderTime',
    'JlptLevelStructure', 'JlptSection', 'JlptMondaiTemplate',
    'JlptExam', 'JlptPassage', 'JlptQuestion', 'JlptChoice',
    'JlptTestAttempt', 'JlptTestAttemptAnswer',
    'JlptExamSchedule', 'JlptUserExamPlan',
    'VocabularyCurriculum', 'VocabularyCategory', 'VocabularySet', 'VocabularyItem',
]
