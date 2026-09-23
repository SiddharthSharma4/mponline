# EvalOS — AI-Assisted, On-Screen Marking

An AI-assisted examination evaluation platform: real answer scripts go through document
intelligence, an examiner marks them in a 3D Evaluation Lens, a verification engine checks
the marks for completeness and consistency against the database, unresolved issues route to
moderation, and only then is a result calculated — entirely from persisted data.

The AI prepares and assists. **The human examiner makes the final academic call.**

---

                         ┌──────────────────────┐
                         │     INSTITUTION      │
                         │                      │
                         │ Question Paper       │
                         │ Marking Scheme       │
                         │ Answer Scripts       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────┐
                    │     DOCUMENT INTAKE          │
                    │                              │
                    │ PDF / Image / Scan Upload    │
                    │ Bundle Processing             │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   DOCUMENT INTELLIGENCE      │
                    │                              │
                    │ OCR                         │
                    │ Page / Question Detection    │
                    │ Answer Region Detection      │
                    │ Handwriting Assistance       │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │    AI EXAM UNDERSTANDING     │
                    │                              │
                    │ Question Meaning             │
                    │ Expected Answer              │
                    │ Marking Criteria              │
                    │ Student Answer Meaning        │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │   AI COPY CATEGORISATION     │
                    │                              │
                    │ HIGH MATCH                   │
                    │ PARTIAL MATCH                │
                    │ REVIEW REQUIRED              │
                    │                              │
                    │ NO FINAL MARK BY AI           │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
              ┌────────────────────────────────────────────┐
              │           HUMAN EXAMINER WORKSPACE         │
              │                                            │
              │  Evaluation Lens                            │
              │                                            │
              │  Question → Student Answer → Criteria      │
              │                                            │
              │              ↓                             │
              │                                            │
              │       HUMAN ACADEMIC MARK                  │
              └───────────────────┬────────────────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────────┐
                    │    CHECKED COPY RE-UPLOAD    │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │       VERIFICATION / QA      │
                    │                              │
                    │ Completeness                 │
                    │ Mark validity               │
                    │ Section totals              │
                    │ Grand total                 │
                    │ Scoring anomalies            │
                    └──────────────┬───────────────┘
                                   │
                         ┌─────────┴─────────┐
                         │                   │
                         ▼                   ▼
                   ┌───────────┐      ┌─────────────┐
                   │ VERIFIED  │      │ REVIEW      │
                   │           │      │ SIGNAL      │
                   └─────┬─────┘      └──────┬──────┘
                         │                    │
                         │                    ▼
                         │             ┌────────────┐
                         │             │ MODERATION │
                         │             └─────┬──────┘
                         │                   │
                         └─────────┬─────────┘
                                   ▼
                              ┌──────────┐
                              │ RESULT   │
                              └────┬─────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │ ANALYTICS + AUDIT│
                         └──────────────────┘

### Service topology

```text
                    ┌──────────────────────────┐
                    │       React / Vite        │
                    │                            │
                    │ Evaluation Lens            │
                    │ Examiner Workspace         │
                    │ Verification               │
                    │ Moderation                 │
                    │ Analytics                  │
                    └────────────┬─────────────┘
                                 │ REST / API
                                 ▼
                    ┌──────────────────────────┐
                    │        FastAPI             │
                    │                            │
                    │ Assessment API             │
                    │ Document API               │
                    │ Evaluation API             │
                    │ Verification API           │
                    │ Moderation API             │
                    │ Result API                 │
                    │ Analytics API              │
                    └──────┬───────────┬───────┘
                           │           │
                ┌──────────▼───┐   ┌──▼─────────────┐
                │  PostgreSQL   │   │     Redis       │
                │               │   │                 │
                │ Source of     │   │ Queue           │
                │ truth         │   │ Cache           │
                │               │   │ Sessions        │
                │ Assessments   │   │ Job state       │
                │ Questions     │   └───────┬────────┘
                │ Scripts       │           │
                │ Pages         │           ▼
                │ Answers       │   ┌─────────────────┐
                │ Marks         │   │ Celery / Workers │
                │ Moderation    │   │                 │
                │ Results       │   │ Async document  │
                │ Audit         │   │ processing      │
                └───────────────┘   └────────┬────────┘
                                            │
                                            ▼
                                ┌────────────────────┐
                                │    MinIO / S3       │
                                │                     │
                                │ PDFs                │
                                │ Page images         │
                                │ Checked scripts     │
                                │ Evidence            │
                                └────────────────────┘
```

