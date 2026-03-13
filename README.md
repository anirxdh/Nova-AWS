<p align="center">
  <img src="public/icons/icon-128.png" alt="ScreenSense Voice" width="80" />
</p>

<h1 align="center">ScreenSense Voice</h1>

<p align="center">
  <strong>Talk to your screen. Get instant answers.</strong><br/>
  A voice-first AI Chrome extension that sees your screen and answers your questions — by voice, text, or both.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Built%20at-Global%20Hack%202026-818cf8?style=for-the-badge" alt="Global Hack 2026" />
  <img src="https://img.shields.io/badge/Platform-Chrome%20Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/Manifest-V3-10B981?style=for-the-badge" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/TypeScript-100%25-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

---

## The Problem

We kept running into the same annoying workflow — see something confusing on screen, take a screenshot, open a new tab, drag it into ChatGPT or Claude, type the question, wait, then switch back. Half the time the screenshots pile up on the desktop. The other half we lose context switching between tabs.

**ScreenSense Voice** fixes this. Hold a key, speak your question, get the answer right there on the page. No screenshots. No tab switching. No copy-pasting. Done.

---

## Setup Guide (Step by Step)

### Step 1: Get the code

```bash
git clone https://github.com/anirxdh/global-engineering-hack.git
cd global-engineering-hack
npm install
npm run build
```

This creates a `dist/` folder — that's what Chrome needs.

### Step 2: Load into Chrome

