import './content.css';
import { initShortcutHandler } from './shortcut-handler';
import { ListeningIndicator } from './listening-indicator';
import { Overlay } from './overlay';
import { stop as stopTts } from './tts';

const isTopFrame = window === window.top;

// Shortcut handler runs in ALL frames (needed for Google Docs iframes)
initShortcutHandler();

// Everything below only runs in the top frame
if (!isTopFrame) {
  // Stop here for iframes — shortcut handler is enough
} else {

const indicator = new ListeningIndicator();
const overlay = new Overlay();
let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

let lastCursorX = 0;
let lastCursorY = 0;

// Safe message sender — prevents unhandled promise rejections
function sendMessage(msg: Record<string, unknown>): void {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// Wire up overlay callbacks for follow-up and clear
overlay.setCallbacks(
  (text: string) => sendMessage({ action: 'follow-up', text }),
  () => sendMessage({ action: 'clear-conversation' })
);

function startCursorTracking(): void {
  mouseMoveHandler = (e: MouseEvent) => {
    lastCursorX = e.clientX;
    lastCursorY = e.clientY;
    indicator.updatePosition(e.clientX, e.clientY);
  };
  document.addEventListener('mousemove', mouseMoveHandler, { passive: true });
}

function stopCursorTracking(): void {
  if (mouseMoveHandler) {
    document.removeEventListener('mousemove', mouseMoveHandler);
    mouseMoveHandler = null;
  }
}

async function onHold(event: Event): Promise<void> {
  const detail = (event as CustomEvent).detail;
  lastCursorX = detail.cursorX;
  lastCursorY = detail.cursorY;

  // Stop TTS when user starts recording again
  stopTts();

  // Show the waveform indicator
  indicator.show(lastCursorX, lastCursorY);

  // Start cursor tracking for indicator
  startCursorTracking();
}

async function onRelease(event: Event): Promise<void> {
  const detail = (event as CustomEvent).detail;

  // If this is an auto-stop synthetic release, skip (already handled)
  if (detail?.autoStop) return;

  // Hide the waveform indicator
  indicator.hide();
  stopCursorTracking();

  // If overlay is visible (voice follow-up), prepare it for new content
  if (overlay.isVisible()) {
    overlay.prepareForFollowUp();
  } else {
    // Show overlay at cursor position
    overlay.show(lastCursorX, lastCursorY);
  }
}

// Listen for messages from background (pipeline stages, streaming, errors, amplitude)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'pipeline-stage') {
    overlay.updateStage(message.stage, message.transcript);
  } else if (message.action === 'stream-chunk') {
    overlay.appendChunk(message.text);
  } else if (message.action === 'stream-complete') {
    overlay.onStreamComplete();
  } else if (message.action === 'tts-summary') {
    overlay.speakSummary(message.summary);
  } else if (message.action === 'pipeline-error') {
    overlay.showError(message.error);
  } else if (message.action === 'conversation-info') {
    overlay.updateConversationInfo(message.info);
  } else if (message.action === 'amplitude-data') {
    // Forward amplitude data to the waveform indicator
    indicator.updateAmplitude(new Uint8Array(message.data));
  }
});

// Listen for shortcut custom events
document.addEventListener('screensense-hold', onHold);
document.addEventListener('screensense-release', onRelease);

console.log('[ScreenSense] Content script loaded');

} // end isTopFrame
