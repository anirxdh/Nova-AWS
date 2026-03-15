<p align="center">
  <img src="public/icons/icon-128.png" alt="ScreenSense Voice" width="80" />
</p>

<h1 align="center">ScreenSense Voice</h1>

<p align="center">
  <strong>Your voice controls the browser. Nova AI executes.</strong><br/>
  An autonomous AI browser agent powered by Amazon Nova that sees your screen, understands context, and takes action — all by voice.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Amazon%20Nova-Hackathon%202026-FF9900?style=for-the-badge&logo=amazon&logoColor=white" alt="Amazon Nova Hackathon 2026" />
  <img src="https://img.shields.io/badge/Nova%202%20Lite-Reasoning-232F3E?style=for-the-badge&logo=amazonaws&logoColor=white" alt="Nova 2 Lite" />
  <img src="https://img.shields.io/badge/AWS-Transcribe-00A8E1?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS Transcribe" />
  <img src="https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
</p>

---

## What It Does

**Speak a command. Nova does the rest.**

Hold the backtick key, say *"Buy Quest protein bars from Amazon"*, and watch as the agent:
1. Navigates to Amazon
2. Types "Quest protein bars" into the search bar
3. Finds the cheapest option
4. Clicks on the product
5. Clicks "Add to Cart"
6. Continues to the next item if you asked for multiple products

All autonomously. No clicking. No typing. Just your voice.

---

## Amazon Nova Integration

| Nova Service | How We Use It |
|---|---|
| **Nova 2 Lite** (via Bedrock) | Multimodal reasoning — receives screenshot + DOM snapshot + voice command, returns structured action plans with chain-of-thought reasoning |
| **Amazon Transcribe Streaming** | Speech-to-text — converts voice commands to text with streaming support for any recording length |
| **Bedrock Converse API** | Agent loop — after each action, re-observes the page and asks Nova what to do next until the task is complete |

### Categories: Agentic AI + UI Automation + Voice AI + Multimodal Understanding

This project spans **all four hackathon focus areas**:
- **Agentic AI**: Autonomous observe-act-decide loop with up to 25 iterations
- **UI Automation**: Click, type, navigate, scroll, extract actions on live web pages
- **Voice AI**: Push-to-talk voice commands drive the entire interaction
- **Multimodal Understanding**: Nova sees screenshots + reads DOM structure + understands voice — 3 modalities simultaneously

---

## Setup Guide

### Prerequisites
- Node.js 16+, Python 3.8+
- AWS account with Bedrock access (Nova 2 Lite model enabled)
- Chrome browser

### Step 1: Clone and build

```bash
git clone https://github.com/anirxdh/Nova-AWS.git
cd Nova-AWS
npm install
npm run build
```

### Step 2: Backend setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` with your AWS credentials:
```
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
```

Optional (for voice readback):
```
GROQ_API_KEY=your-groq-key         # Fallback STT
ELEVENLABS_API_KEY=your-key         # Natural voice TTS
```

Start the backend:
```bash
uvicorn backend.main:app --reload
```

### Step 3: Load Chrome extension

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder
4. Pin the ScreenSense icon in your toolbar

### Step 4: Use it

