---
phase: 08-unified-cursor-ui
plan: 01
subsystem: ui
tags: [shadow-dom, cursor-bubble, typescript, chrome-extension, waveform, animation, tts]

# Dependency graph
requires:
  - phase: 07-nova-reasoning-dom-context
    provides: Types (MessageType, ConversationInfo) and overlay/listening-indicator patterns
provides:
  - CursorBubble class — unified cursor-following bubble UI component with 9 states
  - BubbleState type exported from shared/types.ts
  - New message types: bubble-state, bubble-answer-chunk, bubble-answer-done, bubble-step, amplitude-data
affects: [09-task-execution, 10-audio-streaming, content-script wiring in 08-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shadow DOM closed-mode isolation for all UI components (no external CSS)
    - State-machine render pattern: clearContentArea + renderState on every transition
    - Cursor-following with edge-detection positioning (positionBubble method)
    - Amplitude-driven waveform bars via Uint8Array frequency data (16 bars)
    - Lazy sub-element creation — DOM nodes only created for active state

key-files:
  created:
    - src/content/cursor-bubble.ts
  modified:
    - src/shared/types.ts

key-decisions:
  - "Single CursorBubble class replaces both Overlay and ListeningIndicator — one component manages all 9 interaction states"
  - "TypeScript narrowing fix: redundant audio-only check removed in onAnswerDone() after early-return branch — TypeScript correctly narrows displayMode type"
  - "Bubble width is state-aware: 180px for status states, 380px for answering — controlled via positionBubble width parameter and CSS class"
  - "waveformBars array cleared on every non-listening state transition to prevent stale bar references"

patterns-established:
  - "Shadow DOM isolation: all CSS inlined in template literal constant, never leaks to host page"
  - "State machine rendering: clearContentArea() nukes innerHTML, renderState() rebuilds for new state — clean transitions with no residual DOM"
  - "Mouse tracking lifecycle: startTracking() on show(), stopTracking() when content starts streaming, cleanup() on dismiss()"

requirements-completed: [EXT-04]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 08 Plan 01: Unified Cursor UI Summary

**Shadow DOM cursor-following bubble with 9 states — replaces Overlay + ListeningIndicator with a single 1232-line CursorBubble component**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-15T06:21:48Z
- **Completed:** 2026-03-15T06:25:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `BubbleState` type (9 states) and 5 new SSE-driven `MessageType` entries to `src/shared/types.ts`
- Created `CursorBubble` class (1232 lines) in `src/content/cursor-bubble.ts` — fully self-contained Shadow DOM component
- All 9 visual states implemented: idle, listening (16-bar amplitude waveform), transcribing, understanding, planning, executing (step counter), answering (streaming markdown), error (auto-dismiss 5s), done (auto-dismiss 2s)
- Full TTS integration with audio-only display mode support (speaking waveform + auto-dismiss on TTS end)
- Chat history preserved across follow-up questions using prepareForFollowUp pattern from overlay.ts
- TypeScript compiles clean; webpack production build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Define BubbleState type and extend MessageType** - `4f05606` (feat)
2. **Task 2: Create CursorBubble component** - `0e1829f` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/shared/types.ts` — Added `BubbleState` union type and 5 new `MessageType` variants (bubble-state, bubble-answer-chunk, bubble-answer-done, bubble-step, amplitude-data)
- `src/content/cursor-bubble.ts` — Unified cursor-following bubble UI component (1232 lines), exports `CursorBubble` class

## Decisions Made

- Single `CursorBubble` replaces both `Overlay` and `ListeningIndicator` — reduces complexity and allows clean state transitions through all interaction phases in one component
- TypeScript type narrowing: after the `audio-only` early-return branch in `onAnswerDone()`, TypeScript correctly infers `displayMode` is not `'audio-only'`, so redundant `!== 'audio-only'` guards were removed (Rule 1 auto-fix)
- Bubble width is state-aware (180px status vs 380px answering) — controlled via `positionBubble()` width parameter so edge-detection remains accurate for each width
- `waveformBars` array is cleared on every `clearContentArea()` call — prevents stale bar references if state transitions out of listening

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type narrowing error in onAnswerDone()**
- **Found during:** Task 2 (CursorBubble component — TypeScript compile check)
- **Issue:** After early `return` in the `audio-only` branch, TypeScript narrowed `displayMode` to `'both' | 'text-only'`, making `!== 'audio-only'` comparisons redundant and flagged as TS2367 errors
- **Fix:** Removed the redundant `displayMode !== 'audio-only'` guards in the non-audio-only path (the early return already handles that case)
- **Files modified:** src/content/cursor-bubble.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 0e1829f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix required for TypeScript compilation correctness. No behavior change — logic was equivalent, just not type-narrowing-safe.

## Issues Encountered

None beyond the TypeScript narrowing fix above.

## Next Phase Readiness

- `CursorBubble` is ready to be wired into `content-script.ts` in Plan 08-02
- `overlay.ts` and `listening-indicator.ts` remain untouched (removed in Plan 08-02)
- All public API methods are in place: `show`, `setState`, `updateAmplitude`, `setStep`, `appendChunk`, `onAnswerDone`, `speakSummary`, `showError`, `dismiss`, `isVisible`, `hideForScreenshot`, `showAfterScreenshot`, `setCallbacks`, `updateConversationInfo`, `prepareForFollowUp`

---
*Phase: 08-unified-cursor-ui*
*Completed: 2026-03-15*

## Self-Check: PASSED

- src/content/cursor-bubble.ts: FOUND
- src/shared/types.ts: FOUND
- .planning/phases/08-unified-cursor-ui/08-01-SUMMARY.md: FOUND
- Commit 4f05606: FOUND
- Commit 0e1829f: FOUND
