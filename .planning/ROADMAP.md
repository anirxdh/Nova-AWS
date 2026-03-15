# Roadmap: ScreenSense Voice

## Milestones

- ✅ **v1.0 Voice Q&A** - Phases 1-5 (shipped March 2026)
- 🚧 **v2.0 Core Nova Agent** - Phases 6-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 Voice Q&A (Phases 1-5) - SHIPPED March 2026</summary>

Built during Global Engineering Hackathon 2026. Push-to-talk Chrome extension with Groq Whisper STT, Llama 4 Vision Q&A, streaming overlay, TTS, conversation memory, and settings page. No task execution.

</details>

### 🚧 v2.0 Core Nova Agent (In Progress)

**Milestone Goal:** Transform ScreenSense Voice from a Q&A assistant into a screen-aware AI execution agent. Users speak a command, Nova interprets it, and the extension either answers or executes steps on the page autonomously.

- [x] **Phase 6: Backend Foundation** - FastAPI server with Nova Sonic STT endpoint and SSE streaming (completed 2026-03-15)
- [x] **Phase 7: Nova Reasoning + DOM Context** - Nova 2 Lite Q&A using screenshot + DOM snapshot via backend (completed 2026-03-15)
- [ ] **Phase 8: Unified Cursor UI** - Live status bubble attached to cursor, fed by SSE events
- [x] **Phase 9: DOM Automation** - Click, type, navigate, scroll executor with safety allowlist (completed 2026-03-15)
- [x] **Phase 10: Agent Loop** - Re-observe after each action, continue until Nova says Done (completed 2026-03-15)

## Phase Details

### Phase 6: Backend Foundation
**Goal**: A running FastAPI backend that accepts audio, transcribes it with Nova Sonic, and can stream status events back to the extension
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: BACK-01, BACK-02, BACK-04, NOVA-01, EXT-01
**Success Criteria** (what must be TRUE):
  1. Developer can start the backend with one command and the /health endpoint returns 200
  2. User holds backtick, speaks, releases — audio travels to backend, Nova Sonic transcribes it, transcript appears in extension console
  3. Backend emits SSE events (Transcribing, Done) that the extension receives and logs
  4. Extension no longer calls Groq APIs directly — all AI calls go through FastAPI
**Plans:** 2/2 plans complete
Plans:
- [x] 06-01-PLAN.md — FastAPI scaffold + POST /transcribe with Nova Sonic STT
- [x] 06-02-PLAN.md — SSE event streaming + extension service worker rewire

### Phase 7: Nova Reasoning + DOM Context
**Goal**: Nova 2 Lite receives a user command plus full page context (screenshot + DOM snapshot) and returns either a plain answer or a structured action plan
**Depends on**: Phase 6
**Requirements**: BACK-03, NOVA-03, EXT-02, EXT-03
**Success Criteria** (what must be TRUE):
  1. User asks "What is the price of this item?" and gets a spoken/text answer drawn from the visible page
  2. User asks "Add this to cart" and backend returns a structured list of action steps (not yet executed)
  3. Screenshot sent to Nova excludes the extension's own overlay bubble
  4. DOM snapshot includes visible buttons, links, inputs, and forms with CSS selectors
**Plans:** 2/2 plans complete
Plans:
- [ ] 07-01-PLAN.md — Nova 2 Lite reasoning service + POST /task endpoint
- [ ] 07-02-PLAN.md — DOM scraper, overlay-safe screenshot, and pipeline wiring

### Phase 8: Unified Cursor UI
**Goal**: A single cursor-following bubble replaces all current static overlays and shows live state transitions (Listening -> Transcribing -> Understanding -> Planning -> Done) driven by SSE events from the backend
**Depends on**: Phase 7
**Requirements**: BACK-04, EXT-04
**Success Criteria** (what must be TRUE):
  1. A bubble appears near the cursor the moment the user presses backtick and moves with the mouse throughout the interaction
  2. The bubble label changes in real-time as SSE events arrive: Listening -> Transcribing -> Understanding -> Planning -> Done
  3. When Nova returns an answer, the streaming text renders inside the bubble (not a separate overlay)
  4. When steps are executing, the bubble shows the current step name
**Plans:** 2 plans
Plans:
- [ ] 08-01-PLAN.md — CursorBubble component with all visual states and cursor tracking
- [ ] 08-02-PLAN.md — Wire CursorBubble into extension pipeline with SSE event forwarding

### Phase 9: DOM Automation
**Goal**: The extension executes action steps returned by Nova -- clicking elements, typing into inputs, navigating to URLs, scrolling -- safely and with a full audit trail per action
**Depends on**: Phase 8
**Requirements**: EXT-05, EXT-06, EXT-07
**Success Criteria** (what must be TRUE):
  1. User says "Click the Add to Cart button" and the extension locates and clicks the correct element on the page
  2. User says "Search for wireless headphones" and the extension types the query into the search box and submits
  3. Unknown or unsafe action types are rejected before execution and the user sees an error state in the bubble
  4. After each action the bubble shows a brief human-readable summary of what was done and to which element
**Plans:** 2/2 plans complete
Plans:
- [ ] 09-01-PLAN.md — Action executor module with safety allowlist, sanitizer, and content-script handler
- [ ] 09-02-PLAN.md — Service worker step execution orchestrator with bubble progress

### Phase 10: Agent Loop
**Goal**: After each executed action the extension re-captures the page and asks Nova whether the task is complete; Nova either issues the next step or signals Done, continuing autonomously until finished
**Depends on**: Phase 9
**Requirements**: NOVA-04, NOVA-02
**Success Criteria** (what must be TRUE):
  1. User says "Find the cheapest USB-C cable on this page and add it to cart" and the extension executes multiple steps without further user input until the item is in the cart
  2. After every action Nova re-evaluates the updated screenshot and either produces the next step or returns Done
  3. The cursor bubble reflects each new step name as the loop iterates
  4. If Nova Sonic streaming mode is available, transcription begins before key release (stretch -- gracefully falls back to batch if not)
**Plans:** 2/2 plans complete
Plans:
- [ ] 10-01-PLAN.md — Agent loop: backend continue-mode reasoning + frontend observe-act loop (NOVA-04)
- [ ] 10-02-PLAN.md — Stretch: streaming STT with batch fallback (NOVA-02)

## Progress

**Execution Order:** Phases execute in numeric order: 6 -> 7 -> 8 -> 9 -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Backend Foundation | 2/2 | Complete   | 2026-03-15 | - |
| 7. Nova Reasoning + DOM Context | 2/2 | Complete   | 2026-03-15 | - |
| 8. Unified Cursor UI | v2.0 | 0/2 | Planning complete | - |
| 9. DOM Automation | 2/2 | Complete   | 2026-03-15 | - |
| 10. Agent Loop | 2/2 | Complete   | 2026-03-15 | - |