1. Go to any webpage
2. **Hold backtick (`)** — waveform appears
3. **Speak your command** — *"Search YouTube for coding tutorials"*
4. **Release** — Nova starts executing
5. Watch the cursor pill show each step in real-time
6. **Hold backtick again** to cancel or start a new command

---

## Architecture

```
User Voice Command
      │
      ▼
┌─────────────────────────────────────────────────────┐
│              Chrome Extension (MV3)                   │
│                                                       │
│  Offscreen Doc ──► Service Worker ──► Content Script  │
│  (Audio Capture)   (Orchestrator)    (DOM + Actions)  │
│                         │                             │
│  ┌──────────────────────┼──────────────────────────┐  │
│  │           Agent Loop (up to 25 iterations)      │  │
│  │  Execute Action → Re-observe → Ask Nova → Loop  │  │
│  └─────────────────────────────────────────────────┘  │
└────────────────────────┬──────────────────────────────┘
                         │ HTTP / WebSocket
                         ▼
┌─────────────────────────────────────────────────────┐
│                 FastAPI Backend                        │
│                                                       │
│  POST /task ──────► Nova 2 Lite (Bedrock Converse)   │
│  POST /task/continue ► Nova 2 Lite (Continue Mode)   │
│  POST /transcribe ──► Amazon Transcribe Streaming    │
│  WS /transcribe/stream ► Streaming STT               │
│  GET /events ────────► SSE Status Updates            │
└─────────────────────┬─────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    AWS Bedrock   Amazon      ElevenLabs
    (Nova 2 Lite) Transcribe  (TTS, optional)
```

### Data Flow Per Action
1. **Screenshot** — `captureVisibleTab` (overlay hidden during capture)
2. **DOM Snapshot** — Full page scrape: buttons, links, inputs, forms, products with CSS selectors, bounding boxes, and semantic roles
3. **Nova Reasoning** — Screenshot + DOM + command sent to Nova 2 Lite via Bedrock Converse API
4. **Action Execution** — Click, type, navigate, scroll, or extract with element highlighting
5. **Re-observation** — Fresh screenshot + DOM after each action
6. **Nova Decides** — Continue (more steps), Done (task complete), or Answer (communicate to user)

---

## Key Features

### Autonomous Agent Loop
- Observe → Reason → Act → Re-observe cycle
- Up to 25 iterations per command
- Smart error recovery — failed selectors retry with fresh DOM
- Navigation handling — waits for page load after site changes

### Multimodal Understanding
- **Screenshot**: Nova sees exactly what you see
- **DOM Snapshot**: Full interactive element map with CSS selectors, bounding boxes, and semantic roles (add-to-cart, product-link, search-submit, etc.)
- **Voice Command**: Natural language transcribed via Amazon Transcribe

### Smart DOM Scraping
- Semantic element classification (add-to-cart, product-link, sort-filter, etc.)
- Stable selectors: id → data-* → aria-label → title → href → name → class+nth-of-type
- Auto-submit search boxes (detects searchbox role, presses Enter)
- Safe execution: selector sanitization, rate limiting, element highlighting

### Real-Time Visual Feedback
- Cursor-following pill shows current step
- Green pulse border during execution
- Blue pulse during re-evaluation
- Done summary with completed steps checklist
- Error display with retry status

### Voice-First Control
- Push-to-talk with backtick key
- Hold again to cancel running agent
- Escape to dismiss
- Works on any website

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **AI Reasoning** | Amazon Nova 2 Lite via AWS Bedrock Converse API |
| **Speech-to-Text** | Amazon Transcribe Streaming + Groq Whisper fallback |
| **Text-to-Speech** | ElevenLabs API + Web Speech API fallback |
| **Backend** | FastAPI, Python, boto3, SSE streaming |
| **Extension** | Chrome MV3, TypeScript, Shadow DOM |
| **DOM Automation** | Custom action executor with highlighting + retry |
| **UI** | React 18 (settings/popup), Cursor Bubble (Shadow DOM) |
| **Build** | Webpack 5, ts-loader, PostCSS, Tailwind |
| **Testing** | Jest (184 frontend tests) + pytest (136 backend tests) = 320 total |

---

## Testing

```bash
# Frontend tests (Jest)
npm test

# Backend tests (pytest)
cd backend && python -m pytest tests/ -v
```

**320 tests** covering action executor, DOM scraper, backend client, service worker, Nova reasoning, task router, transcription, and event bus.

---

## Project Structure

```
Nova-AWS/
├── src/
│   ├── background/
│   │   ├── service-worker.ts      # Agent loop orchestrator + pipeline
│   │   ├── screenshot.ts          # Tab screenshot with overlay hiding
│   │   └── api/
│   │       └── backend-client.ts  # HTTP/WebSocket client to FastAPI
│   ├── content/
│   │   ├── content-script.ts      # Message routing + bubble management
│   │   ├── action-executor.ts     # DOM actions with highlighting + retry
│   │   ├── dom-scraper.ts         # Full page scraper with semantic roles
│   │   ├── cursor-bubble.ts       # Frosted glass UI component
│   │   ├── shortcut-handler.ts    # Push-to-talk keyboard handler
│   │   └── tts.ts                 # ElevenLabs + Web Speech TTS
│   ├── offscreen/
│   │   └── offscreen.ts           # Microphone recording + amplitude
│   ├── shared/
│   │   └── types.ts               # TypeScript interfaces
│   ├── settings/                   # React settings page
│   ├── popup/                      # Extension popup
│   └── welcome/                    # Onboarding wizard
├── backend/
│   ├── main.py                     # FastAPI app
│   ├── routers/
│   │   ├── task.py                 # /task and /task/continue endpoints
│   │   └── transcribe.py          # /transcribe + WebSocket streaming
│   ├── services/
│   │   ├── nova_reasoning.py      # Nova 2 Lite reasoning (Bedrock)
│   │   ├── nova_sonic.py          # Amazon Transcribe + Groq fallback
│   │   └── event_bus.py           # SSE pub/sub
│   └── tests/                      # 136 pytest tests
├── landing/                        # Marketing landing page
├── manifest.json                   # Chrome MV3 manifest
└── webpack.config.js
```

---

## Demo

*3-minute demo video: [Coming soon]*

**Example commands:**
- *"Buy Quest protein bars from Amazon"*
- *"Play Despacito on YouTube"*
- *"What's the cheapest laptop on this page?"*
- *"Scroll down and find the reviews section"*
- *"Go to GitHub and search for react components"*

---

## Built For

**[Amazon Nova Hackathon 2026](https://amazon-nova-hackathon.devpost.com/)** — ScreenSense Voice was designed and built to showcase Amazon Nova's multimodal reasoning, agentic AI, and voice capabilities in a real-world browser automation product.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <img src="public/icons/icon-48.png" alt="ScreenSense" width="24" />
  <br/>
  <sub>ScreenSense Voice — Powered by Amazon Nova</sub>
</p>
