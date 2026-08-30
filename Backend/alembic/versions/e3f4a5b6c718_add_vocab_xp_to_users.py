"""add vocab_xp to users

Revision ID: e3f4a5b6c718
Revises: d2b3c4e5f607
Create Date: 2026-08-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e3f4a5b6c718'
down_revision: Union[str, Sequence[str], None] = 'd2b3c4e5f607'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('vocab_xp', sa.Integer(), nullable=False, server_default='0'))
    op.alter_column('users', 'vocab_xp', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'vocab_xp')
