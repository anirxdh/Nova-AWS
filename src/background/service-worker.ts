import { ExtensionState, IconState, MessageType, ConversationTurn, ConversationInfo } from '../shared/types';
import { isMicPermissionGranted, getApiKeys, getSettings } from '../shared/storage';
import { MAX_CONVERSATION_TURNS } from '../shared/constants';
import { captureScreenshot } from './screenshot';
import { transcribeAudio } from './api/groq-stt';
import { streamGeminiResponse, generateTtsSummary } from './api/groq-vision';

let currentState: ExtensionState = 'idle';
let latestScreenshot: string | undefined;
let pendingTabId: number | null = null;
let recordingTabId: number | null = null;
let offscreenReady = false;

// Per-tab conversation history
const conversations = new Map<number, ConversationTurn[]>();

function getConversation(tabId: number): ConversationTurn[] {
  if (!conversations.has(tabId)) {
    conversations.set(tabId, []);
  }
  return conversations.get(tabId)!;
}

function clearConversation(tabId: number): void {
  conversations.delete(tabId);
}

function getConversationInfo(tabId: number): ConversationInfo {
  const history = conversations.get(tabId) || [];
  return {
    turns: Math.floor(history.length / 2),
    maxTurns: MAX_CONVERSATION_TURNS,
  };
}

// ─── Offscreen Document Management ───

async function ensureOffscreen(): Promise<void> {
  const chrome_ = chrome as any;

  const contexts = await chrome_.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (contexts && contexts.length > 0) {
    offscreenReady = true;
    return;
  }

  await chrome_.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Microphone recording for voice queries',
  });
  offscreenReady = true;
}

// ─── Icon & State ───

function openWelcomeTab(): void {
  const welcomeUrl = chrome.runtime.getURL('welcome.html');
  chrome.tabs.create({ url: welcomeUrl });
}

function updateToolbarIcon(iconState: IconState): void {
  switch (iconState) {
    case 'inactive':
      chrome.action.setBadgeText({ text: '' });
      break;
    case 'ready':
      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      break;
    case 'recording':
      chrome.action.setBadgeText({ text: 'REC' });
      chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
      break;
  }
}

async function resolveIconState(): Promise<void> {
  if (currentState === 'listening') {
    updateToolbarIcon('recording');
  } else {
    const micGranted = await isMicPermissionGranted();
    updateToolbarIcon(micGranted ? 'ready' : 'inactive');
  }
}

function sendToTab(tabId: number, message: MessageType): void {
  chrome.tabs.sendMessage(tabId, message);
}

function broadcastStateChange(state: ExtensionState): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'state-changed' as const,
        state,
      });
    }
  });
}

// ─── Pipeline ───

