from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from .base import BaseModel


class EmailVerificationCode(BaseModel):
    """One issued email-verification OTP. Only a hash of the code is stored —
    the plaintext lives just long enough to be put in the outgoing email — so
    read access to this table never reveals a usable code.

    A row is single-use: `consumed_at` is stamped on a successful confirm, and
    `attempts` caps how many wrong guesses one code tolerates before it is
    burned (see services/email_verification.py for the limits)."""
    __tablename__ = 'email_verification_codes'

    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    code_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)  # set once the code is successfully used
    attempts = Column(Integer, nullable=False, default=0)  # wrong guesses so far against this code

    def __repr__(self):
        return f'<EmailVerificationCode user={self.user_id} expires={self.expires_at}>'
