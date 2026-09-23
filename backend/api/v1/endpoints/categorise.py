from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from core.database import get_db
from models import ProcessingJob
from services.knowledge import get_knowledge_service

router = APIRouter()

# TF-IDF cosine similarity against a tiny seeded knowledge base is a weak
# signal, not a trained classifier -- these thresholds are deliberately
# conservative rather than tuned to look impressive.
_HIGH_MATCH_THRESHOLD = 0.5
_PARTIAL_MATCH_THRESHOLD = 0.2


def _extracted_answer_text(job: ProcessingJob) -> str:
    """Concatenate whatever OCR text is on the job. Empty string if OCR never
    produced usable text (e.g. OCR libraries missing -> FALLBACK_DETERMINISTIC),
    so the caller can report that honestly instead of scoring garbage."""
    if not job.result_data:
        return ""
    doc_intel = job.result_data.get("documentIntelligence") or {}
    if (doc_intel.get("metadata") or {}).get("status") == "FALLBACK_DETERMINISTIC":
        return ""
    pages = doc_intel.get("pages") or []
    return "\n".join((p.get("text") or "") for p in pages).strip()


@router.post("/{doc_id}/categorise")
def categorise_assessment(doc_id: UUID, db: Session = Depends(get_db)):
    """
    Real categorisation against the local TF-IDF knowledge base
    (services/knowledge.py). Previously this endpoint always returned a
    hardcoded REVIEW REQUIRED / 0.0 confidence regardless of input -- the
    README's claim that "categorisation uses TF-IDF-based local retrieval"
    was not actually true, because KnowledgeService was never called from
    anywhere. This wires it in for real: genuine TF-IDF cosine similarity
    between the OCR'd answer text and the seeded knowledge base, reported
    as the (weak) signal that it is. When OCR text itself isn't available,
    that is still reported honestly rather than scored.
    """
    job = db.query(ProcessingJob).filter(ProcessingJob.id == doc_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Processed document not found")

    answer_text = _extracted_answer_text(job)

    if not answer_text:
        assigned_category = "REVIEW REQUIRED"
        message = "No OCR text available to categorise against."
        confidence_val = 0.0
        best_match = None
    else:
        matches = get_knowledge_service().retrieve(answer_text, top_k=1)
        best_match = matches[0] if matches else None
        confidence_val = round(float(best_match["score"]), 4) if best_match else 0.0

        if confidence_val >= _HIGH_MATCH_THRESHOLD:
            assigned_category = "HIGH MATCH"
            message = f"Closest local knowledge match: {best_match['id']} (TF-IDF similarity {confidence_val:.2f})"
        elif confidence_val >= _PARTIAL_MATCH_THRESHOLD:
            assigned_category = "PARTIAL MATCH"
            message = f"Weak local knowledge match: {best_match['id']} (TF-IDF similarity {confidence_val:.2f})"
        else:
            assigned_category = "REVIEW REQUIRED"
            message = "No strong match against the local TF-IDF knowledge base; needs human review."

    current_data = job.result_data or {}
    current_data["category"] = assigned_category
    current_data["category_confidence"] = confidence_val
    if best_match:
        current_data["category_match"] = {"knowledge_id": best_match["id"], "score": confidence_val}

    job.result_data = current_data
    db.commit()

    return {
        "id": doc_id,
        "category": assigned_category,
        "confidence": confidence_val,
        "message": message
    }
