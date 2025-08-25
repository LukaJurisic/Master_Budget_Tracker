"""add_txn_type_and_income_categories

Revision ID: 1ea3c9c66d03
Revises: fae2d81a9c34
Create Date: 2025-08-17 17:54:28.777952

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '1ea3c9c66d03'
down_revision = 'fae2d81a9c34'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add txn_type column to transactions table with default 'expense'
    try:
        op.add_column('transactions', sa.Column('txn_type', sa.String(10), nullable=False, server_default='expense'))
    except:
        pass  # Column may already exist
    
    # Backfill existing rows to 'expense'
    connection = op.get_bind()
    connection.execute(text("UPDATE transactions SET txn_type = 'expense' WHERE txn_type IS NULL"))
    
    # Create index on (txn_type, posted_date) for performance
    try:
        op.create_index('ix_transactions_txn_type_date', 'transactions', ['txn_type', 'posted_date'])
    except:
        pass  # Index may already exist
    
    # Seed Income categories if they don't exist
    connection.execute(text("""
        INSERT OR IGNORE INTO categories (name, parent_id, color, created_at, updated_at)
        SELECT 'Income', NULL, '#4CAF50', datetime('now'), datetime('now')
        WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Income' AND parent_id IS NULL)
    """))
    
    # Get the Income parent category ID
    result = connection.execute(text("SELECT id FROM categories WHERE name = 'Income' AND parent_id IS NULL")).fetchone()
    if result:
        income_parent_id = result[0]
        
        # Insert income subcategories
        subcategories = [
            ('Primary Job', '#66BB6A'),
            ('Bonus', '#81C784'),
            ('Family Income', '#A5D6A7'),
            ('Investment Income', '#C8E6C9'),
            ('Other Income', '#E8F5E9')
        ]
        
        for name, color in subcategories:
            connection.execute(text("""
                INSERT OR IGNORE INTO categories (name, parent_id, color, created_at, updated_at)
                SELECT :name, :parent_id, :color, datetime('now'), datetime('now')
                WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = :name AND parent_id = :parent_id)
            """), {"name": name, "parent_id": income_parent_id, "color": color})


def downgrade() -> None:
    # Remove index
    try:
        op.drop_index('ix_transactions_txn_type_date', 'transactions')
    except:
        pass
    
    # Remove txn_type column
    try:
        op.drop_column('transactions', 'txn_type')
    except:
        pass

