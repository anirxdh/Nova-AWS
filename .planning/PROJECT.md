# ScreenSense Voice

## What This Is

ScreenSense Voice is a voice-first Chrome extension (Manifest V3) that lets users talk to their screen and either get answers or execute tasks on webpages automatically. Users interact via a push-to-talk keyboard shortcut (default: backtick) or through Alexa voice commands. The system acts as a screen-aware AI execution agent: it captures screen context, interprets commands with Amazon Nova, plans steps, shows live reasoning near the cursor, and performs UI automation when required.

## Core Value

Users can speak to their screen and get instant answers or automated task execution without leaving the page, switching tabs, or using separate tools.

## Requirements

### Validated

<!-- Shipped and confirmed valuable from Global Engineering Hackathon 2026. -->

- ✓ Push-to-talk with backtick key (hold-to-talk, release-to-process) — v1.0
- ✓ Real-time waveform indicator near cursor during recording — v1.0
- ✓ Microphone recording via offscreen document (MV3 compatible) — v1.0
- ✓ Speech-to-text transcription (Groq Whisper) — v1.0
- ✓ Screenshot capture of visible tab — v1.0
- ✓ AI vision-based Q&A on screen content (Groq Llama 4) — v1.0
- ✓ Streaming text overlay response (Shadow DOM isolated) — v1.0
- ✓ Text-to-speech summaries (ElevenLabs + Web Speech API fallback) — v1.0
- ✓ Conversation memory (up to 20 turns per tab) — v1.0
- ✓ Configurable explanation levels (Kid, Student, College, PhD, Executive) — v1.0
- ✓ Display modes (Both, Audio Only, Text Only) — v1.0
- ✓ Settings page (React), popup, welcome/onboarding page — v1.0

### Active

<!-- Current scope: Amazon Nova AI Hackathon — execution agent + Nova stack + Alexa -->

- [ ] Swap AI stack from Groq to Amazon Nova (Sonic, Nova 2 Lite, Nova Act)
- [ ] Backend orchestrator server (FastAPI + boto3)
- [ ] Cursor-side thinking bubble with full state machine (Listening → Transcribing → Understanding → Planning → [steps] → Done)
- [ ] AI task planning — Nova 2 Lite interprets commands as answers or structured step plans
- [ ] DOM automation — content script executes click, type, navigate, extract, scroll actions
- [ ] AI agent loop — observe → interpret → plan → execute → re-observe → continue
- [ ] Alexa integration as secondary voice entry point (Alexa Skill + Lambda)
- [ ] Session management (extension registers with backend, Alexa routes to active session)
- [ ] Enhanced push-to-talk state machine (IDLE → LISTENING → TRANSCRIBING → UNDERSTANDING → PLANNING/ANSWERING → EXECUTING → DONE)

### Out of Scope

- Full Nova Act browser automation (if Nova Act can't target extension's tab, use DOM fallback) — integration complexity
- User accounts / multi-device session persistence — hackathon time constraint
- Chrome Web Store submission — post-hackathon polish
- Multi-tab simultaneous execution — complexity
- Payment/checkout confirmation flows — safety concerns for demo

## Context

- **Previous hackathon:** Built at Global Engineering Hackathon 2026; all AI calls were client-side via Groq free tier
- **New hackathon:** Amazon Nova AI Hackathon; must prominently use Nova Sonic, Nova 2 Lite, and Nova Act
- **Architecture shift:** Moving from client-side-only to client + backend; extension sends audio/screenshots to FastAPI backend, backend orchestrates Nova calls via boto3
- **Existing codebase:** TypeScript, React 18, Webpack 5, Chrome MV3; content script, service worker, offscreen document pattern already working
- **Demo targets:** Fixed URLs and utterances (e.g., Amazon product pages); 3-minute demo covering Q&A, task execution, and Alexa
- **48-hour timeline:** Hackathon constraint; must prioritize working demo over completeness

## Constraints

- **AI Stack**: Must use Amazon Nova (Sonic, Nova 2 Lite, Nova Act) — hackathon requirement
- **Backend**: FastAPI (Python) + boto3 for AWS Nova integration
- **Timeline**: 48-hour hackathon — ruthless prioritization required
- **Platform**: Chrome Manifest V3 — no persistent background pages, offscreen doc for mic
- **Demo**: Must show push-to-talk Q&A + task execution + Alexa in 3-minute demo
- **Security**: HTTPS only, no eval in content script, action type allowlist for DOM automation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Content script keydown/keyup for push-to-talk (not chrome.commands) | chrome.commands has no keyup event; hold-to-talk needs both | ✓ Good (already working in v1.0) |
| FastAPI + boto3 for backend | boto3 is the primary AWS SDK, Nova docs are Python-first, FastAPI has native async/streaming/WebSocket | — Pending |
| DOM fallback for UI automation (not relying solely on Nova Act) | Nova Act may not target user's browser tab; content script DOM actions are reliable | — Pending |
| Alexa as secondary entry, not primary | Push-to-talk is the core UX; Alexa adds multi-device story | — Pending |

## Current Milestone: v2.0 Nova Execution Agent

**Goal:** Transform ScreenSense Voice from a Q&A assistant into a screen-aware AI execution agent using Amazon Nova, with Alexa as secondary entry point.

**Target features:**
- Amazon Nova AI stack (Sonic STT, Nova 2 Lite reasoning, Nova Act automation)
- FastAPI + boto3 backend orchestrator
- Task execution via DOM automation
- AI agent loop (observe → plan → execute)
- Cursor-side thinking bubble with state machine
- Alexa voice integration

---
*Last updated: 2026-03-14 after milestone v2.0 initialization*
