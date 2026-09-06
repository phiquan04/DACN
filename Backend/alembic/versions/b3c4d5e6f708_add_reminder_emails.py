"""add reminder emails opt-in and reminder times

Revision ID: b3c4d5e6f708
Revises: a7f3c81d94e2
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f708'
down_revision: Union[str, Sequence[str], None] = 'a7f3c81d94e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('reminder_emails_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column('users', 'reminder_emails_enabled', server_default=None)

    op.create_table(
        'reminder_times',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('time_of_day', sa.Time(), nullable=False),
        sa.Column('last_sent_on', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_reminder_times_user_id'), 'reminder_times', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_reminder_times_user_id'), table_name='reminder_times')
    op.drop_table('reminder_times')
    op.drop_column('users', 'reminder_emails_enabled')
