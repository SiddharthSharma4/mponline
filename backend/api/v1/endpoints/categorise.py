from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
import random
import json

from core.database import get_db
from models import ProcessingJob

router = APIRouter()

@router.post("/{doc_id}/categorise")
def categorise_assessment(doc_id: UUID, db: Session = Depends(get_db)):
    """
    Phase 7: Real application logic for categorising a specific processed document.
    HIGH MATCH, PARTIAL MATCH, LOW MATCH / REVIEW.
    """
    job = db.query(ProcessingJob).filter(ProcessingJob.id == doc_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Processed document not found")
        
    # Extract actual stats from the OCR ProcessingJob
    pages_processed = job.result_data.get("stats", {}).get("pagesProcessed", 0) if job.result_data else 0
    
    # Semantic model is unavailable locally (PyTorch download failed)
    # Return honest state instead of faking semantic categorisation
    assigned_category = "REVIEW REQUIRED"
    message = "SEMANTIC MODEL UNAVAILABLE"
    confidence_val = 0.0
    
    # Store categorisation in result_data
    current_data = job.result_data or {}
    current_data["category"] = assigned_category
    
    # Store the actual confidence
    current_data["category_confidence"] = confidence_val
    
    job.result_data = current_data
    db.commit()
    
    return {
        "id": doc_id,
        "category": assigned_category,
        "confidence": confidence_val,
        "message": message
    }
