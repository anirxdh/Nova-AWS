---
phase: 07-nova-reasoning-dom-context
plan: "01"
subsystem: backend
tags: [nova-lite, bedrock, reasoning, post-task, sse, boto3]
dependency_graph:
  requires: []
  provides: [nova-reasoning-service, post-task-endpoint]
  affects: [extension-content-script, sse-event-stream]
tech_stack:
  added: [boto3-converse-api, pydantic-basemodel]
  patterns: [asyncio-to-thread, service-layer, sse-emit-pattern]
key_files:
  created:
    - backend/services/nova_reasoning.py
    - backend/routers/task.py
  modified:
    - backend/main.py
key_decisions:
  - "boto3 converse (not converse_stream) used for Nova 2 Lite — full response needed before determining answer vs steps"
  - "JSON parse fallback wraps plain-text Nova responses as {type: answer} to ensure consistent response shape"
  - "us.amazon.nova-lite-v1:0 cross-region inference profile used (not amazon.nova-lite-v1:0) for broader availability"
metrics:
  duration: "3min"
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 07 Plan 01: Nova 2 Lite Reasoning Service and POST /task Endpoint Summary

**One-liner:** Nova 2 Lite reasoning via boto3 converse API with screenshot+DOM+command inputs returning structured answer/steps JSON.

## What Was Built

Created the reasoning brain of the ScreenSense agent: a service that feeds Nova 2 Lite a screenshot (image block), DOM snapshot (JSON text), and voice command (text), then returns either a text answer or a structured list of browser automation actions.

### Files Created

**`backend/services/nova_reasoning.py`**
- `SYSTEM_PROMPT` module-level constant defining ScreenSense agent persona and output format
- `reason_about_page(command, screenshot_base64, dom_snapshot) -> dict` function
- Uses `client.converse` (synchronous, full response) with model `us.amazon.nova-lite-v1:0`
- Builds multi-block user message: image block (decoded base64 PNG), DOM JSON text block, command text block
- JSON parse with fallback: tries `json.loads()`, checks for `type` field, wraps plain text as `{"type": "answer", "text": ...}`
- Error handling: `NoCredentialsError`, `PartialCredentialsError`, `ClientError` with descriptive re-raises as `ValueError`

**`backend/routers/task.py`**
- `TaskRequest` Pydantic model: `command: str`, `screenshot: str`, `dom_snapshot: dict`
- `POST /task` endpoint emitting SSE `understanding` stage at start
- Calls `reason_about_page` via `asyncio.to_thread()` (same pattern as `/transcribe`)
- Emits `task_complete` SSE with `result["type"]` on success, `error` SSE on failure
- Error handling: `ValueError` -> 422/500, generic `Exception` -> 500

**`backend/main.py` (modified)**
- Added `from backend.routers.task import router as task_router`
- Added `app.include_router(task_router)`

## Decisions Made

1. **boto3 converse vs converse_stream:** Used synchronous `converse` (not `converse_stream`) because we need the complete JSON response object before we can determine whether Nova returned an answer or a steps list. Streaming partial tokens would require reassembly before JSON parsing — unnecessary complexity.

2. **JSON parse fallback:** Nova 2 Lite may occasionally respond with plain text despite the system prompt. The fallback wraps any non-JSON or JSON-without-type-field response as `{"type": "answer", "text": response_text}`, ensuring the extension always receives a consistent response shape.

3. **Cross-region inference profile:** Using `us.amazon.nova-lite-v1:0` (cross-region prefix) per AWS Bedrock documentation for Nova model families — this ensures availability across US regions without needing explicit regional endpoint configuration.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `python -c "from backend.services.nova_reasoning import reason_about_page, SYSTEM_PROMPT; ..."` — OK, SYSTEM_PROMPT length: 1226
2. `python -c "from backend.main import app; routes = [r.path for r in app.routes]; assert '/task' in routes"` — OK: /task route registered

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Nova 2 Lite reasoning service | 889c8cb | backend/services/nova_reasoning.py |
| 2 | Create POST /task router and register in main.py | 89f4a1f | backend/routers/task.py, backend/main.py |

## Self-Check: PASSED

All files present and all commits verified.
