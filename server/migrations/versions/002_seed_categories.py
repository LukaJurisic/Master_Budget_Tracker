"""Seed initial categories

Revision ID: 002
Revises: 
Create Date: 2024-01-01 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '002'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create a connection
    connection = op.get_bind()
    
    # Define initial categories
    categories_data = [
        # Top-level categories
        (1, 'Housing', None, '#FF6B6B'),
        (2, 'Food', None, '#4ECDC4'),
        (3, 'Transportation', None, '#45B7D1'),
        (4, 'Shopping', None, '#96CEB4'),
        (5, 'Entertainment', None, '#FFEAA7'),
        (6, 'Health & Medical', None, '#DDA0DD'),
        (7, 'Finance', None, '#98D8C8'),
        (8, 'Travel', None, '#74B9FF'),
        (9, 'Utilities', None, '#FDCB6E'),
        (10, 'Income', None, '#55A3FF'),
        (11, 'Subscriptions', None, '#FD79A8'),
        (12, 'Education', None, '#A29BFE'),
        
        # Housing subcategories
        (13, 'Rent/Mortgage', 1, None),
        (14, 'Property Tax', 1, None),
        (15, 'Home Insurance', 1, None),
        (16, 'Maintenance & Repairs', 1, None),
        (17, 'Home Improvement', 1, None),
        
        # Food subcategories
        (18, 'Groceries', 2, None),
        (19, 'Dining Out', 2, None),
        (20, 'Coffee & Beverages', 2, None),
        (21, 'Delivery & Takeout', 2, None),
        
        # Transportation subcategories
        (22, 'Gas', 3, None),
        (23, 'Public Transit', 3, None),
        (24, 'Car Insurance', 3, None),
        (25, 'Car Maintenance', 3, None),
        (26, 'Parking', 3, None),
        (27, 'Rideshare', 3, None),
        
        # Shopping subcategories
        (28, 'Clothing', 4, None),
        (29, 'Electronics', 4, None),
        (30, 'Home & Garden', 4, None),
        (31, 'Books & Media', 4, None),
        (32, 'Gifts', 4, None),
        
        # Entertainment subcategories
        (33, 'Movies & Shows', 5, None),
        (34, 'Sports & Recreation', 5, None),
        (35, 'Hobbies', 5, None),
        (36, 'Gaming', 5, None),
        
        # Health & Medical subcategories
        (37, 'Doctor Visits', 6, None),
        (38, 'Dental', 6, None),
        (39, 'Pharmacy', 6, None),
        (40, 'Health Insurance', 6, None),
        (41, 'Fitness', 6, None),
        
        # Finance subcategories
        (42, 'Bank Fees', 7, None),
        (43, 'Investment Fees', 7, None),
        (44, 'Credit Card Fees', 7, None),
        (45, 'Insurance (Other)', 7, None),
        
        # Utilities subcategories
        (46, 'Electricity', 9, None),
        (47, 'Gas & Heating', 9, None),
        (48, 'Water', 9, None),
        (49, 'Internet', 9, None),
        (50, 'Phone', 9, None),
        
        # Income subcategories
        (51, 'Salary', 10, None),
        (52, 'Freelance', 10, None),
        (53, 'Investment Income', 10, None),
        (54, 'Other Income', 10, None),
        
        # Subscriptions subcategories
        (55, 'Streaming Services', 11, None),
        (56, 'Software', 11, None),
        (57, 'News & Magazines', 11, None),
        (58, 'Cloud Storage', 11, None),
    ]
    
    # Insert categories
    for cat_id, name, parent_id, color in categories_data:
        connection.execute(
            sa.text("""
                INSERT INTO categories (id, name, parent_id, color, created_at) 
                VALUES (:id, :name, :parent_id, :color, :created_at)
            """),
            {
                'id': cat_id,
                'name': name,
                'parent_id': parent_id,
                'color': color,
                'created_at': datetime.utcnow()
            }
        )


def downgrade() -> None:
    # Remove all seeded categories
    connection = op.get_bind()
    connection.execute(sa.text("DELETE FROM categories WHERE id <= 58"))















