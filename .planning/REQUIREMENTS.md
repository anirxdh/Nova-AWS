# Requirements: ScreenSense Voice

**Defined:** 2026-03-14
**Core Value:** Users can speak to their screen and get instant answers or automated task execution without leaving the page

## v2.0 Requirements — Plan 1: Core Nova Agent

### Backend

- [x] **BACK-01**: FastAPI server scaffold with CORS, health check, `.env` for AWS credentials
- [x] **BACK-02**: POST /transcribe endpoint — receives audio, calls Nova Sonic STT, returns transcript
- [ ] **BACK-03**: POST /task endpoint — receives command + screenshot + DOM snapshot, calls Nova 2 Lite, returns answer or structured action steps
- [ ] **BACK-04**: SSE streaming for real-time status updates to extension (Transcribing, Understanding, Planning, step names, Done)

### AI Integration

- [x] **NOVA-01**: Nova Sonic STT via boto3 (batch mode — full audio sent after key release)
- [ ] **NOVA-02**: Nova Sonic STT streaming mode (stretch goal if time permits)
- [ ] **NOVA-03**: Nova 2 Lite reasoning — takes command + screenshot (base64) + DOM snapshot (structured JSON), returns answer or structured action steps
- [ ] **NOVA-04**: Agent loop — after each executed action, extension sends action summary + new screenshot to Nova 2 Lite; Nova decides continue or done; repeat until "Done"

### Extension

- [ ] **EXT-01**: Rewire service worker to send audio/screenshots to FastAPI backend instead of Groq APIs
- [ ] **EXT-02**: DOM scraper — captures full page structure (buttons, links, inputs, forms, text content) with selectors and visibility status
- [ ] **EXT-03**: Hide overlay/bubble before screenshot capture, re-show after
- [ ] **EXT-04**: Unified cursor-following UI — waveform, status updates, step execution updates, Q&A streaming answers, all attached to mouse movement; replaces current static overlay
- [ ] **EXT-05**: DOM automation executor — executes click, type, navigate, extract, scroll actions from backend step plans
- [ ] **EXT-06**: Action summary reporter — after each action, describes what was done, which element, and why
- [ ] **EXT-07**: Action safety allowlist — validate action types against allowlist, sanitize selectors, reject unknown actions

## v2.0 Requirements — Plan 2: Alexa + Polish (Deferred)

### Alexa Integration

- **ALXA-01**: Alexa Skill with RunScreenSenseTask intent and TaskCommand slot
- **ALXA-02**: Lambda function to forward Alexa commands to FastAPI backend
- **ALXA-03**: Session management — extension registers with backend, Alexa routes to active session
- **ALXA-04**: Result return — Lambda speaks result back to user via Alexa TTS

### Nova Act

- **NACT-01**: Nova Act integration for UI automation (when available and tab-scoped)

### Polish

- **DEMO-01**: Demo script with fixed URLs and utterances (3-minute flow)
- **DEMO-02**: Error handling, timeouts, fallback states

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / multi-device persistence | Hackathon time constraint |
| Chrome Web Store submission | Post-hackathon polish |
| Multi-tab simultaneous execution | Complexity beyond hackathon scope |
| Payment/checkout confirmation flows | Safety concerns for demo |
| Full Nova Act if it can't target extension tab | Use DOM fallback instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BACK-01 | Phase 6 | Complete |
| BACK-02 | Phase 6 | Complete |
| BACK-03 | Phase 7 | Pending |
| BACK-04 | Phase 6 + Phase 8 | Pending |
| NOVA-01 | Phase 6 | Complete |
| NOVA-02 | Phase 10 | Pending |
| NOVA-03 | Phase 7 | Pending |
| NOVA-04 | Phase 10 | Pending |
| EXT-01 | Phase 6 | Pending |
| EXT-02 | Phase 7 | Pending |
| EXT-03 | Phase 7 | Pending |
| EXT-04 | Phase 8 | Pending |
| EXT-05 | Phase 9 | Pending |
| EXT-06 | Phase 9 | Pending |
| EXT-07 | Phase 9 | Pending |

**Coverage:**
- Plan 1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 — traceability filled after roadmap creation*
