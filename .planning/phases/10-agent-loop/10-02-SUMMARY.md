---
phase: 10-agent-loop
plan: "02"
subsystem: api
tags: [websocket, streaming, transcription, groq, whisper, fallback]

# Dependency graph
requires:
  - phase: 10-agent-loop
    provides: 10-01 — agent loop, runPipeline, transcribeAudio batch flow
  - phase: 06-backend-foundation
    provides: FastAPI routers, Groq Whisper transcribe_audio(), event_bus SSE
provides:
  - WebSocket endpoint /transcribe/stream for streaming audio accumulation
  - transcribe_audio_streaming() backend service function
  - transcribeAudioStreaming() frontend client with 15s timeout
  - Streaming-first / batch-fallback transcription in runPipeline
affects: [future-audio-phases]

# Tech tracking
tech-stack:
  added: [fastapi WebSocket/WebSocketDisconnect]
  patterns: [streaming-first with graceful batch fallback, WebSocket audio accumulation]

key-files:
  created: []
  modified:
    - backend/services/nova_sonic.py
    - backend/routers/transcribe.py
    - src/background/api/backend-client.ts
    - src/background/service-worker.ts

key-decisions:
  - "Pragmatic streaming: accumulate full audio over WebSocket to eliminate HTTP multipart upload latency — not true real-time partial transcripts"
  - "Separate transcribe_audio_streaming() function wraps transcribe_audio() to keep batch endpoint untouched"
  - "WebSocket protocol: JSON config -> binary audio -> JSON done signal -> JSON transcript response"
  - "15s WebSocket timeout in client; batch fallback fires on any WebSocket error or timeout"
  - "transcribeAudioStreaming() throws on failure so runPipeline catch/fallback is the recovery path"

patterns-established:
  - "Streaming-first with batch fallback: try new path, catch any exception, fall back to proven path"
  - "WebSocket audio protocol: text config -> binary data -> text done -> text response"

requirements-completed: [NOVA-02]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 10 Plan 02: Streaming STT Integration Summary

**WebSocket streaming transcription endpoint with graceful batch fallback — eliminates multipart upload latency by accumulating audio server-side during recording**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-15T10:24:07Z
- **Completed:** 2026-03-15T10:26:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `transcribe_audio_streaming(audio_chunks, mime_type)` to `nova_sonic.py` — joins pre-accumulated chunks and delegates to existing `transcribe_audio()` batch logic
- Added `/transcribe/stream` WebSocket endpoint to `transcribe.py` — accepts JSON config, binary audio chunks, and done signal; transcribes on close and sends back `{"transcript": "..."}`
- Added `transcribeAudioStreaming()` to `backend-client.ts` — opens WebSocket, sends full recording as binary, resolves on transcript, rejects on error or 15s timeout
- Updated `runPipeline()` in `service-worker.ts` with streaming-first / batch-fallback pattern — any WebSocket failure silently falls back to HTTP batch mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend streaming transcription endpoint** - `41e0fd0` (feat)
2. **Task 2: Frontend streaming transcription with batch fallback** - `33ba802` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `backend/services/nova_sonic.py` - Added `transcribe_audio_streaming()` function
- `backend/routers/transcribe.py` - Added `/transcribe/stream` WebSocket endpoint, imported WebSocket/WebSocketDisconnect
- `src/background/api/backend-client.ts` - Added `transcribeAudioStreaming()` client function
- `src/background/service-worker.ts` - Updated import line; streaming-first / batch-fallback in `runPipeline()`

## Decisions Made
- Used pragmatic streaming approach (full audio over WebSocket) rather than true real-time partial transcripts, which would require a different STT service. The latency win comes from eliminating HTTP multipart encoding and upload overhead.
- `transcribe_audio_streaming()` is a thin wrapper over `transcribe_audio()` so the existing batch endpoint stays 100% unchanged — zero regression risk.
- WebSocket protocol uses 3-phase exchange: JSON config -> binary audio blob -> JSON `{"action":"done"}` signal. Server closes cleanly after sending transcript.
- 15s client-side timeout chosen to match realistic recording + transcription time, preventing hang if server disappears mid-stream.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all imports verified, TypeScript compiled cleanly, webpack built successfully.

## User Setup Required
None - no new external services. Uses existing Groq API key via `GROQ_API_KEY` env var.

## Next Phase Readiness
- Streaming STT stretch goal (NOVA-02) complete — all 10 plans in Phase 10 are done
- Batch mode remains the proven fallback path; streaming improves perceived latency when backend WebSocket is reachable
- Phase 10 agent loop is complete: agent loop + streaming STT both shipped

---
*Phase: 10-agent-loop*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: backend/services/nova_sonic.py
- FOUND: backend/routers/transcribe.py
- FOUND: src/background/api/backend-client.ts
- FOUND: src/background/service-worker.ts
- FOUND: .planning/phases/10-agent-loop/10-02-SUMMARY.md
- FOUND commit: 41e0fd0 (Task 1 — backend streaming endpoint)
- FOUND commit: 33ba802 (Task 2 — frontend streaming client + fallback)
