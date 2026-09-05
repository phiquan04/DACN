from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

AdminUserAccountStatus = Literal["active", "inactive", "locked"]


class AdminUserSummary(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool  # False = account is locked; use account_status for the 3-state view
    account_status: AdminUserAccountStatus  # 'active' (online right now, heartbeat within the last few minutes) | 'inactive' (not currently online) | 'locked'
    email_verified: bool = False  # confirmed via an emailed OTP; accounts predating the feature were backfilled as verified
    locked_reason: Optional[str] = None
    locked_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    current_jlpt_level: Optional[str] = None
    vocab_xp: int = 0
    level: int = 1
    streak_days: int = 0


class AdminUserListPage(BaseModel):
    items: List[AdminUserSummary]
    total: int
    page: int
    page_size: int


class AdminUserDetail(AdminUserSummary):
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    target_jlpt_level: Optional[str] = None
    last_activity_at: Optional[datetime] = None
    total_study_minutes: int = 0
    level_xp_floor: int = 0  # total XP at which the current level started
    level_xp_ceil: int = 100  # total XP needed to reach the next level
    daily_vocab_goal: Optional[int] = None
    profile_updated_at: Optional[datetime] = None  # UserInformation.updated_at — last profile edit, real timestamp (not a full audit trail)
    xp_percentile_top: int = 100  # this user is in the top N% of all users by vocab_xp (lower = more XP than peers)
    admin_note: Optional[str] = None  # internal note, admin-only


class AdminUserLockRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=255)


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    email: str = Field(..., pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
    password: str = Field(..., min_length=8)
    role: str = Field(default="user")
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AdminUserUpdateRequest(BaseModel):
    """Partial update of an existing user's role + profile — everything an
    admin can edit except identity (username/email), lock state (its own
    dedicated endpoint), and the learner's own configured learning settings
    (current/target JLPT level, daily vocab goal) — those are self-service
    only and must never be admin-editable, even via a direct API call."""
    role: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    admin_note: Optional[str] = None


class AdminPasswordResetResponse(BaseModel):
    temporary_password: str


class AdminUserVocabularyStats(BaseModel):
    learned: int = 0
    reviewing: int = 0
    new: int = 0
    total_reviews: int = 0
    studied_today: int = 0  # distinct words reviewed today (UTC) — used for the daily-goal progress bar


class AdminUserJlptStats(BaseModel):
    attempts: int = 0
    completed: int = 0
    average_score: Optional[float] = None
    best_score: Optional[int] = None
    last_attempt_at: Optional[datetime] = None


class AdminUserConversationStats(BaseModel):
    conversations: int = 0
    messages_sent: int = 0
    grammar_checks: int = 0
    average_errors: Optional[float] = None


class AdminUserListeningDictionaryStats(BaseModel):
    transcription_sessions: int = 0
    transcription_completed: int = 0
    dictionary_searches: int = 0


class AdminUserLearningStats(BaseModel):
    vocabulary: AdminUserVocabularyStats
    jlpt: AdminUserJlptStats
    conversation: AdminUserConversationStats
    listening_dictionary: AdminUserListeningDictionaryStats


class AdminUserVocabularySetProgress(BaseModel):
    """One vocabulary set the user has started (has at least one graded word
    in it) — powers a row of "Danh sách bộ từ vựng đã ghi danh"."""
    id: int
    set_name: str
    level: str
    curriculum_name: Optional[str] = None
    item_count: int
    progress_count: int  # distinct words with at least one review
    mastered_count: int  # of those, how many reached 'learned'
    percent: int  # progress_count / item_count
    status_label: str  # "Mới bắt đầu" | "Đang học" | "Đang học tích cực" | "Đã hoàn thành"
    status_tone: str  # StatTone on the frontend: "pending" | "info" | "success"


class AdminUserWeakWord(BaseModel):
    """A word the user has graded 'again' (forgot) repeatedly — powers "Từ
    vựng hay quên / Tỷ lệ sai cao"."""
    word: str
    reading: Optional[str] = None
    meaning_vi: str
    again_count: int


class AdminUserSrsBucket(BaseModel):
    """One bucket of the SRS interval-length histogram — how far apart this
    user's next reviews are spaced, from words just started to words with a
    multi-month gap (see LEARNED_INTERVAL_THRESHOLD_DAYS for why the last
    bucket lines up with 'mastered')."""
    label: str  # "Mới học" | "Ôn ngắn hạn" | "Đang ghi nhớ" | "Đã thuộc sâu"
    sublabel: str  # e.g. "Cấp độ 1 (0-1 ngày)"
    count: int
    tone: str  # StatTone on the frontend: "info" | "pending" | "neutral" | "success"


class AdminUserVocabularyDetail(BaseModel):
    total_touched: int  # distinct words with any progress (reviewing + learned)
    studied_today: int
    mastered: int  # status == 'learned'
    mastered_percent: int  # mastered / total_touched
    due_today: int
    accuracy_percent: Optional[float] = None  # (good+easy) / total graded reviews, all-time
    accuracy_label: str
    sets: List[AdminUserVocabularySetProgress]
    weak_words: List[AdminUserWeakWord]
    srs_distribution: List[AdminUserSrsBucket]


class AdminUserJlptSectionScore(BaseModel):
    """One skill section's scaled score for one attempt — same 0-60 scale and
    pass-floor rule as the learner-facing SectionScore (see
    app/services/jlpt_scoring.py)."""
    section_type: str  # 'kotoba' | 'dokkai' | 'choukai'
    name: str
    score: int
    max: int
    floor: int
    above_floor: bool


class AdminUserJlptAttempt(BaseModel):
    """One completed JLPT mock-exam attempt, rescored on the fly to the same
    0-180 scale shown to the learner (see build_score_breakdown)."""
    attempt_id: int
    exam_id: int
    exam_title: str
    level: str
    submitted_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    total: int
    total_max: int
    pass_total: int
    is_pass: bool
    sections: List[AdminUserJlptSectionScore]


class AdminUserJlptWeakMondai(BaseModel):
    section_name: str
    mondai_no: int
    mondai_name: Optional[str] = None
    wrong_count: int
    total_count: int
    percent_correct: float


class AdminUserJlptProgressPoint(BaseModel):
    """One point on the "tiến trình điểm số" chart — scaled total score of
    one attempt, in chronological order."""
    attempt_id: int
    label: str  # short date, e.g. "12/09"
    submitted_at: Optional[datetime] = None
    total: int


class AdminUserJlptMondaiScore(BaseModel):
    """One mondai's correct/total on the learner's single most recent
    attempt — the "Phân tích năng lực theo Mondai" breakdown, not an
    all-time aggregate. mondai_no is only unique within its own section (see
    JlptMondaiTemplate), so section_name must come along for both display
    and list-key uniqueness."""
    section_name: str
    mondai_no: int
    name: Optional[str] = None
    correct: int
    total: int
    percent: int
    tier_label: str  # "Rất tốt" | "Tốt" | "Khá" | "Cần cải thiện"
    tier_tone: str  # StatTone on the frontend: "success" | "info" | "pending" | "danger"


class AdminUserJlptNextTarget(BaseModel):
    """The learner's own configured target sitting (JlptUserExamPlan) for
    their target_jlpt_level. None when they haven't chosen one yet — the
    admin UI shows an empty state rather than a fabricated date."""
    level: str
    exam_date: date
    months_left: int


class AdminUserJlptDetail(BaseModel):
    attempts: List[AdminUserJlptAttempt]  # most recent first, capped
    attempts_total: int  # total completed attempts (may exceed len(attempts))
    scope_level: Optional[str] = None  # level of the most recent attempt — labels latest_mondai_breakdown only
    average_total: Optional[float] = None  # scaled 0-180, across every completed attempt (any level)
    best_total: Optional[int] = None
    pass_estimate_percent: Optional[int] = None  # % of scoped attempts that pass both conditions
    delta_total: Optional[int] = None  # latest scoped attempt's total minus the previous one
    progress: List[AdminUserJlptProgressPoint]
    weak_mondai: List[AdminUserJlptWeakMondai]
    latest_attempt_label: Optional[str] = None  # exam title the mondai breakdown below is based on
    latest_mondai_breakdown: List[AdminUserJlptMondaiScore]
    next_target: Optional[AdminUserJlptNextTarget] = None
    insight_message: Optional[str] = None  # rule-based summary, not model-generated


class AdminUserJlptChoice(BaseModel):
    choice_no: int
    choice_text: str


class AdminUserJlptAnswerDetail(BaseModel):
    """One graded question within an attempt, for the read-only "Xem bài
    làm" review — the admin equivalent of the learner's own post-submit
    result screen, looked up after the fact instead of only right after
    submission."""
    question_no: int
    question_text: str
    passage_text: Optional[str] = None
    choices: List[AdminUserJlptChoice]
    selected_choice_no: Optional[int] = None
    correct_no: Optional[int] = None
    is_correct: bool
    explanation: Optional[str] = None
    section_name: str
    mondai_no: int
    mondai_name: Optional[str] = None


class AdminUserJlptAttemptDetail(BaseModel):
    attempt_id: int
    exam_title: str
    level: str
    submitted_at: Optional[datetime] = None
    score: int
    total_questions: int
    answers: List[AdminUserJlptAnswerDetail]


class AdminUserConversationSummary(BaseModel):
    """One conversation in the admin history list — real Conversation +
    Message rows, no fabricated "naturalness score"."""
    id: int
    title: Optional[str] = None
    scenario_title: Optional[str] = None
    scenario_level: Optional[str] = None
    message_count: int  # user turns only
    error_count: int  # sum of graded error_count across this conversation's user turns
    started_at: datetime
    last_message_at: datetime


class AdminUserGrammarErrorType(BaseModel):
    """One error category from the LLM's per-error `explanation.error_type`
    (same freeform classification the learner-facing /correct/stats
    endpoint groups by), with one representative real example."""
    error_type: str
    count: int
    percent: float
    example_original: Optional[str] = None
    example_corrected: Optional[str] = None
    example_why_wrong: Optional[str] = None


class AdminUserConversationDetail(BaseModel):
    total_conversations: int
    total_messages_sent: int  # user turns, all conversations
    total_duration_minutes: int  # sum of (last message - first message) per conversation
    grammar_checks: int  # graded user turns (conversation-linked GrammarCorrection rows)
    total_errors: int
    correct_message_rate: Optional[float] = None  # % of graded turns with zero errors
    off_topic_rate: Optional[float] = None  # % of assistant replies that flagged the user as off-topic
    conversations: List[AdminUserConversationSummary]
    top_error_types: List[AdminUserGrammarErrorType]
    insight_message: Optional[str] = None  # rule-based summary, not model-generated


class AdminUserLookupEntry(BaseModel):
    """One dictionary lookup this user made — a real SearchHistory row, shown
    as-is (not aggregated) for "Lịch sử tra cứu gần đây"."""
    id: int
    word: str
    reading: Optional[str] = None
    meaning: Optional[str] = None
    jlpt: Optional[str] = None
    created_at: datetime


class AdminUserTopWord(BaseModel):
    """A word this user has looked up more than once, most-searched first —
    the closest real signal to "words they keep needing to re-check" (no
    per-word bookmark/notebook feature exists to draw this from instead)."""
    word: str
    reading: Optional[str] = None
    meaning: Optional[str] = None
    jlpt: Optional[str] = None
    search_count: int
    last_searched_at: datetime


class AdminUserJlptLookupBucket(BaseModel):
    """Count of SearchHistory rows at one JLPT level — powers the lookup
    level-distribution bar. Only levels with at least one lookup are
    included, in N1..N5 order with "Không rõ" (no jlpt tag) last."""
    level: str
    count: int
    tone: str  # StatTone on the frontend


class AdminUserListeningVideo(BaseModel):
    """One video transcription/translation session — a real
    TranscriptionSession row. There's no shadowing/dictation scoring
    feature in this codebase, so only fields the session actually stores
    are exposed here."""
    id: int
    video_title: Optional[str] = None
    thumbnail: Optional[str] = None
    channel_title: Optional[str] = None
    source_type: str
    status: str
    status_label: str
    status_tone: str  # StatTone on the frontend
    segment_count: int
    duration_ms: Optional[int] = None
    created_at: datetime


class AdminUserListeningDetail(BaseModel):
    total_lookups: int
    unique_words: int
    lookups_today: int
    video_sessions_total: int
    video_sessions_completed: int
    total_listening_minutes: int  # sum of duration_ms across completed sessions
    recent_lookups: List[AdminUserLookupEntry]
    top_words: List[AdminUserTopWord]
    jlpt_distribution: List[AdminUserJlptLookupBucket]
    videos: List[AdminUserListeningVideo]


class AdminActivityEntry(BaseModel):
    """One row of the audit log — a real, persisted event (see
    app/models/audit_log.py), not a value derived from other tables."""
    id: int
    action: str
    description: str
    actor_role: Optional[str] = None
    created_at: datetime
