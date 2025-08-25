"""Add account balances tables

Revision ID: 016_add_account_balances
Revises: fae2d81a9c34
Create Date: 2025-08-25 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016_add_account_balances'
down_revision = 'fae2d81a9c34'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add new columns to accounts table and create account_balances table."""
    
    # Add new columns to accounts table
    with op.batch_alter_table('accounts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('account_subtype', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('iso_currency_code', sa.String(3), nullable=True))
        batch_op.add_column(sa.Column('limit', sa.Numeric(15, 2), nullable=True))
    
    # Update account_type column comment (it now represents asset/liability)
    # Note: SQLite doesn't support comments, but we document the intent here
    
    # Create account_balances table
    op.create_table('account_balances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('as_of', sa.Date(), nullable=False),
        sa.Column('available', sa.Numeric(15, 2), nullable=True),
        sa.Column('current', sa.Numeric(15, 2), nullable=True),
        sa.Column('iso_currency_code', sa.String(3), nullable=True),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('account_id', 'as_of', name='_account_date_uc')
    )
    
    # Create indexes
    with op.batch_alter_table('account_balances', schema=None) as batch_op:
        batch_op.create_index('ix_account_balances_account_id', ['account_id'], unique=False)
        batch_op.create_index('ix_account_balances_as_of', ['as_of'], unique=False)
        batch_op.create_index('ix_account_balances_id', ['id'], unique=False)


def downgrade() -> None:
    """Remove account_balances table and new columns from accounts table."""
    
    # Drop account_balances table
    with op.batch_alter_table('account_balances', schema=None) as batch_op:
        batch_op.drop_index('ix_account_balances_id')
        batch_op.drop_index('ix_account_balances_as_of')
        batch_op.drop_index('ix_account_balances_account_id')
    
    op.drop_table('account_balances')
    
    # Remove new columns from accounts table
    with op.batch_alter_table('accounts', schema=None) as batch_op:
        batch_op.drop_column('limit')
        batch_op.drop_column('iso_currency_code')
        batch_op.drop_column('account_subtype')