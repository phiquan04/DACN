"""extend grammar_corrections for standalone history

Revision ID: ef5cc2b18183
Revises: 1ebbf62e17ac
Create Date: 2026-08-26 11:57:31.862654

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ef5cc2b18183'
down_revision: Union[str, Sequence[str], None] = '1ebbf62e17ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('grammar_corrections', sa.Column('user_id', sa.Integer(), nullable=True))
    op.add_column('grammar_corrections', sa.Column('explanation', sa.JSON(), nullable=True))
    op.add_column('grammar_corrections', sa.Column('alternatives', sa.JSON(), nullable=True))
    op.alter_column('grammar_corrections', 'message_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.create_foreign_key(None, 'grammar_corrections', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'grammar_corrections', type_='foreignkey')
    op.alter_column('grammar_corrections', 'message_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.drop_column('grammar_corrections', 'alternatives')
    op.drop_column('grammar_corrections', 'explanation')
    op.drop_column('grammar_corrections', 'user_id')
