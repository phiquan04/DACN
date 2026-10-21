"""add grammar exercise and progress tables

Revision ID: d8dcaba9efa4
Revises: d4e5f6a7b809
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd8dcaba9efa4'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b809'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('grammar_exercises',
    sa.Column('grammar_point_id', sa.Integer(), nullable=False),
    sa.Column('type', sa.String(length=10), nullable=False),
    sa.Column('prompt', sa.Text(), nullable=False),
    sa.Column('correct_answer', sa.String(length=500), nullable=False),
    sa.Column('choices', sa.JSON(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['grammar_point_id'], ['grammar_points.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('grammar_point_progress',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('grammar_point_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('ease_factor', sa.Float(), nullable=False),
    sa.Column('interval_days', sa.Integer(), nullable=False),
    sa.Column('review_count', sa.Integer(), nullable=False),
    sa.Column('due_at', sa.DateTime(), nullable=True),
    sa.Column('last_reviewed_at', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['grammar_point_id'], ['grammar_points.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'grammar_point_id', name='uq_grammar_progress_user_point')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('grammar_point_progress')
    op.drop_table('grammar_exercises')
