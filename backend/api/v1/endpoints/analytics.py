from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any

from core.database import get_db
from models import AnswerScript, Evaluation, ReviewSignal, ModerationCase

router = APIRouter()

@router.get("/dashboard")
def get_analytics_dashboard(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Phase 16: Analytics API
    Provides aggregated statistics for the Institutional Dashboard based on DB data.
    """
    total_scripts = db.query(func.count(AnswerScript.id)).scalar()
    
    # Status breakdown
    # Since script status is driven by evaluation, we'll count evaluation statuses.
    # We might have multiple evaluations per script, but for simplicity we'll just count evaluations.
    evaluations = db.query(Evaluation.status, func.count(Evaluation.id)).group_by(Evaluation.status).all()
    status_counts = {status: count for status, count in evaluations}
    
    scripts_evaluated = sum(count for status, count in status_counts.items() if status in ["EVALUATED", "VERIFIED", "REVIEW_REQUIRED", "MODERATED", "RESULT_READY"])
    pending = status_counts.get("PENDING", 0) # Assuming some start in PENDING
    verified = status_counts.get("VERIFIED", 0)
    moderated = status_counts.get("MODERATED", 0)
    result_ready = status_counts.get("RESULT_READY", 0)
    blocked = status_counts.get("REVIEW_REQUIRED", 0)
    
    # Examiner stats
    avg_eval_time = db.query(func.avg(Evaluation.evaluation_time_mins)).scalar() or 0.0
    review_signals_count = db.query(func.count(ReviewSignal.id)).scalar()
    
    # Anomaly stats
    total_signals = db.query(func.count(ReviewSignal.id)).scalar() or 1 # avoid div zero
    q04_signals = db.query(func.count(ReviewSignal.id)).filter(ReviewSignal.reason.ilike("%total%")).scalar()
    
    return {
        "assessment": {
            "scripts_received": total_scripts,
            "scripts_evaluated": scripts_evaluated,
            "pending": pending,
            "blocked": blocked,
            "verified": verified,
            "moderated": moderated,
            "result_ready": result_ready
        },
        "examiner": {
            "average_evaluation_time_mins": round(float(avg_eval_time), 2),
            "review_signals_generated": review_signals_count
        },
        "anomalies": {
            "q04_discrepancy_rate": round(q04_signals / total_signals, 2) if total_signals > 0 else 0,
            "unanswered_rate": 0.0 # Placeholder
        }
    }
