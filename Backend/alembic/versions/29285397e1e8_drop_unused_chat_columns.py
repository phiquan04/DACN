"""drop unused chat columns

Revision ID: 29285397e1e8
Revises: ef5cc2b18183
Create Date: 2026-08-26 23:20:08.678735

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '29285397e1e8'
down_revision: Union[str, Sequence[str], None] = 'ef5cc2b18183'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('conversations', 'language')
    op.drop_column('messages', 'confidence')
    op.drop_column('messages', 'language')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('messages', sa.Column('language', sa.VARCHAR(length=10), autoincrement=False, nullable=True))
    op.add_column('messages', sa.Column('confidence', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=True))
    op.add_column('conversations', sa.Column('language', sa.VARCHAR(length=10), autoincrement=False, nullable=True))
