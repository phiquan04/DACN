"""add user account status and profile learning fields

Revision ID: 8cda678c61f7
Revises: f4a5b6c7d829
Create Date: 2026-08-31 09:38:57.467390

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '8cda678c61f7'
down_revision: Union[str, Sequence[str], None] = 'f4a5b6c7d829'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user_information', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('user_information', sa.Column('gender', sa.String(length=10), nullable=True))
    op.add_column('user_information', sa.Column('current_jlpt_level', sa.String(length=10), nullable=True))
    op.add_column('user_information', sa.Column('target_jlpt_level', sa.String(length=10), nullable=True))
    op.add_column('user_information', sa.Column('streak_days', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('user_information', sa.Column('last_activity_at', sa.DateTime(), nullable=True))
    op.add_column('user_information', sa.Column('total_study_minutes', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('locked_reason', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('locked_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'locked_at')
    op.drop_column('users', 'locked_reason')
    op.drop_column('users', 'last_login_at')
    op.drop_column('user_information', 'total_study_minutes')
    op.drop_column('user_information', 'last_activity_at')
    op.drop_column('user_information', 'streak_days')
    op.drop_column('user_information', 'target_jlpt_level')
    op.drop_column('user_information', 'current_jlpt_level')
    op.drop_column('user_information', 'gender')
    op.drop_column('user_information', 'date_of_birth')
