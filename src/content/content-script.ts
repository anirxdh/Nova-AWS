import './content.css';
import { initShortcutHandler } from './shortcut-handler';
import { CursorBubble } from './cursor-bubble';
import { stop as stopTts } from './tts';
import { scrapeDom } from './dom-scraper';

const isTopFrame = window === window.top;

// Shortcut handler runs in ALL frames (needed for Google Docs iframes)
initShortcutHandler();

// Everything below only runs in the top frame
if (!isTopFrame) {
  // Stop here for iframes — shortcut handler is enough
} else {

const bubble = new CursorBubble();

let lastCursorX = 0;
let lastCursorY = 0;

// Lightweight mouse tracking for initial show position only
// CursorBubble handles its own tracking internally once shown
document.addEventListener('mousemove', (e: MouseEvent) => {
  lastCursorX = e.clientX;
  lastCursorY = e.clientY;
}, { passive: true });

// Safe message sender — prevents unhandled promise rejections
function sendMessage(msg: Record<string, unknown>): void {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// Wire up bubble callbacks for follow-up and clear
bubble.setCallbacks(
  (text: string) => sendMessage({ action: 'follow-up', text }),
  () => sendMessage({ action: 'clear-conversation' })
);

async function onHold(event: Event): Promise<void> {
  const detail = (event as CustomEvent).detail;
  lastCursorX = detail.cursorX;
  lastCursorY = detail.cursorY;

  // Stop TTS when user starts recording again
  stopTts();

  // Show the bubble at cursor position in listening state
  bubble.show(lastCursorX, lastCursorY);
  bubble.setState('listening');
}

async function onRelease(event: Event): Promise<void> {
  const detail = (event as CustomEvent).detail;

  // If this is an auto-stop synthetic release, skip (already handled)
  if (detail?.autoStop) return;

  // Ensure bubble is visible
  if (!bubble.isVisible()) {
    bubble.show(lastCursorX, lastCursorY);
  } else {
    // If bubble was already visible (follow-up context), prepare for new content
    bubble.prepareForFollowUp();
  }
  // Do NOT set state here — SSE events from the backend will drive state transitions
}

// Listen for messages from background (pipeline stages, streaming, errors, amplitude)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle scrape-dom first — needs async sendResponse
  if (message.action === 'scrape-dom') {
    const snapshot = scrapeDom();
    sendResponse({ ok: true, snapshot });
    return true; // keep message channel open for sendResponse
  }

  // Handle bubble visibility for screenshot capture
  if (message.action === 'hide-overlay') {
    bubble.hideForScreenshot();
    sendResponse({ ok: true });
    return false;
  } else if (message.action === 'show-overlay') {
    bubble.showAfterScreenshot();
    sendResponse({ ok: true });
    return false;
  }

  if (message.action === 'bubble-state') {
    bubble.setState(message.state, message.label);
  } else if (message.action === 'bubble-answer-chunk') {
    bubble.appendChunk(message.text);
  } else if (message.action === 'bubble-answer-done') {
    bubble.onAnswerDone();
  } else if (message.action === 'bubble-step') {
    bubble.setStep(message.stepName, message.stepIndex, message.totalSteps);
  } else if (message.action === 'amplitude-data') {
    bubble.updateAmplitude(new Uint8Array(message.data));
  } else if (message.action === 'tts-summary') {
    bubble.speakSummary(message.summary);
  } else if (message.action === 'conversation-info') {
    bubble.updateConversationInfo(message.info);
  } else if (message.action === 'pipeline-error') {
    bubble.showError(message.error);
  }
});

// Listen for shortcut custom events
document.addEventListener('screensense-hold', onHold);
document.addEventListener('screensense-release', onRelease);

console.log('[ScreenSense] Content script loaded');

} // end isTopFrame