### Document intelligence pipeline

```text
REAL ANSWER SCRIPT
       │
       ▼
OCR / EXTRACTION
       │
       ▼
QUESTION DETECTION
       │
       ▼
ANSWER REGION
       │
       ▼
QUESTION + ANSWER
       │
       ▼
RUBRIC RETRIEVAL
       │
       ▼
RAG CONTEXT (TF-IDF, local — see "AI / ML layer" below)
       │
       ▼
LLM / VLM ASSISTANCE (only if configured — honestly reports UNAVAILABLE otherwise)
       │
       ▼
STRUCTURED OUTPUT
       │
  ┌────┼────┐
  ▼    ▼    ▼
Evidence  Confidence  Routing
                        │
              ┌─────────┼────────┐
              ▼         ▼        ▼
        HIGH MATCH  PARTIAL   REVIEW
```

### Data model

```text
Institution
   │
   └── Assessment
          │
          ├── QuestionSection
          │       └── Question
          │              └── Criterion
          │
          ├── MarkingScheme
          │
          ├── Candidate
          │       └── AnswerScript
          │              └── Page
          │                    └── AnswerRegion
          │
          └── Evaluation
                 └── Mark

Examiner
   │
   └── Evaluation
          │
          └── Mark

Evaluation
   │
   ▼
Verification
   │
   ├── ReviewSignal
   │
   └── ModerationCase
           │
           ▼
       Resolution
           │
           ▼
         Result
```

### Roles

| Role               | Responsibility                                              |
| ------------------ | ------------------------------------------------------------ |
| **Registrar**       | Intake, assessment configuration, marking scheme              |
| **Assessor**        | Document understanding, answer preparation, categorisation    |
| **Proctor**         | Post-evaluation verification and integrity checks             |
| **Auditor**         | Analytics, anomalies, review signals                          |
| **Archivist**       | Moderation knowledge and institutional learning                |
| **Human Examiner**  | Actual academic evaluation and final mark                     |

### Human-in-the-loop workflow

```text
          AI
       PREPARES
          │
          ▼
          AI
       ASSISTS
          │
          ▼
       HUMAN
      EVALUATES
          │
          ▼
          AI
       VERIFIES
          │
          ▼
       HUMAN
      MODERATES
          │
          ▼
        RESULT
```

---

## Tech stack

**Frontend:** Vite, Vanilla JS (ES Modules), Three.js + GSAP (3D booklet), Tailwind CSS, PDF.js

**Backend:** FastAPI (Python 3.11), Celery, PostgreSQL, Redis, MinIO (S3-compatible)

**AI / ML layer:** Scikit-learn (Isolation Forest anomaly detection), TF-IDF (lightweight local
retrieval for rubric matching — not transformer embeddings; the app labels this honestly rather
than claiming semantic AI), PyTesseract + PyMuPDF (OCR / layout extraction)

---

## Golden path

```
INSTITUTION
→ UPLOAD REAL EXAMINATION SCRIPT
→ DOCUMENT PROCESSING (real OCR, async via Celery)
→ AI CATEGORISATION (honest REVIEW_REQUIRED if no semantic model is configured)
→ EXAMINER WORKSPACE — real questions from the database, real marks persisted per question
→ AI VERIFICATION — reads persisted marks; flags any question with no Mark row, and any
  mismatch between the examiner's recorded ledger total and the computed sum
→ MODERATION — resolves the real ReviewSignal / ModerationCase verification created
→ RESULT — calculated only from persisted marks, only once nothing is unresolved
→ ANALYTICS — aggregated from real Evaluation / ReviewSignal / ModerationCase rows
```

The assessment used for the golden path (B.Sc. Mathematics, Q01–Q06, 5 marks each, 30 total)
is provisioned as **real rows in PostgreSQL** — see `backend/core/seed_data.py` — automatically
on backend startup, or manually via `python backend/seed.py`.