1. Open your browser and go to **[chrome://extensions/](chrome://extensions/)**
2. Turn on **Developer mode** (toggle in the top right corner)
3. Click **"Load unpacked"**
4. Navigate to the ScreenSense folder you just cloned and select the **`dist/`** folder inside it
5. You should see the ScreenSense icon appear in your Chrome toolbar

> **Tip:** If you don't see the icon, click the puzzle piece icon in the toolbar and pin ScreenSense.

### Step 3: Get your API keys

You need **one free API key** to get started:

| Key | Required? | Where to get it | Cost |
|-----|-----------|-----------------|------|
| **Groq API Key** | Yes | [console.groq.com/keys](https://console.groq.com/keys) | Free |
| **ElevenLabs API Key** | Optional (for natural voice) | [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) | Free tier: 10k chars/month |

### Step 4: Configure the extension

1. Click the **ScreenSense icon** in your toolbar
2. Click **"Settings"**
3. Paste your **Groq API Key** (required)
4. Optionally paste your **ElevenLabs API Key** (for natural-sounding voice — without it, the browser's built-in voice is used)
5. Choose your **Display Mode**:
   - **Both** — streaming text overlay + short spoken summary (default)
   - **Audio Only** — animated waveform with spoken summary, no text
   - **Text Only** — streaming text, no audio
6. Choose your **Explanation Level** (Kid, Student, College, PhD, or Executive)
7. Click **Save Changes**

### Step 5: Use it!

1. Go to **any webpage**
2. **Hold the backtick key** (`` ` ``) — a waveform appears near your cursor
3. **Ask your question** while holding the key (e.g., *"What does this error mean?"*)
4. **Release the key** — the AI reads your screen and streams the answer
5. **Type a follow-up** in the overlay input box, or hold backtick again for another voice question
6. Press **Escape** to dismiss

That's it. No accounts, no sign-ups, just your free API key and you're good to go.

---

## Features

### Voice-First Interaction
- **Hold-to-talk**: Press and hold backtick (`` ` ``) to start recording
- **Real-time waveform**: Animated visualization follows your cursor while recording
- **Whisper transcription**: Groq's Whisper Large V3 Turbo for fast, accurate speech-to-text

### Screen-Aware AI
- **Screenshot capture**: Automatically captures what's on your screen when you ask
- **Vision model**: Llama 4 Scout understands your screenshot
- **Streaming responses**: Text streams in real-time, word by word
- **Conversation memory**: Up to 20 follow-up turns per tab with full context

### Smart Audio Summaries
- **TTS summaries**: AI generates a concise ~3 second spoken summary instead of reading everything
- **ElevenLabs voice**: Natural-sounding Rachel voice
- **Browser fallback**: Uses Web Speech API if no ElevenLabs key is set

### Display Modes
| Mode | Text Overlay | Audio |
|------|:-----------:|:-----:|
| **Both** (default) | Full streaming text | Short spoken summary |
| **Audio Only** | Animated waveform | Short spoken summary, auto-dismisses |
| **Text Only** | Full streaming text | Silent |

### Explanation Levels
| Level | Style |
|-------|-------|
| **Kid** | Simple words, fun comparisons, like explaining to a 5-year-old |
| **Student** | Clear language, relatable examples, high school level |
| **College** | Technical terms when needed, accessible explanations |
| **PhD** | Precise terminology, deep domain knowledge assumed |
| **Executive** | Concise, impact-focused, trade-offs and strategic implications |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Content Script (Tab)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Shortcut    │  │  Listening   │  │     Overlay       │  │
│  │   Handler     │  │  Indicator   │  │  (Shadow DOM)     │  │
│  └──────┬───────┘  └──────────────┘  └───────────────────┘  │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │ chrome.runtime.sendMessage
          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Service Worker (Background)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Screenshot   │  │  Groq STT   │  │   Groq Vision     │  │
│  │  Capture      │  │  (Whisper)  │  │   (Llama 4)       │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│                          │                                    │
│  ┌──────────────┐  ┌─────▼────────┐  ┌───────────────────┐  │
│  │ Conversation  │  │  TTS Summary │  │   Settings/       │  │
│  │ History       │  │  Generator   │  │   Storage         │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└─────────┬────────────────────────────────────────────────────┘
          │ chrome.runtime.sendMessage
          ▼
┌─────────────────────────────────────────────────────────────┐
│              Offscreen Document (Microphone)                  │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │ MediaRecorder │  │  Amplitude   │                          │
│  │ (Audio)       │  │  Analyzer    │                          │
│  └──────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow
1. **Hold shortcut key** → Content script → Service worker starts offscreen recording
2. **Speak** → Offscreen captures audio + sends amplitude for live waveform
3. **Release key** → Audio → Service worker pipeline:
   - Capture screenshot → Transcribe audio → Stream AI response → Generate TTS summary
4. **Content script** renders streamed markdown in real-time
5. **TTS summary** arrives → Speaks via ElevenLabs or Web Speech API

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Extension** | Chrome Manifest V3, TypeScript |
| **Speech-to-Text** | Groq Whisper API (`whisper-large-v3-turbo`) |
| **Vision + AI** | Groq Chat API (`meta-llama/llama-4-scout-17b-16e-instruct`) |
| **Text-to-Speech** | ElevenLabs API (`eleven_flash_v2_5`) + Web Speech API fallback |
| **Audio Recording** | MediaRecorder API + AudioContext (AnalyserNode for waveform) |
| **UI Isolation** | Shadow DOM (closed mode) |
| **Settings UI** | React 18 |
| **Build** | Webpack 5, TypeScript, PostCSS |
| **Landing Page** | Vanilla HTML/CSS/JS with canvas particle animation |

---

## Project Structure

```
global-engineering-hack/
├── src/
│   ├── background/
│   │   ├── service-worker.ts      # Main orchestrator & pipeline
│   │   ├── screenshot.ts          # Tab screenshot capture
│   │   └── api/
│   │       ├── groq-stt.ts        # Whisper transcription
│   │       └── groq-vision.ts     # Vision streaming + TTS summary
│   ├── content/
│   │   ├── content-script.ts      # Entry point, message routing
│   │   ├── shortcut-handler.ts    # Hold-to-talk keyboard handler
│   │   ├── listening-indicator.ts # Animated waveform component
│   │   ├── overlay.ts             # Response overlay (Shadow DOM)
│   │   ├── tts.ts                 # Text-to-speech module
│   │   ├── markdown.ts            # Lightweight markdown renderer
│   │   └── content.css            # Base styles
│   ├── offscreen/
│   │   └── offscreen.ts           # Microphone recording + amplitude
│   ├── settings/
│   │   ├── Settings.tsx           # React settings page
│   │   ├── settings.html          # Settings page shell
│   │   └── settings-entry.tsx     # React entry point
│   ├── shared/
│   │   ├── types.ts               # TypeScript interfaces
│   │   ├── constants.ts           # Default settings & storage keys
│   │   └── storage.ts             # Chrome storage helpers
│   ├── popup/                     # Extension popup
│   └── welcome/                   # First-run onboarding
├── landing/                       # Landing page (standalone)
├── public/
│   └── icons/                     # Extension icons (16, 48, 128px)
├── manifest.json                  # Chrome extension manifest (MV3)
├── webpack.config.js              # Build configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json
```

---

## How It's Different

| Feature | ChatGPT / Copilot | ScreenSense Voice |
|---------|:-----------------:|:----------------:|
| Voice input | Requires separate app | Built-in hold-to-talk |
| Screen context | Must screenshot & paste | Automatic capture |
| Response delivery | Separate tab/window | Inline overlay on current page |
| Audio response | Full text readback | Smart 3-second summary |
| Explanation levels | One-size-fits-all | 5 levels (Kid → Executive) |
| Context switching | Required | Zero |
| Works on any page | No | Yes |

---

## Privacy & Security

- **No data stored remotely** — conversation history is in-memory per tab, cleared when the tab closes
- **API keys stored locally** — saved in `chrome.storage.local`, never sent anywhere besides the API providers
- **Shadow DOM isolation** — overlay styles are completely isolated from host pages
- **HTML sanitization** — AI responses are sanitized before rendering to prevent XSS
- **Microphone access** — only active while you hold the shortcut key; stops immediately on release

---

## API Usage & Costs

| API | Free Tier | Used For |
|-----|-----------|----------|
| **Groq** | 30 RPM, 14,400 RPD | Speech-to-text + Vision AI + TTS summaries |
| **ElevenLabs** | 10,000 chars/month | Natural voice (optional) |

ScreenSense works entirely on **free tiers** — no credit card required.

---

## Built At

**Global Hack 2026** — ScreenSense was conceived, designed, and built from scratch during the hackathon.

---

## Team

Built with caffeine and conviction by our team at Global Hack 2026.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <img src="public/icons/icon-48.png" alt="ScreenSense" width="24" />
  <br/>
  <sub>ScreenSense Voice — because your screen should be able to hear you.</sub>
</p>
