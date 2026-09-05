from sqlalchemy import Column, ForeignKey, Index, Integer, String, Text

from .base import BaseModel


class AuditLog(BaseModel):
    """A single audited event — either an admin action performed on a user's
    account (create/edit/lock/unlock/reset-password) or a learner's own
    activity (login, daily vocab goal reached, achievement unlocked, AI
    conversation started, JLPT test completed). Powers the "Hoạt động gần
    đây" feed on the admin user-detail page and the future dedicated audit
    log tab.

    `actor_user_id` is who performed the action; `subject_user_id` is whose
    account/activity it concerns. For a learner's own activity the two are
    the same user; for an admin action on someone else's account they
    differ. `description` is pre-rendered Vietnamese text (not built from
    `action` at read time) so the feed never needs an i18n lookup table."""
    __tablename__ = 'audit_logs'

    actor_user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    actor_role = Column(String(20), nullable=True)  # role snapshot at write time: 'admin' | 'user'
    subject_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String(50), nullable=False)  # machine code, e.g. 'admin.user_locked', 'vocab.daily_goal_met'
    description = Column(String(255), nullable=False)
    extra_data = Column(Text, nullable=True)  # optional JSON blob with event-specific details (reason, score, ...)

    __table_args__ = (
        Index('ix_audit_logs_subject_created', 'subject_user_id', 'created_at'),
    )

    def __repr__(self):
        return f'<AuditLog action={self.action} subject={self.subject_user_id}>'
