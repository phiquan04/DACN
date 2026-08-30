"""add vocabulary learning progress and review log tables

Revision ID: c1a2b3d4e5f6
Revises: 7ba223ff71e6
Create Date: 2026-08-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '7ba223ff71e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('vocabulary_item_progress',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('is_bookmarked', sa.Boolean(), nullable=False),
    sa.Column('ease_factor', sa.Float(), nullable=False),
    sa.Column('interval_days', sa.Integer(), nullable=False),
    sa.Column('review_count', sa.Integer(), nullable=False),
    sa.Column('due_at', sa.DateTime(), nullable=True),
    sa.Column('last_reviewed_at', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['item_id'], ['vocabulary_items.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'item_id', name='uq_vocab_progress_user_item')
    )
    op.create_table('vocabulary_review_logs',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('item_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.String(length=10), nullable=False),
    sa.Column('reviewed_at', sa.DateTime(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['item_id'], ['vocabulary_items.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('vocabulary_review_logs')
    op.drop_table('vocabulary_item_progress')
