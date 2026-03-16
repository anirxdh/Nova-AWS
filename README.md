<p align="center">
  <img src="public/icons/icon-128.png" alt="ScreenSense Voice" width="80" />
</p>

<h1 align="center">ScreenSense Voice</h1>

<p align="center">
  <strong>Your voice controls the browser. Nova AI executes.</strong><br/>
  An autonomous AI browser agent powered by Amazon Nova that sees your screen, understands context, and takes action — all by voice.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Amazon%20Nova-Lite%20v1-FF9900?style=flat-square&logo=amazon-aws" alt="Nova" />
  <img src="https://img.shields.io/badge/AWS-Transcribe-232F3E?style=flat-square&logo=amazon-aws" alt="Transcribe" />
  <img src="https://img.shields.io/badge/Chrome-MV3-4285F4?style=flat-square&logo=google-chrome" alt="Chrome" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT" />
</p>

---

## What is ScreenSense Voice?

ScreenSense Voice is a Chrome extension that turns your voice into browser actions. Hold a key, speak a command, and an AI agent powered by **Amazon Nova 2 Lite** sees your screen, reasons about what to do, and executes actions autonomously — clicking buttons, filling forms, navigating sites, and completing multi-step tasks.

**Example:** *"Add the cheapest USB-C cable to my cart on Amazon"* — ScreenSense will navigate to Amazon, search, find the cheapest option, click it, and add it to your cart. All hands-free.

### Amazon Nova Services Used

| Service | Purpose |
|---------|---------|
| **Amazon Nova 2 Lite** (Bedrock) | Multimodal reasoning — analyzes screenshots + DOM to decide actions |
| **Amazon Transcribe Streaming** | Real-time speech-to-text for voice commands |
| **ElevenLabs TTS** | Natural voice readback of AI responses (optional, falls back to browser speech) |

---

## Architecture

```
User holds ` key + speaks
        |
        v
[ Content Scripts ]  ──  Shortcut Handler, Cursor Bubble (Shadow DOM),
        |                  DOM Scraper, Action Executor, TTS Engine
        |
        v  (chrome.runtime messages)
[ Service Worker ]   ──  Pipeline Manager, Agent Loop (max 25 iterations),
        |                  Conversation Store (per-tab), Screenshot Capture
        |
        v  (HTTP / WebSocket)
[ FastAPI Backend ]  ──  POST /transcribe, POST /task, POST /task/continue,
        |                  GET /events (SSE), Nova Reasoning Service
        |
        v  (AWS SDK)
[ Cloud APIs ]       ──  AWS Bedrock (Nova Lite), AWS Transcribe,
                          Groq Whisper (STT fallback), ElevenLabs TTS
```

### How the Agent Loop Works

1. User holds backtick key and speaks a command
2. Audio is recorded via an offscreen document (MV3 sandbox)
3. Service worker captures a screenshot + scrapes the DOM
4. Backend transcribes audio (AWS Transcribe) and sends command + screenshot + DOM to Nova
5. Nova reasons and returns an action (click, type, navigate, scroll, extract)
6. Content script executes the action on the page
7. Service worker re-captures screenshot + re-scrapes DOM
8. Backend re-evaluates with Nova — loops until task is complete (max 25 iterations)

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **Google Chrome** (latest)
- **AWS Account** with Bedrock access (Nova Lite model enabled)

### 1. Clone the Repository

```bash
git clone https://github.com/anirxdh/Nova-AWS.git
cd Nova-AWS
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Build the Chrome Extension

```bash
npm run build
```

This creates a `dist/` folder with the compiled extension.

### 4. Set Up the Backend

```bash
cd backend
pip install -r requirements.txt
```

### 5. Configure API Keys

Create a `backend/.env` file with:

```env
# Required — AWS credentials for Nova Lite (Bedrock) and Transcribe
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Required — Groq API key (fallback STT if AWS Transcribe unavailable)
GROQ_API_KEY=your-groq-api-key

# Server config
BACKEND_PORT=8000
CORS_ORIGINS=chrome-extension://*
```

**Getting the keys:**

