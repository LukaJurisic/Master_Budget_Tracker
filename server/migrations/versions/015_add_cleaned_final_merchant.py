"""Add cleaned_final_merchant column

Revision ID: 015_add_cleaned_final_merchant
Revises: 014_simple_fts
Create Date: 2025-08-24 17:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015_add_cleaned_final_merchant'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add cleaned_final_merchant column to transactions table."""
    # Add the cleaned_final_merchant column
    op.add_column('transactions', sa.Column('cleaned_final_merchant', sa.String(length=255), nullable=True))
    
    # Add an index for the new column
    op.create_index('ix_transactions_cleaned_final_merchant', 'transactions', ['cleaned_final_merchant'])


def downgrade() -> None:
    """Remove cleaned_final_merchant column from transactions table."""
    # Drop the index first
    op.drop_index('ix_transactions_cleaned_final_merchant', table_name='transactions')
    
    # Drop the column
    op.drop_column('transactions', 'cleaned_final_merchant')