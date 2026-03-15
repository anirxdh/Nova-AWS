---
phase: 10-agent-loop
plan: "01"
subsystem: api
tags: [agent-loop, bedrock, nova-lite, typescript, service-worker, chrome-extension]

# Dependency graph
requires:
  - phase: 09-dom-automation
    provides: action-executor and executeSteps service-worker integration
  - phase: 07-nova-reasoning-dom-context
    provides: reason_about_page and POST /task endpoint for initial Nova reasoning
provides:
  - CONTINUE_SYSTEM_PROMPT and reason_continue() for multi-turn agent reasoning
  - POST /task/continue endpoint accepting original_command, action_history, screenshot, dom_snapshot
  - sendTaskContinue() client function posting to /task/continue
  - runAgentLoop() replacing executeSteps() — re-observes page after each action batch
  - ActionHistoryEntry interface for tracking action context across loop iterations
  - MAX_AGENT_ITERATIONS = 10 safety limit enforced in runAgentLoop
affects: [future multi-step task tests, conversation history patterns, bubble state handling]

# Tech tracking
tech-stack:
  added: ["@types/jest (dev — fixes tsc --noEmit for test files)"]
  patterns:
    - "Agent loop pattern: observe-act-re-observe with Nova deciding done/steps/answer after each action batch"
    - "Action history accumulation: description+result tuples passed to Nova for context on each iteration"
    - "Continue endpoint follows same SSE/error-handling pattern as /task — consistent error surfacing"
    - "JSON parse fallback on continue: plain-text or malformed JSON treated as done (conservative termination)"

key-files:
  created: []
  modified:
    - backend/services/nova_reasoning.py
    - backend/routers/task.py
    - src/background/api/backend-client.ts
    - src/background/service-worker.ts

key-decisions:
  - "reason_continue() JSON parse fallback wraps plain-text as {type: done} — conservative: if Nova can't signal more steps, terminate safely"
  - "totalSteps=0 in bubble-step during agent loop signals unknown total (agent mode vs fixed-plan mode)"
  - "500ms post-action + 800ms post-batch settle times balance responsiveness with DOM/AJAX settle"
  - "Pre-existing src/__tests__/ missing @types/jest fixed by installing @types/jest (tsc --noEmit gate required)"

patterns-established:
  - "runAgentLoop: outer while loop (iterations) with inner for loop (actions in batch)"
  - "Re-observation: captureScreenshot + scrape-dom sent to Nova via sendTaskContinue after each batch"
  - "Nova response routing: done -> bubble done, answer -> show answer text + TTS, steps -> continue loop"

requirements-completed: [NOVA-04]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 10 Plan 01: Agent Loop Summary

**Autonomous observe-act loop using Nova 2 Lite: extension re-captures page after each action and asks Nova done/steps/answer, with 10-iteration safety limit**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T10:12:46Z
- **Completed:** 2026-03-15T10:16:00Z
- **Tasks:** 3 of 3 completed (Task 3 human-verify checkpoint: approved)
- **Files modified:** 4

## Accomplishments
- Backend: CONTINUE_SYSTEM_PROMPT with done/steps/answer response types, reason_continue() multi-turn reasoning function, and POST /task/continue endpoint
- Frontend: sendTaskContinue() client, ActionHistoryEntry interface, runAgentLoop() replacing executeSteps() with full observe-act-re-observe cycle
- TypeScript compiles cleanly (tsc --noEmit) and webpack builds successfully
- Both runPipeline() and runFollowUp() now invoke runAgentLoop() — single-shot answers remain unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend continue-mode reasoning and endpoint** - `843feb6` (feat)
2. **Task 2: Frontend agent loop — backend-client, service-worker, types** - `857957c` (feat)
3. **Task 3: Verify end-to-end agent loop** - CHECKPOINT (human-verify: approved by user)

**Plan metadata:** (see final docs commit below)

## Files Created/Modified
- `backend/services/nova_reasoning.py` - Added CONTINUE_SYSTEM_PROMPT constant and reason_continue() function
- `backend/routers/task.py` - Added TaskContinueRequest model and POST /task/continue endpoint
- `src/background/api/backend-client.ts` - Extended TaskResponse with 'done' type, added ActionHistoryEntry interface and sendTaskContinue() function
- `src/background/service-worker.ts` - Added MAX_AGENT_ITERATIONS=10, replaced executeSteps() with runAgentLoop(), updated both pipeline callers

## Decisions Made
- reason_continue() JSON parse fallback wraps plain-text as {type: done} — conservative: if Nova can't signal more steps, terminate safely rather than loop indefinitely
- totalSteps=0 in bubble-step during agent loop signals unknown total (agent mode vs fixed-plan mode with known step count)
- 500ms post-action + 800ms post-batch settle times selected to balance responsiveness with DOM/AJAX settle needs
- @types/jest installed to fix pre-existing tsc --noEmit failure from src/__tests__/ files generated in Phase 9

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @types/jest to fix tsc --noEmit failure**
- **Found during:** Task 2 verification
- **Issue:** src/__tests__/ test files (generated Phase 9) had no @types/jest — tsc --noEmit failed with "Cannot find name 'jest'" in ~250 places, blocking plan verification
- **Fix:** `npm install --save-dev @types/jest`
- **Files modified:** package.json, package-lock.json
- **Verification:** tsc --noEmit passes with 0 errors
- **Committed in:** 857957c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary to pass tsc --noEmit verification gate. No scope creep.

## Issues Encountered
None beyond the @types/jest fix above.

## Next Phase Readiness
- Agent loop implementation complete and verified end-to-end by user on live website
- Extension completes multi-step tasks like "search for USB-C cables" autonomously
- Single-shot answer path remains fully functional (no regression)
- Phase 10 Plan 02 (stretch: streaming STT with batch fallback, NOVA-02) is the next plan

## Self-Check: PASSED
- nova_reasoning.py: FOUND with reason_continue function
- task.py: FOUND with /task/continue endpoint
- backend-client.ts: FOUND with sendTaskContinue function
- service-worker.ts: FOUND with runAgentLoop function
- Commit 843feb6: FOUND (Task 1)
- Commit 857957c: FOUND (Task 2)
- python imports: reason_continue OK, TaskContinueRequest OK
- tsc --noEmit: PASSED (0 errors)
- webpack build: PASSED (compiled successfully)

---
*Phase: 10-agent-loop*
*Completed: 2026-03-15*