| Key | Where to get it |
|-----|----------------|
| AWS Access Key / Secret | [IAM Console](https://console.aws.amazon.com/iam/) — create a user with `AmazonBedrockFullAccess` and `AmazonTranscribeFullAccess` policies |
| Groq API Key | [console.groq.com/keys](https://console.groq.com/keys) — free, no credit card |

**Important:** Make sure Amazon Nova Lite model access is enabled in your AWS Bedrock console (us-east-1 region).

### 6. Start the Backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 7. Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder from the project root
5. The ScreenSense Voice extension will appear — click it to open the popup
6. Complete the onboarding (Welcome page) to grant microphone access

### 8. Use It

1. Navigate to any website (e.g., amazon.com)
2. **Hold the backtick key (`)** and speak your command
3. **Release** the key — ScreenSense processes your voice and executes actions
4. Watch the floating bubble as it listens, transcribes, reasons, and acts

### 9. Customize via Settings

Right-click the extension icon → **Options** (or navigate to the Settings page from the popup) to personalize your experience:

- **Shortcut Key** — Change the hold-to-talk key (default is backtick `` ` ``)
- **Hold Delay** — Adjust how long you need to hold the key before recording starts (100ms–500ms)
- **Display Mode** — Choose how AI responses are delivered: *Text + Audio*, *Audio Only*, or *Text Only*
- **Explanation Level** — Control how detailed the AI's responses are: *Kid*, *Student*, *College*, *PhD*, or *Executive*

All changes are saved per-profile and persist across sessions.

---

## Project Structure

```
Nova-AWS/
├── src/
│   ├── background/          # Service worker (orchestration, pipeline)
│   │   ├── service-worker.ts
│   │   ├── screenshot.ts
│   │   └── api/             # API clients (Groq STT, ElevenLabs, etc.)
│   ├── content/             # Content scripts (injected into web pages)
│   │   ├── content-script.ts
│   │   ├── shortcut-handler.ts
│   │   ├── cursor-bubble.ts  # Floating UI (Shadow DOM, 1700+ lines)
│   │   ├── dom-scraper.ts    # Structured page snapshot
│   │   ├── action-executor.ts # DOM manipulation (click/type/navigate)
│   │   └── tts.ts            # ElevenLabs + Web Speech API
│   ├── offscreen/            # Mic recording (MV3 sandbox)
│   ├── popup/                # Extension popup
│   ├── settings/             # Settings page (shortcut, display mode, etc.)
│   ├── welcome/              # Onboarding flow
│   └── shared/               # Types, storage, constants
├── backend/
│   ├── main.py               # FastAPI app
│   ├── routers/
│   │   ├── transcribe.py     # POST /transcribe, WS /transcribe/stream
│   │   ├── task.py           # POST /task, POST /task/continue
│   │   └── events.py         # GET /events (SSE)
│   └── services/
│       ├── nova_reasoning.py  # Amazon Nova Lite via Bedrock
│       ├── nova_sonic.py      # AWS Transcribe + Groq Whisper fallback
│       └── event_bus.py       # Pub/sub for SSE
├── landing/                   # Landing page (static HTML)
├── dist/                      # Built extension (load this in Chrome)
├── manifest.json
├── webpack.config.js
└── package.json
```

---

## Features

- **Voice-to-Action**: Hold a key, speak, release — AI handles the rest
- **Multimodal Reasoning**: Nova sees screenshots AND reads DOM structure for precise actions
- **Autonomous Agent Loop**: Re-captures screen after each action, reasons about next step (up to 25 iterations)
- **Smart DOM Scraping**: Extracts structured selectors for buttons, links, inputs, forms, products
- **Cross-Site Navigation**: Can navigate between websites to complete tasks
- **Natural TTS**: ElevenLabs voice readback with browser speech fallback
- **Explanation Levels**: Kid, Student, College, PhD, Executive — adjusts AI response depth
- **Dark/Light Theme**: Full theme support across all pages

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | TypeScript, React, Tailwind CSS, Webpack 5, Chrome MV3 |
| Backend | Python, FastAPI, uvicorn, boto3 |
| AI Reasoning | Amazon Nova 2 Lite (AWS Bedrock) |
| Speech-to-Text | AWS Transcribe Streaming (primary), Groq Whisper (fallback) |
| Text-to-Speech | ElevenLabs (optional), Web Speech API (fallback) |

---

## Hackathon Categories

This project fits multiple Amazon Nova Hackathon categories:

- **Agentic AI** — Autonomous agent loop with multi-step reasoning
- **Multimodal Understanding** — Screenshot + DOM analysis for action decisions
- **UI Automation** — Automated clicking, typing, navigating across web apps
- **Voice AI** — Real-time voice commands via AWS Transcribe

---

## License

MIT

---

<p align="center">
  Built for the <strong>Amazon Nova AI Hackathon 2026</strong><br/>
  <code>#AmazonNova</code>
</p>
