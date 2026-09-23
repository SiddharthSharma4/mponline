from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID

from core.database import get_db
from models import (
    Evaluation, Mark, AnswerScript, Candidate, Examiner, Assessment,
    ReviewSignal, ModerationCase, AuditEvent
)

router = APIRouter()


class MarkInput(BaseModel):
    question_id: UUID
    score: int
    criterion_id: Optional[UUID] = None


class EvaluationSubmit(BaseModel):
    examiner_id: UUID
    answer_script_id: UUID
    evaluation_time_mins: int
    marks: List[MarkInput]
    status: str = "EVALUATED"


class EvaluationOut(BaseModel):
    id: UUID
    answer_script_id: UUID
    examiner_id: UUID
    status: str
    evaluation_time_mins: Optional[int]

    class Config:
        orm_mode = True


class QuestionMarkInput(BaseModel):
    assessment_id: UUID
    question_id: UUID
    score: int


class RecordedTotalInput(BaseModel):
    assessment_id: UUID
    recorded_total: int


def _get_or_create_session_evaluation(db: Session, assessment_id: UUID) -> Evaluation:
    """
    Get-or-create the single in-progress Evaluation for this assessment's
    session candidate/answer-script. There is no login/session system in this
    build, so a stable placeholder Examiner and Candidate are used to carry a
    real evaluation through the golden path -- these are real persisted rows,
    not per-request fabrication, and are reused across calls (identified by
    stable natural keys) rather than duplicated.
    """
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    examiner = db.query(Examiner).first()
    if not examiner:
        examiner = Examiner(user_id=None)
        db.add(examiner)
        db.commit()
        db.refresh(examiner)

    candidate = (
        db.query(Candidate)
        .filter(Candidate.assessment_id == assessment_id, Candidate.candidate_identifier == "SESSION-CANDIDATE")
        .first()
    )
    if not candidate:
        candidate = Candidate(assessment_id=assessment_id, candidate_identifier="SESSION-CANDIDATE")
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

    answer_script = (
        db.query(AnswerScript)
        .filter(AnswerScript.candidate_id == candidate.id, AnswerScript.assessment_id == assessment_id)
        .first()
    )
    if not answer_script:
        answer_script = AnswerScript(candidate_id=candidate.id, assessment_id=assessment_id)
        db.add(answer_script)
        db.commit()
        db.refresh(answer_script)

    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.answer_script_id == answer_script.id)
        .filter(Evaluation.status.notin_(["MODERATED", "RESULT_READY"]))
        .order_by(Evaluation.created_at.desc())
        .first()
    )
    if not evaluation:
        evaluation = Evaluation(answer_script_id=answer_script.id, examiner_id=examiner.id, status="IN_PROGRESS")
        db.add(evaluation)
        db.commit()
        db.refresh(evaluation)

    return evaluation


def _evaluation_marks_map(db: Session, evaluation_id: UUID):
    """Real per-question marks (question_id IS NOT NULL) plus the recorded
    ledger total, which is stored as a sentinel Mark row with question_id
    IS NULL -- reusing the existing nullable Mark.question_id column rather
    than adding a new one."""
    rows = db.query(Mark).filter(Mark.evaluation_id == evaluation_id).all()
    marks = {str(m.question_id): m.score for m in rows if m.question_id is not None}
    recorded_total_row = next((m for m in rows if m.question_id is None), None)
    recorded_total = recorded_total_row.score if recorded_total_row else None
    return marks, recorded_total


@router.post("/", response_model=EvaluationOut)
def submit_evaluation(eval_in: EvaluationSubmit, db: Session = Depends(get_db)):
    # Create Evaluation
    evaluation = Evaluation(
        answer_script_id=eval_in.answer_script_id,
        examiner_id=eval_in.examiner_id,
        status=eval_in.status,
        evaluation_time_mins=eval_in.evaluation_time_mins
    )
    db.add(evaluation)
    db.commit()
    db.refresh(evaluation)

    # Add Marks
    for m in eval_in.marks:
        new_mark = Mark(
            evaluation_id=evaluation.id,
            question_id=m.question_id,
            criterion_id=m.criterion_id,
            score=m.score
        )
        db.add(new_mark)

    db.commit()

    # Log Audit Event
    audit_event = AuditEvent(
        user_id=eval_in.examiner_id,
        action="EVALUATE",
        details={"evaluation_id": str(evaluation.id), "script_id": str(eval_in.answer_script_id)}
    )
    db.add(audit_event)
    db.commit()

    return evaluation


