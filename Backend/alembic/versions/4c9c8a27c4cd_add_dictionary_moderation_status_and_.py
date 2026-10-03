"""add dictionary moderation status and image votes

Revision ID: 4c9c8a27c4cd
Revises: b3c4d5e6f708
Create Date: 2026-09-06 21:25:08.645717

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c9c8a27c4cd'
down_revision: Union[str, Sequence[str], None] = 'b3c4d5e6f708'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # NOTE: create_table('dictionary_image_votes') below was added by hand —
    # autogenerate didn't propose it because a --reload dev server had
    # already create_all()'d the table against this DB before this revision
    # was generated. Kept here (mirroring dictionary_comment_votes in
    # 740656ac1d5b_baseline.py) so a database that never ran that dev
    # server still ends up with the table.
    #
    # Guarded for the opposite case: init_db() runs create_all on every app
    # startup, so any database whose backend was started on the new code
    # before `alembic upgrade head` already has this table. An unconditional
    # create_table would fail there with "relation already exists" and take
    # the two add_column calls below down with it.
    if not sa.inspect(op.get_bind()).has_table('dictionary_image_votes'):
        op.create_table(
            'dictionary_image_votes',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('image_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('vote_type', sa.String(length=4), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['image_id'], ['dictionary_images.id'], ),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('image_id', 'user_id', name='uq_image_vote_user'),
        )
    op.add_column('dictionary_comments', sa.Column('status', sa.String(length=20), server_default='pending', nullable=False))
    op.add_column('dictionary_images', sa.Column('status', sa.String(length=20), server_default='pending', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('dictionary_images', 'status')
    op.drop_column('dictionary_comments', 'status')
    op.drop_table('dictionary_image_votes')
