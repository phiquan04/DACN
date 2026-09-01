"""drop facebook_link and instagram_link from user_information

Revision ID: 23374053f5fb
Revises: 8cda678c61f7
Create Date: 2026-08-31 15:10:36.818077

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '23374053f5fb'
down_revision: Union[str, Sequence[str], None] = '8cda678c61f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('user_information', 'facebook_link')
    op.drop_column('user_information', 'instagram_link')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('user_information', sa.Column('instagram_link', sa.VARCHAR(length=255), autoincrement=False, nullable=True))
    op.add_column('user_information', sa.Column('facebook_link', sa.VARCHAR(length=255), autoincrement=False, nullable=True))
