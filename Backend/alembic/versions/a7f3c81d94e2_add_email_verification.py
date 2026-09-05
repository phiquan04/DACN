"""add email verification

Revision ID: a7f3c81d94e2
Revises: 29b6f426ba17
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a7f3c81d94e2'
down_revision: Union[str, Sequence[str], None] = '29b6f426ba17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # init_db() runs Base.metadata.create_all on every startup, so a dev whose
    # server restarted after the model was added already has the new *table*
    # (create_all never touches existing tables, so the users column is still
    # missing). Both steps below are therefore guarded rather than assumed.
    inspector = sa.inspect(op.get_bind())

    user_columns = {c['name'] for c in inspector.get_columns('users')}
    if 'email_verified' not in user_columns:
        # Added as nullable first so the existing rows can be backfilled before
        # the NOT NULL constraint goes on — adding a NOT NULL column to a
        # populated table in one step fails on Postgres without a default.
        op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=True))

        # Accounts that predate this feature were never asked to verify, so
        # mark them verified rather than retroactively flagging every existing
        # learner as unverified. Only signups from here on start at False.
        op.execute('UPDATE users SET email_verified = true')

        op.alter_column(
            'users', 'email_verified',
            existing_type=sa.Boolean(), nullable=False, server_default=sa.false(),
        )

    if 'email_verification_codes' not in inspector.get_table_names():
        op.create_table(
            'email_verification_codes',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('code_hash', sa.String(length=255), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('consumed_at', sa.DateTime(), nullable=True),
            sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
        )

    existing_indexes = {
        i['name'] for i in inspector.get_indexes('email_verification_codes')
    } if 'email_verification_codes' in inspector.get_table_names() else set()
    if 'ix_email_verification_codes_user_id' not in existing_indexes:
        op.create_index(
            op.f('ix_email_verification_codes_user_id'),
            'email_verification_codes', ['user_id'], unique=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f('ix_email_verification_codes_user_id'), table_name='email_verification_codes',
    )
    op.drop_table('email_verification_codes')
    op.drop_column('users', 'email_verified')
