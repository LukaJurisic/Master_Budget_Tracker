"""Add external integrations table for crypto exchanges

Revision ID: 017_add_external_integrations
Revises: 016_add_account_balances
Create Date: 2025-08-25 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017_add_external_integrations'
down_revision = 'd3cd29b45ed7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create external_integrations table."""
    
    # Create external_integrations table
    op.create_table('external_integrations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('provider', sa.Enum('NDAX', 'BINANCE', 'COINBASE', 'KRAKEN', name='providertype'), nullable=False),
        sa.Column('api_key_encrypted', sa.Text(), nullable=False),
        sa.Column('api_secret_encrypted', sa.Text(), nullable=False),
        sa.Column('uid_encrypted', sa.Text(), nullable=True),
        sa.Column('label', sa.String(255), nullable=True),
        sa.Column('last_refresh', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='1'),
        sa.Column('cached_balances', sa.Text(), nullable=True),
        sa.Column('cache_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    with op.batch_alter_table('external_integrations', schema=None) as batch_op:
        batch_op.create_index('ix_external_integrations_id', ['id'], unique=False)
        batch_op.create_index('ix_external_integrations_provider', ['provider'], unique=False)
        batch_op.create_index('ix_external_integrations_is_active', ['is_active'], unique=False)


def downgrade() -> None:
    """Remove external_integrations table."""
    
    # Drop indexes
    with op.batch_alter_table('external_integrations', schema=None) as batch_op:
        batch_op.drop_index('ix_external_integrations_is_active')
        batch_op.drop_index('ix_external_integrations_provider')
        batch_op.drop_index('ix_external_integrations_id')
    
    # Drop table
    op.drop_table('external_integrations')
    
    # Drop enum type if using PostgreSQL (SQLite doesn't have this)
    # op.execute("DROP TYPE IF EXISTS providertype")