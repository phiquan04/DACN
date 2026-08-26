"""add kanji to search_history

Revision ID: 1ebbf62e17ac
Revises: 740656ac1d5b
Create Date: 2026-08-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ebbf62e17ac'
down_revision: Union[str, Sequence[str], None] = '740656ac1d5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('search_history', sa.Column('kanji', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('search_history', 'kanji')
