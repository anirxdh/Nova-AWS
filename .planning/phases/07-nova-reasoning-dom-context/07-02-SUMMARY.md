---
phase: 07-nova-reasoning-dom-context
plan: 02
subsystem: extension-pipeline
tags: [dom-scraper, screenshot, overlay, pipeline, nova, backend-client]
dependency_graph:
  requires: [07-01]
  provides: [dom-snapshot-extraction, overlay-safe-screenshot, nova-task-pipeline]
  affects: [service-worker, content-script, backend-client]
tech_stack:
  added: []
  patterns: [overlay-hide-before-capture, dom-structured-scraping, nova-task-api-call]
key_files:
  created:
    - src/content/dom-scraper.ts
  modified:
    - src/content/content-script.ts
    - src/content/overlay.ts
    - src/content/listening-indicator.ts
    - src/background/screenshot.ts
    - src/background/api/backend-client.ts
    - src/background/service-worker.ts
    - src/shared/types.ts
decisions:
  - "DOM scraper limits to 50 buttons, 50 links, 30 inputs, 10 forms, 3000 chars text to keep POST /task payload manageable"
  - "buildSelector uses id > data-testid > aria-label > tag+class+nth-child priority for robust selectors"
  - "overlay/indicator hideForScreenshot uses display:none (not visibility) for guaranteed pixel exclusion from screenshot"
  - "steps response type displays as numbered action descriptions in overlay — execution deferred to Phase 9"
  - "groq-vision import retained in service-worker with eslint-disable comment — Phase 8+ migration"
  - "groqKey gate removed from runPipeline and runFollowUp — Nova via backend is now primary AI path"
metrics:
  duration: 9m 12s
  completed: 2026-03-15
  tasks: 3
  files: 7
---

# Phase 07 Plan 02: Extension Pipeline — DOM Scraper, Overlay-Safe Screenshot, Nova Task API

**One-liner:** DOM scraper + overlay-hidden screenshot + sendTask() wiring the full voice-to-Nova pipeline via POST /task.

## What Was Built

The extension now has a complete pipeline from voice command through to Nova 2 Lite reasoning:

1. User speaks -> audio captured by offscreen recorder
2. `runPipeline` captures screenshot with overlay hidden (so Nova sees the actual page)
3. DOM snapshot scraped from page: buttons, links, inputs, forms, truncated text
4. All three (command + screenshot + DOM) sent to backend POST /task
5. Response handled: `answer` type displayed as text, `steps` type displayed as numbered action list

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create DOM scraper and wire into content script | 9bf8796 | dom-scraper.ts (new), content-script.ts, types.ts, overlay.ts, listening-indicator.ts |
| 2 | Hide overlay before screenshot capture | 770c316 | screenshot.ts, service-worker.ts |
| 3 | Wire pipeline to send command + screenshot + DOM to POST /task | d150c0c | backend-client.ts, service-worker.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] overlay/indicator hideForScreenshot methods added during Task 1**

- **Found during:** Task 1 verification (webpack build)
- **Issue:** content-script.ts references `overlay.hideForScreenshot()` and `indicator.hideForScreenshot()` in the hide-overlay handler, but those methods were only scheduled for Task 2. Build failed with TS2339 errors.
- **Fix:** Added `hideForScreenshot()` and `showAfterScreenshot()` to both `Overlay` (overlay.ts) and `ListeningIndicator` (listening-indicator.ts) during Task 1 so the content-script could compile cleanly. Task 2 then had these already done.
- **Files modified:** src/content/overlay.ts, src/content/listening-indicator.ts
- **Commit:** 9bf8796 (included in Task 1 commit)

**2. [Rule 1 - Cleanup] Removed unused imports from service-worker.ts**

- **Found during:** Task 3 implementation
- **Issue:** `getApiKeys`, `getSettings` were no longer called after removing the Groq pipeline; keeping them would leave dead imports.
- **Fix:** Removed `getApiKeys` and `getSettings` from the storage import. Retained groq-vision import with eslint-disable comment per plan instructions (Phase 8+ migration).
- **Files modified:** src/background/service-worker.ts
- **Commit:** d150c0c (included in Task 3 commit)

## Self-Check: PASSED

- [x] src/content/dom-scraper.ts exists and exports scrapeDom
- [x] content-script.ts handles scrape-dom, hide-overlay, show-overlay messages
- [x] screenshot.ts sends hide-overlay/show-overlay around capture when tabId provided
- [x] backend-client.ts exports sendTask with POST /task implementation
- [x] service-worker.ts runPipeline calls sendTask with transcript + screenshot + domSnapshot
- [x] Groq API key gate removed from pipeline
- [x] All 3 task commits exist: 9bf8796, 770c316, d150c0c
- [x] webpack --mode production compiled successfully (no errors)