async function runPipeline(tabId: number, audioBase64: string, mimeType: string): Promise<void> {
  try {
    // Capture screenshot
    let screenshot: string;
    try {
      screenshot = await captureScreenshot();
    } catch {
      sendToTab(tabId, { action: 'pipeline-error', error: 'Could not capture screen' });
      currentState = 'idle';
      resolveIconState();
      broadcastStateChange('idle');
      return;
    }

    // Check API keys
    const keys = await getApiKeys();
    if (!keys.groqKey) {
      sendToTab(tabId, {
        action: 'pipeline-error',
        error: 'Add your API key in Settings to get started',
      });
      currentState = 'idle';
      resolveIconState();
      broadcastStateChange('idle');
      return;
    }

    // Stage 1: Transcribe audio
    sendToTab(tabId, { action: 'pipeline-stage', stage: 'transcribing' });

    let transcript: string;
    try {
      transcript = await transcribeAudio(audioBase64, mimeType, keys.groqKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't catch that — try holding a bit longer";
      sendToTab(tabId, { action: 'pipeline-error', error: msg });
      currentState = 'idle';
      resolveIconState();
      broadcastStateChange('idle');
      return;
    }

    sendToTab(tabId, { action: 'pipeline-stage', stage: 'thinking', transcript });

    // Read settings for explanation level and display mode
    const settings = await getSettings();

    // Stage 2: Streaming response with conversation history
    sendToTab(tabId, { action: 'pipeline-stage', stage: 'streaming' });
    const history = getConversation(tabId);

    let fullText: string;
    try {
      fullText = await streamGeminiResponse(
        screenshot,
        transcript,
        keys.groqKey,
        (chunk: string) => sendToTab(tabId, { action: 'stream-chunk', text: chunk }),
        history,
        settings.explanationLevel
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong — give it another try';
      sendToTab(tabId, { action: 'pipeline-error', error: msg });
      currentState = 'idle';
      resolveIconState();
      broadcastStateChange('idle');
      return;
    }

    // Add turn to conversation history
    history.push({ role: 'user', content: transcript });
    history.push({ role: 'assistant', content: fullText });

    while (history.length > MAX_CONVERSATION_TURNS * 2) {
      history.shift();
      history.shift();
    }

    sendToTab(tabId, { action: 'stream-complete', fullText });
    sendToTab(tabId, { action: 'pipeline-stage', stage: 'complete' });
    sendToTab(tabId, { action: 'conversation-info', info: getConversationInfo(tabId) });

    // Generate TTS summary in background (fire-and-forget to avoid blocking follow-ups)
    if (settings.displayMode !== 'text-only') {
      generateTtsSummary(fullText, transcript, keys.groqKey).then((summary) => {
        sendToTab(tabId, { action: 'tts-summary', summary });
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[ScreenSense] Pipeline error:', err);
    sendToTab(tabId, { action: 'pipeline-error', error: 'Something went wrong — give it another try' });
  } finally {
    currentState = 'idle';
    resolveIconState();
    broadcastStateChange('idle');
  }
}

/** Run a follow-up text query (no audio transcription needed) */
async function runFollowUp(tabId: number, text: string): Promise<void> {
  currentState = 'processing';
  broadcastStateChange('processing');

  try {
    const keys = await getApiKeys();
    if (!keys.groqKey) {
      sendToTab(tabId, { action: 'pipeline-error', error: 'Add your API key in Settings to get started' });
      return;
    }

    let screenshot: string;
    try {
      screenshot = await captureScreenshot();
    } catch {
      sendToTab(tabId, { action: 'pipeline-error', error: 'Could not capture screen' });
      return;
    }

    // Read settings for explanation level and display mode
    const settings = await getSettings();

    sendToTab(tabId, { action: 'pipeline-stage', stage: 'thinking', transcript: text });
    sendToTab(tabId, { action: 'pipeline-stage', stage: 'streaming' });

    const history = getConversation(tabId);

    let fullText: string;
    try {
      fullText = await streamGeminiResponse(
        screenshot,
        text,
        keys.groqKey,
        (chunk: string) => sendToTab(tabId, { action: 'stream-chunk', text: chunk }),
        history,
        settings.explanationLevel
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong — give it another try';
      sendToTab(tabId, { action: 'pipeline-error', error: msg });
      return;
    }

    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: fullText });

    while (history.length > MAX_CONVERSATION_TURNS * 2) {
      history.shift();
      history.shift();
    }

    sendToTab(tabId, { action: 'stream-complete', fullText });
    sendToTab(tabId, { action: 'pipeline-stage', stage: 'complete' });
    sendToTab(tabId, { action: 'conversation-info', info: getConversationInfo(tabId) });

    // Generate TTS summary in background (fire-and-forget to avoid blocking follow-ups)
    if (settings.displayMode !== 'text-only') {
      generateTtsSummary(fullText, text, keys.groqKey).then((summary) => {
        sendToTab(tabId, { action: 'tts-summary', summary });
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[ScreenSense] Follow-up error:', err);
    sendToTab(tabId, { action: 'pipeline-error', error: 'Something went wrong — give it another try' });
  } finally {
    currentState = 'idle';
    resolveIconState();
    broadcastStateChange('idle');
  }
}

// ─── Lifecycle ───

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    openWelcomeTab();
  }
  resolveIconState();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes['screensense-mic-granted']) {
    resolveIconState();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  conversations.delete(tabId);
});

// ─── Message Handling ───

chrome.runtime.onMessage.addListener(
  (
    message: MessageType & { target?: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    // Ignore messages meant for offscreen document
    if (message.target === 'offscreen') return false;

    switch (message.action) {
      case 'shortcut-hold':
        currentState = 'listening';
        recordingTabId = sender.tab?.id ?? null;
        updateToolbarIcon('recording');
        broadcastStateChange(currentState);
        // Start recording via offscreen document
        ensureOffscreen().then(() => {
          chrome.runtime.sendMessage({ target: 'offscreen', action: 'start-recording' });
        });
        sendResponse({ ok: true, state: currentState });
        break;

      case 'shortcut-release':
        currentState = 'processing';
        broadcastStateChange(currentState);
        pendingTabId = sender.tab?.id ?? recordingTabId;
        // Stop recording in offscreen — audio comes back via offscreen-recording-complete
        chrome.runtime.sendMessage({ target: 'offscreen', action: 'stop-recording' });
        sendResponse({ ok: true, state: currentState });
        break;

      case 'offscreen-amplitude' as string:
        // Forward amplitude data to the recording tab's content script for waveform
        if (recordingTabId) {
          chrome.tabs.sendMessage(recordingTabId, {
            action: 'amplitude-data',
            data: (message as any).data,
          });
        }
        break;

      case 'offscreen-started' as string:
        console.log('[ScreenSense] Offscreen recording started');
        break;

      case 'offscreen-recording-complete' as string: {
        const msg = message as any;
        console.log('[ScreenSense] Offscreen recording complete, length:', msg.audioBase64?.length);
        const tabId = pendingTabId;
        pendingTabId = null;
        if (tabId && msg.audioBase64) {
          runPipeline(tabId, msg.audioBase64, msg.mimeType);
        }
        break;
      }

      case 'offscreen-error' as string:
        console.error('[ScreenSense] Offscreen error:', (message as any).error);
        if (pendingTabId) {
          sendToTab(pendingTabId, { action: 'pipeline-error', error: (message as any).error });
        }
        currentState = 'idle';
        resolveIconState();
        broadcastStateChange('idle');
        break;

      case 'capture-screenshot':
        captureScreenshot().then((dataUrl) => {
          sendResponse({ ok: true, dataUrl });
        });
        return true;

      case 'follow-up':
        if (sender.tab?.id) {
          runFollowUp(sender.tab.id, (message as any).text);
        }
        sendResponse({ ok: true });
        break;

      case 'clear-conversation':
        if (sender.tab?.id) {
          clearConversation(sender.tab.id);
          sendToTab(sender.tab.id, {
            action: 'conversation-info',
            info: { turns: 0, maxTurns: MAX_CONVERSATION_TURNS },
          });
        }
        sendResponse({ ok: true });
        break;

      case 'get-conversation-info':
        if (sender.tab?.id) {
          sendResponse({ ok: true, info: getConversationInfo(sender.tab.id) });
        } else {
          sendResponse({ ok: true, info: { turns: 0, maxTurns: MAX_CONVERSATION_TURNS } });
        }
        break;

      case 'get-state':
        sendResponse({ ok: true, state: currentState });
        break;

      case 'open-welcome':
        openWelcomeTab();
        sendResponse({ ok: true });
        break;

      case 'check-mic-permission':
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown action' });
    }

    return false;
  }
);
