"""Audit log model for tracking system changes."""
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from ..core.db import Base


class AuditLog(Base):
    """Audit log for tracking system actions."""
    
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True)  # UUID
    action = Column(String(100), nullable=False)
    payload_json = Column(Text)  # JSON string of relevant data (redacted)
    ts = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, ts={self.ts})>"










