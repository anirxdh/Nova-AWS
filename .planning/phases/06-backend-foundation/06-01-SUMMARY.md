---
phase: 06-backend-foundation
plan: 01
subsystem: api
tags: [fastapi, uvicorn, boto3, aws-bedrock, nova-sonic, python, cors]

# Dependency graph
requires: []
provides:
  - FastAPI backend server runnable with `uvicorn backend.main:app`
  - GET /health endpoint returning {"status": "ok"}
  - POST /transcribe endpoint accepting multipart audio upload
  - Nova Sonic STT integration via boto3 bedrock-runtime (amazon.nova-sonic-v1:0)
  - CORS middleware configured for Chrome extension development
affects:
  - 06-02-PLAN.md (Nova Act agent — will share backend server)
  - 07-extension-wiring (extension calls /transcribe instead of Groq directly)
  - 10-streaming (upgrade /transcribe to streaming SSE)

# Tech tracking
tech-stack:
  added:
    - fastapi==0.115.0
    - uvicorn[standard]==0.30.6
    - python-dotenv==1.0.1
    - boto3==1.35.0
    - python-multipart==0.0.9
    - sse-starlette==2.1.0
  patterns:
    - Python package layout with backend/ root package and routers/ + services/ subpackages
    - Services layer (nova_sonic.py) isolates boto3/AWS calls from routing logic
    - Credentials read via os.getenv() with explicit ValueError on missing/placeholder values
    - CORS wildcard for dev, all origins/methods/headers allowed (Chrome extension requirement)

key-files:
  created:
    - backend/requirements.txt
    - backend/.env.example
    - backend/__init__.py
    - backend/main.py
    - backend/routers/__init__.py
    - backend/routers/transcribe.py
    - backend/services/__init__.py
    - backend/services/nova_sonic.py
  modified:
    - .gitignore (added !.env.example negation to allow tracking template file)

key-decisions:
  - "boto3 converse_stream API used for Nova Sonic STT (model ID: amazon.nova-sonic-v1:0) — collects text deltas from streamed events for batch-mode transcript"
  - "CORS wildcard (allow_origins=['*']) chosen over extension-specific origin for dev simplicity — can restrict in prod"
  - "Credentials validated early in transcribe_audio() before boto3 call to give descriptive error instead of cryptic AWS exception"
  - ".env.example negation added to .gitignore so template is tracked but .env is not"

patterns-established:
  - "Service layer pattern: boto3/external API calls live in services/, routers only handle HTTP concerns"
  - "Error surfacing pattern: wrap ClientError/NoCredentials with human-readable ValueError, re-raise as HTTPException in router"

requirements-completed: [BACK-01, BACK-02, NOVA-01]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 6 Plan 01: Backend Foundation — FastAPI + Nova Sonic STT Summary

**FastAPI backend with POST /transcribe endpoint calling Amazon Nova Sonic STT via boto3 bedrock-runtime, reading AWS credentials from .env**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-15T05:28:45Z
- **Completed:** 2026-03-15T05:31:44Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- FastAPI server scaffold with CORSMiddleware and GET /health ({"status": "ok"}) running on port 8000
- POST /transcribe accepting multipart audio upload + mime_type form field, 25MB size limit enforced
- Nova Sonic STT integration via boto3 converse_stream with audio format detection (webm/ogg/mp4/wav)
- Descriptive error handling: 400 empty file, 413 oversized, 422 no transcript, 500 AWS errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FastAPI server scaffold with CORS and health check** - `7a1d1a7` (feat)
2. **Task 2: Implement POST /transcribe with Nova Sonic STT via boto3** - `810418a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/requirements.txt` - Pinned Python deps: fastapi, uvicorn, boto3, python-dotenv, python-multipart, sse-starlette
- `backend/.env.example` - AWS credential + port config template
- `backend/__init__.py` - Root backend package marker
- `backend/main.py` - FastAPI app, CORSMiddleware, /health, router include, uvicorn entrypoint
- `backend/routers/__init__.py` - Package marker
- `backend/routers/transcribe.py` - POST /transcribe multipart endpoint
- `backend/services/__init__.py` - Package marker
- `backend/services/nova_sonic.py` - transcribe_audio() using boto3 bedrock-runtime + Nova Sonic
- `.gitignore` - Added !.env.example negation to allow tracking the template

## Decisions Made

- Used `converse_stream` (not `invoke_model`) for Nova Sonic — the model is speech-to-speech and the streaming converse API is the documented path for audio input
- CORS wildcard (`allow_origins=["*"]`) chosen for dev: Chrome extensions don't have a stable origin to whitelist during development
- Early credentials check in `transcribe_audio()` before creating the boto3 client gives a descriptive error rather than a cryptic `NoCredentialsError` from deep inside boto3

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added backend/__init__.py to make backend/ a proper Python package**
- **Found during:** Task 1 (FastAPI scaffold)
- **Issue:** Python imports like `from backend.main import app` fail without `__init__.py` at the package root
- **Fix:** Created `backend/__init__.py` (empty)
- **Files modified:** `backend/__init__.py`
- **Verification:** `python -c "from backend.main import app"` succeeds
- **Committed in:** 7a1d1a7 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated .gitignore to allow .env.example to be tracked**
- **Found during:** Task 1 git staging
- **Issue:** Existing `.gitignore` had `.env.*` pattern which also blocked tracking `.env.example`
- **Fix:** Added `!.env.example` and `!backend/.env.example` negation lines
- **Files modified:** `.gitignore`
- **Verification:** `git check-ignore -v backend/.env.example` shows the negation rule wins; `.env` still ignored
- **Committed in:** 7a1d1a7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking)
**Impact on plan:** Both fixes were required for correct project structure and git hygiene. No scope creep.

## Issues Encountered

- aiobotocore/botocore version conflict warning appeared during `pip install` — this is a pre-existing system environment conflict unrelated to our changes. All imports and server startup succeed.

## User Setup Required

Before POST /transcribe will work against real AWS:

1. Copy `backend/.env.example` to `backend/.env`
2. Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from AWS Console → IAM → Security Credentials → Access Keys
3. Set `AWS_REGION` to the region where Bedrock is enabled (e.g., `us-east-1`)
4. In AWS Console → Bedrock → Model access: enable `amazon.nova-sonic-v1:0`
5. Verify: `uvicorn backend.main:app` starts, `curl http://localhost:8000/health` returns `{"status":"ok"}`

## Next Phase Readiness

- Backend server is runnable with `uvicorn backend.main:app`
- /health and POST /transcribe are wired and importable
- AWS credentials setup is required for live STT calls (see User Setup above)
- Phase 06-02 (Nova Act agent endpoint) can be built on top of this server immediately

---
*Phase: 06-backend-foundation*
*Completed: 2026-03-14*

## Self-Check: PASSED

- All 8 backend files verified present on disk
- Both task commits (7a1d1a7, 810418a) verified in git history
- `python -c "from backend.main import app"` passes
- `curl http://localhost:8766/health` returned `{"status":"ok"}`
