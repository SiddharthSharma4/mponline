from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from models import ModerationCase, ModerationDecision, Evaluation, AuditEvent, ReviewSignal

router = APIRouter()

class ModerationResolve(BaseModel):
    decision: str
    adjusted_score: Optional[int] = None
    user_id: Optional[UUID] = None

@router.get("/")
def get_moderation_cases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    cases = db.query(ModerationCase).offset(skip).limit(limit).all()
    return cases

@router.post("/{case_id}/resolve")
def resolve_moderation_case(case_id: UUID, payload: ModerationResolve, db: Session = Depends(get_db)):
    """
    Phase 12: Real moderation resolution.
    """
    case = db.query(ModerationCase).filter(ModerationCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Moderation case not found")
        
    case.status = "RESOLVED"
    
    decision = ModerationDecision(
        moderation_case_id=case.id,
        decision=payload.decision,
        adjusted_score=payload.adjusted_score
    )
    db.add(decision)
    
    # Update evaluation status
    evaluation = db.query(Evaluation).filter(Evaluation.id == case.evaluation_id).first()
    if evaluation:
        evaluation.status = "MODERATED"
        
    # Audit Event
    audit = AuditEvent(
        user_id=payload.user_id,
        action="MODERATION_RESOLVED",
        details={"case_id": str(case_id), "decision": payload.decision, "adjusted_score": payload.adjusted_score}
    )
    db.add(audit)
    
    db.commit()
    
    return {
        "status": "MODERATED",
        "case_id": case_id,
        "moderator_decision": payload.decision,
        "message": "Moderation case resolved and audit event created."
    }
