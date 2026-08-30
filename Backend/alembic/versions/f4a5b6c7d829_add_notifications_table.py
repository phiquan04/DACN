"""add notifications table

Revision ID: f4a5b6c7d829
Revises: e3f4a5b6c718
Create Date: 2026-08-31 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d829'
down_revision: Union[str, Sequence[str], None] = 'e3f4a5b6c718'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notifications',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=30), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('link', sa.String(length=255), nullable=True),
        sa.Column('related_code', sa.String(length=50), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.alter_column('notifications', 'is_read', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('notifications')