**Marking-scheme parsing (best effort, honest).** When a marking-scheme PDF is uploaded, the
worker OCRs it and `backend/services/marking_scheme_parser.py` looks for question markers with
explicit marks (`Q1 (5 marks)`, `Q.2 [6]`, `Question 3 - 10 marks`, `Q4 5M`). If found, real
`Assessment` / `QuestionSection` / `Question` rows are written and become the assessment returned
by `GET /assessments/active`; re-uploading an identical scheme re-uses the existing assessment.
If nothing (or an incomplete/conflicting set) is found, the job records
`parsing = {status: UNAVAILABLE, reason}`, no rows are created, and the provisioned assessment
stays active. Table-layout schemes and markers without explicit marks are reported as
UNAVAILABLE rather than guessed. The parse outcome is shown on the upload and prepare stages.

**No paid hosting?** See [`DEPLOY_FREE.md`](DEPLOY_FREE.md) — a single-container "lite" mode
(SQLite + local files + inline tasks) runs on free tiers or on your laptop behind a free tunnel.

---

## How to run locally

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Configure environment
```bash
cp .env.example .env
```
The default values work as-is for local development.

### 2. Start the stack
```bash
docker compose up -d --build
```
This builds and starts Postgres, Redis, MinIO, the FastAPI backend, the Celery worker, and the
frontend. On boot, the backend automatically runs database migrations and provisions the golden
path assessment — no manual seeding step is required, but `python backend/seed.py` is
available if you need to re-run it.

### 3. Open the app
- **Frontend:** http://localhost:3000
- **Backend API docs (Swagger):** http://localhost:8000/docs
- **MinIO console:** http://localhost:9001 (user: `evalos_admin`, password: `evalos_password`)

---

## Deploying it (hackathon-fast)

The simplest path is a single VM running the same `docker-compose.yml` you use locally —
no code changes needed beyond the `VITE_API_URL` build arg.

### Option A — One VM (fastest, recommended for a demo)
1. Spin up a small VM (DigitalOcean Droplet, an AWS/GCP free-tier instance, etc.) with Docker
   and Docker Compose installed.
2. Copy the project to the VM (`git clone` or `scp`).
3. Set the real, public backend URL before building the frontend:
   ```bash
   echo "VITE_API_URL=http://<your-vm-public-ip>:8000/api/v1" > .env
   docker compose up -d --build
   ```
4. Open `http://<your-vm-public-ip>:3000`.

### Option B — Split platforms (Railway / Render)
1. Deploy `backend/` (with the Celery `worker` as a second service from the same image, command
   overridden to `celery -A core.celery_app worker --loglevel=info`) plus managed Postgres and
   Redis add-ons.
2. Deploy MinIO as a third service, or swap `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` for a
   real S3 bucket's credentials — `backend/services/storage.py` uses the standard S3 API, so any
   S3-compatible provider works without code changes.
3. Deploy `frontend/` (build command `docker build -f Dockerfile.frontend --build-arg VITE_API_URL=https://<your-backend-url>/api/v1 .`, or as a static site: `npm run build` with `VITE_API_URL` set in the platform's build-time environment variables) pointed at the backend's public URL.
4. Backend migrations and seeding run automatically on container start (see
   `backend/entrypoint.sh`) — no manual step needed.

**Either way, remember:** `VITE_API_URL` is compiled into the frontend at **build time**, not
read at container runtime. If you change it, you must rebuild the frontend image/bundle — a
plain restart will not pick up the new value.

---

## Known limitations (honestly reported, not hidden)

- **No PDF marking-scheme parser.** Uploading a marking-scheme PDF runs OCR on it, but question
  structure is not auto-extracted from that OCR text. The examiner workspace uses the real
  assessment/questions provisioned in PostgreSQL (see `backend/core/seed_data.py`) instead of
  inventing structure from an unparsed document.
- **No semantic AI model is bundled.** Categorisation uses TF-IDF-based local retrieval and
  reports `REVIEW_REQUIRED` / semantic-model-unavailable honestly rather than fabricating a
  confidence score.
- **No authentication/session system.** A single placeholder Examiner/Candidate is used to carry
  the golden path through the database — fine for a single-examiner hackathon demo, not for
  multi-user production use.

---
*Built for the Hackathon — AI assists, the human examiner decides.*
