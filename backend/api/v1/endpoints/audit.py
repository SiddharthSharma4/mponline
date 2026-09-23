from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from uuid import UUID

from core.database import get_db
from models import AuditEvent

router = APIRouter()

@router.get("/{entity_id}")
def get_audit_trail(entity_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the verifiable audit trail for a specific script/evaluation.
    Searches for the entity_id in the details JSON.
    """
    # SQLite/Postgres JSON path queries are complex, for now we will load all and filter or 
    # we can do a naive text search. Let's do a basic ILIKE search as a fallback if JSON path isn't easy.
    # We cast details to string to search for the entity_id.
    
    events = db.query(AuditEvent).filter(
        AuditEvent.details.cast(str).ilike(f"%{entity_id}%")
    ).order_by(AuditEvent.created_at.asc()).all()
    
    formatted_events = []
    for ev in events:
        formatted_events.append({
            "timestamp": ev.created_at.isoformat() if ev.created_at else None,
            "actor": str(ev.user_id) if ev.user_id else "System",
            "action": ev.action,
            "details": ev.details,
            "hash": str(ev.id)[:12] # Mocking hash with UUID
        })
        
    return {
        "entity_id": entity_id,
        "events": formatted_events
    }
