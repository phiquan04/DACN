"""drop legacy practice test tables

Revision ID: f42f3d6ad254
Revises: 23374053f5fb
Create Date: 2026-09-01 09:18:53.916567

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f42f3d6ad254'
down_revision: Union[str, Sequence[str], None] = '23374053f5fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_table('choices')
    op.drop_table('answers')
    op.drop_table('questions')
    op.drop_table('exams')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        'exams',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('level', sa.String(), nullable=True),
        sa.Column('year', sa.Integer(), nullable=True),
        sa.Column('month', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=True),
        sa.PrimaryKeyConstraint('id', name='exams_pkey'),
    )
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('exam_id', sa.Integer(), nullable=True),
        sa.Column('section', sa.String(), nullable=True),
        sa.Column('question_no', sa.Integer(), nullable=True),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), nullable=True),
        sa.ForeignKeyConstraint(['exam_id'], ['exams.id'], name='questions_exam_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='questions_pkey'),
    )
    op.create_table(
        'choices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=True),
        sa.Column('choice_no', sa.Integer(), nullable=False),
        sa.Column('choice_text', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], name='choices_question_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='choices_pkey'),
    )
    op.create_table(
        'answers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('question_id', sa.Integer(), nullable=True),
        sa.Column('correct_no', sa.Integer(), nullable=False),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], name='answers_question_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='answers_pkey'),
        sa.UniqueConstraint('question_id', name='answers_question_id_key'),
    )
