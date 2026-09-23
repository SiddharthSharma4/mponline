import re
import statistics
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from core.database import get_db
from models import (
    Evaluation, Mark, ReviewSignal, ModerationCase,
    AnswerScript, Assessment, QuestionSection, Question
)
from services.ml import get_anomaly_detector

router = APIRouter()
anomaly_detector = get_anomaly_detector()
logger = logging.getLogger(__name__)


def _question_label(question: Question, fallback_index: int) -> str:
    match = re.search(r"(\d+)", question.text or "")
    number = int(match.group(1)) if match else fallback_index
    return f"Q{number:02d}"


def _ordered_questions_for_assessment(db: Session, assessment_id):
    questions = (
        db.query(Question)
        .join(QuestionSection, Question.section_id == QuestionSection.id)
        .filter(QuestionSection.assessment_id == assessment_id)
        .all()
    )
    def sort_key(q):
        match = re.search(r"(\d+)", q.text or "")
        return int(match.group(1)) if match else 0
    return sorted(questions, key=sort_key)


@router.post("/{evaluation_id}/verify")
def verify_evaluation(evaluation_id: UUID, db: Session = Depends(get_db)):
    """
    Real post-evaluation integrity checks, derived entirely from persisted
    data -- no frontend-supplied flags are trusted:

      1. Every real question belonging to the evaluation's assessment must
         have a real Mark row. Any question without one produces a
         NOT_EVALUATED signal naming that actual question.
      2. If the examiner recorded a ledger total (stored as the sentinel
         Mark with question_id IS NULL), it is compared against the real
         computed sum of question marks. A mismatch produces a
         TOTAL_MISMATCH signal with the real numbers.
      3. The anomaly-detection model (services/ml.py) is run against real
         features derived from the persisted marks -- previously this
         model was instantiated at module load but never actually called,
         so it never contributed anything. It can now add an informational
         ML_ANOMALY signal. If the model is unavailable (e.g. ENV=production
         without a real model artifact configured), that is logged and
         skipped rather than crashing the whole verification request.

    Every signal carries a `blocking` flag. Only blocking signals gate the
    result and open a moderation case -- previously this flag was set on
    each signal but never actually read anywhere, so ANY signal (including
    a purely informational one) forced REVIEW_REQUIRED and a moderation
    case. Non-blocking signals are still persisted as ReviewSignal rows for
    the analytics/audit trail.
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        return {
            "status": "REVIEW_REQUIRED",
            "signals": [{
                "type": "NO_EVALUATION",
                "question": None,
                "message": "No evaluation has been recorded yet for this script.",
                "blocking": True
            }],
            "case_id": None
        }

    answer_script = db.query(AnswerScript).filter(AnswerScript.id == evaluation.answer_script_id).first()
    if not answer_script or not answer_script.assessment_id:
        raise HTTPException(status_code=400, detail="Evaluation is not linked to a real assessment.")

    questions = _ordered_questions_for_assessment(db, answer_script.assessment_id)
    marks = db.query(Mark).filter(Mark.evaluation_id == evaluation.id).all()
    marks_by_question = {str(m.question_id): m.score for m in marks if m.question_id is not None}
    recorded_total_row = next((m for m in marks if m.question_id is None), None)

    signals = []

    for idx, q in enumerate(questions):
        if str(q.id) not in marks_by_question:
            signals.append({
                "type": "NOT_EVALUATED",
                "question": _question_label(q, idx + 1),
                "question_id": str(q.id),
                "message": f"{_question_label(q, idx + 1)} was not evaluated. Please mark the answer.",
                "blocking": True
            })

    computed_total = sum(marks_by_question.values())
    has_total_mismatch = recorded_total_row is not None and recorded_total_row.score != computed_total
    if has_total_mismatch:
        signals.append({
            "type": "TOTAL_MISMATCH",
            "question": None,
            "message": f"Recorded total {recorded_total_row.score} does not match computed total {computed_total} from individual question marks.",
            "blocking": True
        })

    if marks_by_question:
        mark_values = list(marks_by_question.values())
        mark_variance = statistics.pvariance(mark_values) if len(mark_values) > 1 else 0.0
        elapsed_minutes = (
            max((datetime.utcnow() - evaluation.created_at).total_seconds() / 60.0, 0.0)
            if evaluation.created_at else 15.0
        )
        anomaly_result = None
        try:
            anomaly_result = anomaly_detector.predict({
                "q04_discrepancy": 1.0 if has_total_mismatch else 0.0,
                "evaluation_time_mins": elapsed_minutes,
                "mark_variance": mark_variance,
            })
        except Exception as e:
            logger.warning(f"Anomaly detector unavailable, skipping ML_ANOMALY check for evaluation {evaluation.id}: {e}")

        if anomaly_result and anomaly_result.get("review_required"):
            signals.append({
                "type": "ML_ANOMALY",
                "question": None,
                "message": (
                    f"Anomaly model ({anomaly_result['model_version']}) flagged this evaluation "
                    f"(severity {anomaly_result['severity']}, score {anomaly_result['anomaly_score']:.3f})."
                ),
                "blocking": False
            })

    blocking_signals = [s for s in signals if s.get("blocking")]
    status = "REVIEW_REQUIRED" if blocking_signals else "VERIFIED"
    case_id = None

    for sig in signals:
        db.add(ReviewSignal(evaluation_id=evaluation.id, reason=f"{sig['type']}: {sig['message']}"))

    if blocking_signals:
        evaluation.status = "REVIEW_REQUIRED"
        case = (
            db.query(ModerationCase)
            .filter(ModerationCase.evaluation_id == evaluation.id, ModerationCase.status == "OPEN")
            .first()
        )
        if not case:
            case = ModerationCase(evaluation_id=evaluation.id, status="OPEN")
            db.add(case)
        db.commit()
        db.refresh(case)
        case_id = str(case.id)
    else:
        evaluation.status = "VERIFIED"
        # Real elapsed marking time, now that the evaluation is clean.
        # Previously evaluation_time_mins was only ever set by the legacy
        # POST /evaluation/ endpoint, which the real session-based golden
        # path never calls -- so analytics.py's average_evaluation_time_mins
        # was always 0 for every real evaluation. This gives it real data.
        if evaluation.created_at:
            evaluation.evaluation_time_mins = max(
                int(round((datetime.utcnow() - evaluation.created_at).total_seconds() / 60.0)), 0
            )
        db.commit()

    return {
        "status": status,
        "signals": signals,
        "case_id": case_id
    }
