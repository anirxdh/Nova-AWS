---
phase: 06-backend-foundation
plan: 02
subsystem: api
tags: [fastapi, sse, sse-starlette, asyncio, chrome-extension, typescript, webpack]

# Dependency graph
requires:
  - 06-01 (FastAPI server, /transcribe endpoint, Nova Sonic STT service)
provides:
  - GET /events SSE endpoint streaming real-time status events
  - In-process EventBus singleton (asyncio.Queue pub/sub)
  - /transcribe emits SSE events (transcribing, done, error) during processing
  - Extension backend-client.ts: transcribeAudio(), connectSSE(), checkBackendHealth()
  - Extension rewired to send audio to localhost:8000/transcribe instead of Groq Whisper
affects:
  - 07-extension-wiring (vision/Q&A rewire — stays Groq until Phase 7)
  - 10-streaming (upgrade SSE with streaming transcript deltas)

# Tech tracking
tech-stack:
  added:
    - sse-starlette (already in requirements.txt from 06-01, now actually used)
    - asyncio.to_thread (wraps sync boto3 call in transcribe.py)
  patterns:
    - EventBus singleton: asyncio.Queue per subscriber, broadcast via emit()
    - SSE via sse-starlette EventSourceResponse with async generator
    - Extension backend-client.ts: fetch FormData to /transcribe, EventSource to /events
    - SSE auto-reconnect: 5s setTimeout on onerror, health check before connecting

key-files:
  created:
    - backend/services/event_bus.py
    - backend/routers/events.py
    - src/background/api/backend-client.ts
  modified:
    - backend/routers/transcribe.py
    - backend/main.py
    - src/background/service-worker.ts

key-decisions:
  - "asyncio.to_thread() used to wrap sync boto3 transcribe_audio call — prevents event loop blocking during SSE event delivery"
  - "SSE health-check-before-connect pattern: extension checks /health before calling connectSSE() to fail silently when backend is not running"
  - "groq-stt.ts file kept on disk (not deleted) for Phase 7 reference; import swapped in service-worker.ts only"
  - "SSE auto-reconnect uses 5s setTimeout to handle backend restarts gracefully"

requirements-completed: [BACK-04, EXT-01]

# Metrics
duration: ~2.5min
completed: 2026-03-15
---

# Phase 6 Plan 02: SSE Event Streaming + Extension Rewire Summary

**SSE event bus added to FastAPI backend; Chrome extension rewired to call /transcribe instead of Groq Whisper, with SSE status events logged on the background page**

## Performance

- **Duration:** ~2.5 min
- **Started:** 2026-03-15T05:34:55Z
- **Completed:** 2026-03-15T05:37:21Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- EventBus singleton (`backend/services/event_bus.py`) using asyncio.Queue per subscriber — supports multiple concurrent SSE clients
- GET /events SSE endpoint (`backend/routers/events.py`) via sse-starlette EventSourceResponse with async generator
- POST /transcribe emits three SSE events: `status/{stage:transcribing}` before call, `status/{stage:done,transcript}` on success, `status/{stage:error,detail}` on failure
- Sync boto3 call wrapped with `asyncio.to_thread()` so event loop stays responsive during transcription
- `backend-client.ts` provides `transcribeAudio()` (multipart POST), `connectSSE()` (EventSource factory), `checkBackendHealth()` (GET /health)
- Service worker imports rewired from `groq-stt` to `backend-client`; Groq API key no longer needed for STT
- SSE initialized on extension startup after health check, with 5s auto-reconnect on disconnect

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SSE event bus and /events endpoint to backend** - `50b8328` (feat)
2. **Task 2: Rewire extension service worker to call FastAPI backend** - `5e26250` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/services/event_bus.py` - EventBus class with subscribe/unsubscribe/emit; singleton `event_bus` exported
- `backend/routers/events.py` - GET /events SSE endpoint; async generator subscribes to event_bus queue
- `backend/routers/transcribe.py` - Updated: imports event_bus, emits status events, wraps boto3 with asyncio.to_thread
- `backend/main.py` - Updated: includes events_router so /events is registered alongside /transcribe and /health
- `src/background/api/backend-client.ts` - New extension module: transcribeAudio(), connectSSE(), checkBackendHealth()
- `src/background/service-worker.ts` - Updated: import from backend-client, removed groqKey from transcribeAudio call, added SSE init block

## Decisions Made

- `asyncio.to_thread()` chosen over `run_in_executor(None, ...)` — cleaner syntax, available since Python 3.9, boto3 is safe to run in thread pool
- Health check before SSE connect: extension calls `/health` first so it fails silently when backend is not running, rather than flooding the console with EventSource connection errors
- groq-stt.ts kept on disk (not deleted) — Phase 7 will rewire vision/Q&A and can use it as reference
- SSE groq key check unchanged: `runPipeline` still checks `keys.groqKey` because `streamGeminiResponse` (vision) still needs it in Phase 7

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Both tasks completed cleanly with passing verification commands.

## User Setup Required

To use the full pipeline end-to-end:

1. Backend must be running: `cd backend && uvicorn backend.main:app`
2. AWS credentials set in `backend/.env` (from Plan 06-01 setup)
3. Load extension in Chrome (already built by webpack)
4. Open DevTools background page console — you should see: `[ScreenSense] Backend connected, SSE initialized`
5. Hold backtick, speak, release — audio goes to localhost:8000/transcribe, SSE events appear in backend logs and extension console

## Next Phase Readiness

- Phase 7 (extension wiring): Vision/Q&A rewire can now follow the same backend-client pattern — add `streamVisionResponse()` to backend-client.ts
- Phase 10 (streaming): SSE infrastructure is in place; upgrade /transcribe to stream transcript deltas via event_bus

---
*Phase: 06-backend-foundation*
*Completed: 2026-03-15*

## Self-Check: PASSED

- backend/services/event_bus.py verified present on disk
- backend/routers/events.py verified present on disk
- src/background/api/backend-client.ts verified present on disk
- 06-02-SUMMARY.md verified present on disk
- Task 1 commit 50b8328 verified in git history
- Task 2 commit 5e26250 verified in git history
- `python -c "from backend.main import app"` passes with /events registered
- `npx webpack --mode production` compiled successfully
