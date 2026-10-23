"""add grammar content bank tables

Revision ID: d4e5f6a7b809
Revises: a7c1e94d2b36
Create Date: 2026-09-06 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b809'
down_revision: Union[str, Sequence[str], None] = 'a7c1e94d2b36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('grammar_categories',
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name'),
    sa.UniqueConstraint('slug')
    )
    op.create_table('grammar_curriculums',
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('grammar_sets',
    sa.Column('curriculum_id', sa.Integer(), nullable=True),
    sa.Column('category_id', sa.Integer(), nullable=True),
    sa.Column('level', sa.String(length=10), nullable=False),
    sa.Column('set_name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('is_locked', sa.Boolean(), nullable=False),
    sa.Column('source_filename', sa.String(length=255), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('item_count', sa.Integer(), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.Column('published_at', sa.DateTime(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['category_id'], ['grammar_categories.id'], ),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['curriculum_id'], ['grammar_curriculums.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('grammar_points',
    sa.Column('set_id', sa.Integer(), nullable=False),
    sa.Column('order_no', sa.Integer(), nullable=False),
    sa.Column('pattern', sa.String(length=200), nullable=False),
    sa.Column('meaning_vi', sa.String(length=500), nullable=False),
    sa.Column('usage_note', sa.Text(), nullable=True),
    sa.Column('examples', sa.JSON(), nullable=False),
    sa.Column('admin_notes', sa.Text(), nullable=True),
    sa.Column('is_meaning_ai_generated', sa.Boolean(), nullable=False),
    sa.Column('is_example_ai_generated', sa.Boolean(), nullable=False),
    sa.Column('is_reviewed', sa.Boolean(), nullable=False),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['set_id'], ['grammar_sets.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('grammar_points')
    op.drop_table('grammar_sets')
    op.drop_table('grammar_curriculums')
    op.drop_table('grammar_categories')