@router.post("/session/mark")
def submit_session_mark(payload: QuestionMarkInput, db: Session = Depends(get_db)):
    """
    Real, incremental mark entry used by the examiner workspace: upserts one
    Mark row per question against a real, persisted Evaluation. Leaving a
    question un-marked leaves no Mark row for it -- verification detects that
    directly from the database, not from a frontend flag.
    """
    evaluation = _get_or_create_session_evaluation(db, payload.assessment_id)

    mark = (
        db.query(Mark)
        .filter(Mark.evaluation_id == evaluation.id, Mark.question_id == payload.question_id)
        .first()
    )
    if mark:
        mark.score = payload.score
    else:
        mark = Mark(evaluation_id=evaluation.id, question_id=payload.question_id, score=payload.score)
        db.add(mark)
    db.commit()

    audit_event = AuditEvent(
        action="MARK_QUESTION",
        details={"evaluation_id": str(evaluation.id), "question_id": str(payload.question_id), "score": payload.score}
    )
    db.add(audit_event)
    db.commit()

    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {
        "evaluation_id": str(evaluation.id),
        "marks": marks,
        "recorded_total": recorded_total
    }


@router.post("/session/recorded-total")
def submit_recorded_total(payload: RecordedTotalInput, db: Session = Depends(get_db)):
    """Persist the examiner's ledger total (the number they write on the
    physical/PDF script as the section/grand total) as a sentinel Mark row
    with question_id = NULL, so verification can compare it against the real
    computed sum of individual question marks."""
    evaluation = _get_or_create_session_evaluation(db, payload.assessment_id)

    sentinel = (
        db.query(Mark)
        .filter(Mark.evaluation_id == evaluation.id, Mark.question_id.is_(None))
        .first()
    )
    if sentinel:
        sentinel.score = payload.recorded_total
    else:
        sentinel = Mark(evaluation_id=evaluation.id, question_id=None, score=payload.recorded_total)
        db.add(sentinel)
    db.commit()

    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {
        "evaluation_id": str(evaluation.id),
        "marks": marks,
        "recorded_total": recorded_total
    }


@router.get("/session")
def get_session_evaluation(assessment_id: UUID, db: Session = Depends(get_db)):
    """Real current evaluation state for this assessment's session, used to
    restore the examiner workspace on load. Does not create anything -- an
    evaluation only exists once at least one mark has been entered."""
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    answer_script = (
        db.query(AnswerScript)
        .join(Candidate, AnswerScript.candidate_id == Candidate.id)
        .filter(AnswerScript.assessment_id == assessment_id, Candidate.candidate_identifier == "SESSION-CANDIDATE")
        .first()
    )
    if not answer_script:
        return {"status": "NOT_STARTED", "evaluation_id": None, "marks": {}, "recorded_total": None}

    evaluation = (
        db.query(Evaluation)
        .filter(Evaluation.answer_script_id == answer_script.id)
        .order_by(Evaluation.created_at.desc())
        .first()
    )
    if not evaluation:
        return {"status": "NOT_STARTED", "evaluation_id": None, "marks": {}, "recorded_total": None}

    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {
        "status": evaluation.status,
        "evaluation_id": str(evaluation.id),
        "marks": marks,
        "recorded_total": recorded_total
    }


@router.get("/{evaluation_id}")
def get_evaluation(evaluation_id: UUID, db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        return {"id": str(evaluation_id), "status": "NOT_STARTED", "marks": {}, "recorded_total": None}
    marks, recorded_total = _evaluation_marks_map(db, evaluation.id)
    return {"id": str(evaluation.id), "status": evaluation.status, "marks": marks, "recorded_total": recorded_total}


@router.get("/{evaluation_id}/marks")
def get_evaluation_marks(evaluation_id: UUID, db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    marks = db.query(Mark).filter(Mark.evaluation_id == evaluation_id).all()
    return {
        "evaluation_id": evaluation_id,
        "marks": [{"question_id": m.question_id, "score": m.score, "criterion_id": m.criterion_id} for m in marks]
    }
