/**
 * Unit tests for src/background/service-worker.ts
 *
 * Tests the message handler, cancellation, conversation management,
 * lifecycle events, and agent loop behavior.
 *
 * The service-worker module has many side effects on import
 * (chrome.runtime.onMessage listeners, SSE init, etc.), so we set
 * up all mocks before requiring the module.
 */

// ─── Chrome API mocks (must be set up before any imports) ─────────────────────

const mockTabsSendMessage = jest.fn().mockResolvedValue(undefined);
const mockTabsQuery = jest.fn();
const mockTabsCreate = jest.fn();
const mockSetBadgeText = jest.fn();
const mockSetBadgeBackgroundColor = jest.fn();
const mockRuntimeSendMessage = jest.fn().mockResolvedValue(undefined);
const mockGetURL = jest.fn().mockReturnValue('chrome-extension://fake-id/welcome.html');
const mockStorageGet = jest.fn().mockResolvedValue({});
const mockStorageSet = jest.fn().mockResolvedValue(undefined);

// Listener capture arrays — we'll grab the registered handlers from these
const onMessageListeners: Function[] = [];
const onInstalledListeners: Function[] = [];
const storageChangedListeners: Function[] = [];
const tabsRemovedListeners: Function[] = [];

const chromeMock: any = {
  runtime: {
    onMessage: {
      addListener: jest.fn((fn: Function) => { onMessageListeners.push(fn); }),
    },
    onInstalled: {
      addListener: jest.fn((fn: Function) => { onInstalledListeners.push(fn); }),
    },
    sendMessage: mockRuntimeSendMessage,
    getURL: mockGetURL,
    getContexts: jest.fn().mockResolvedValue([]),
  },
  tabs: {
    sendMessage: mockTabsSendMessage,
    query: mockTabsQuery,
    create: mockTabsCreate,
    onRemoved: {
      addListener: jest.fn((fn: Function) => { tabsRemovedListeners.push(fn); }),
    },
  },
  action: {
    setBadgeText: mockSetBadgeText,
    setBadgeBackgroundColor: mockSetBadgeBackgroundColor,
  },
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
    onChanged: {
      addListener: jest.fn((fn: Function) => { storageChangedListeners.push(fn); }),
    },
  },
  offscreen: {
    createDocument: jest.fn().mockResolvedValue(undefined),
  },
};

// Set chrome globally BEFORE any module imports
(global as any).chrome = chromeMock;

// Mock EventSource for SSE
class MockEventSource {
  url: string;
  onerror: ((ev: any) => void) | null = null;
  constructor(url: string) { this.url = url; }
  addEventListener() {}
  close() {}
}
(global as any).EventSource = MockEventSource;

// ─── Module mocks (must be before import) ─────────────────────────────────────

jest.mock('../shared/storage', () => ({
  isMicPermissionGranted: jest.fn().mockResolvedValue(true),
}));

jest.mock('../shared/constants', () => ({
  MAX_CONVERSATION_TURNS: 20,
}));

jest.mock('../background/screenshot', () => ({
  captureScreenshot: jest.fn().mockResolvedValue('data:image/png;base64,SCREENSHOT_DATA'),
}));

jest.mock('../background/api/backend-client', () => ({
  transcribeAudio: jest.fn().mockResolvedValue('hello world'),
  transcribeAudioStreaming: jest.fn().mockResolvedValue('hello world'),
  connectSSE: jest.fn().mockReturnValue(new MockEventSource('http://localhost:8000/events')),
  checkBackendHealth: jest.fn().mockResolvedValue(false), // backend not reachable by default
  sendTask: jest.fn().mockResolvedValue({ type: 'answer', text: 'Test answer' }),
  sendTaskContinue: jest.fn().mockResolvedValue({ type: 'done' }),
}));

jest.mock('../background/api/groq-vision', () => ({
  streamGeminiResponse: jest.fn(),
  generateTtsSummary: jest.fn(),
}));

// ─── Import the module (triggers side effects) ──────────────────────────────

import { captureScreenshot } from '../background/screenshot';
import { sendTask, sendTaskContinue, checkBackendHealth } from '../background/api/backend-client';

// Require the service worker module to trigger side-effect registrations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../background/service-worker');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMessageHandler(): Function {
  expect(onMessageListeners.length).toBeGreaterThan(0);
  return onMessageListeners[0];
}

/**
 * Simulate sending a message to the service worker's onMessage handler.
 */
function sendMessageToSW(
  message: any,
  sender: Partial<chrome.runtime.MessageSender> = {}
): Promise<any> {
  const handler = getMessageHandler();
  return new Promise((resolve) => {
    const sendResponse = (response?: any) => resolve(response);
    handler(message, sender, sendResponse);
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Service Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set common mock return values (clearAllMocks resets them)
    mockTabsSendMessage.mockResolvedValue(undefined);
    (sendTask as jest.Mock).mockResolvedValue({ type: 'answer', text: 'Test answer' });
    (sendTaskContinue as jest.Mock).mockResolvedValue({ type: 'done' });
    (captureScreenshot as jest.Mock).mockResolvedValue('data:image/png;base64,SCREENSHOT');
    (checkBackendHealth as jest.Mock).mockResolvedValue(false);
    mockRuntimeSendMessage.mockResolvedValue(undefined);

    // Suppress console output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Listener registration ──────────────────────────────────────────────

  describe('listener registration', () => {
    it('registers an onMessage listener', () => {
      expect(onMessageListeners.length).toBeGreaterThan(0);
      expect(typeof onMessageListeners[0]).toBe('function');
    });

    it('registers an onInstalled listener', () => {
      expect(onInstalledListeners.length).toBeGreaterThan(0);
    });

    it('registers a storage.onChanged listener', () => {
      expect(storageChangedListeners.length).toBeGreaterThan(0);
    });

    it('registers a tabs.onRemoved listener', () => {
      expect(tabsRemovedListeners.length).toBeGreaterThan(0);
    });
  });

  // ── get-state ──────────────────────────────────────────────────────────

  describe('get-state', () => {
    it('returns current state as idle by default', async () => {
      const response = await sendMessageToSW({ action: 'get-state' });
      expect(response.ok).toBe(true);
      expect(response.state).toBe('idle');
    });
  });

  // ── cancel-agent-loop ──────────────────────────────────────────────────

  describe('cancel-agent-loop', () => {
    it('acknowledges cancellation', async () => {
      const response = await sendMessageToSW({ action: 'cancel-agent-loop' });
      expect(response.ok).toBe(true);
    });
  });

  // ── clear-conversation ─────────────────────────────────────────────────

  describe('clear-conversation', () => {
    it('clears conversation and sends info back to tab', async () => {
      const tabId = 42;
      const response = await sendMessageToSW(
        { action: 'clear-conversation' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      expect(response.ok).toBe(true);
      // Should send conversation-info back to the tab
      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        tabId,
        expect.objectContaining({
          action: 'conversation-info',
          info: expect.objectContaining({
            turns: 0,
            maxTurns: 20,
          }),
        })
      );
    });
  });

  // ── get-conversation-info ──────────────────────────────────────────────

  describe('get-conversation-info', () => {
    it('returns conversation info for a tab', async () => {
      const response = await sendMessageToSW(
        { action: 'get-conversation-info' },
        { tab: { id: 99 } as chrome.tabs.Tab }
      );

      expect(response.ok).toBe(true);
      expect(response.info).toBeDefined();
      expect(response.info.turns).toBe(0);
      expect(response.info.maxTurns).toBe(20);
    });

    it('returns default info when no tab id', async () => {
      const response = await sendMessageToSW(
        { action: 'get-conversation-info' },
        {} // no tab
      );

      expect(response.ok).toBe(true);
      expect(response.info.turns).toBe(0);
    });
  });

  // ── open-welcome ───────────────────────────────────────────────────────

  describe('open-welcome', () => {
    it('opens welcome tab', async () => {
      const response = await sendMessageToSW({ action: 'open-welcome' });
      expect(response.ok).toBe(true);
      expect(mockTabsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('welcome.html') })
      );
    });
  });

  // ── check-mic-permission ───────────────────────────────────────────────

  describe('check-mic-permission', () => {
    it('responds with ok', async () => {
      const response = await sendMessageToSW({ action: 'check-mic-permission' });
      expect(response.ok).toBe(true);
    });
  });

  // ── unknown action ─────────────────────────────────────────────────────

  describe('unknown action', () => {
    it('returns error for unknown actions', async () => {
      const response = await sendMessageToSW({ action: 'some-unknown-action' });
      expect(response.ok).toBe(false);
      expect(response.error).toContain('Unknown action');
    });
  });

  // ── offscreen messages are ignored ─────────────────────────────────────

  describe('offscreen messages', () => {
    it('ignores messages with target=offscreen', () => {
      const handler = getMessageHandler();
      const sendResponse = jest.fn();

      const result = handler(
        { action: 'start-recording', target: 'offscreen' },
        {},
        sendResponse
      );

      // Should return false (not handled)
      expect(result).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });

  // ── shortcut-hold ──────────────────────────────────────────────────────

  describe('shortcut-hold', () => {
    it('starts recording and returns listening state', async () => {
      const response = await sendMessageToSW(
        { action: 'shortcut-hold', cursorX: 100, cursorY: 200 },
        { tab: { id: 10 } as chrome.tabs.Tab }
      );

      expect(response.ok).toBe(true);
      expect(response.state).toBe('listening');
    });

    it('sends start-listening to the recording tab', async () => {
      await sendMessageToSW(
        { action: 'shortcut-hold', cursorX: 50, cursorY: 50 },
        { tab: { id: 15 } as chrome.tabs.Tab }
      );

      // Should send start-listening to the tab
      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        15,
        expect.objectContaining({ action: 'start-listening' })
      );
    });

    it('updates toolbar icon to recording', async () => {
      await sendMessageToSW(
        { action: 'shortcut-hold', cursorX: 0, cursorY: 0 },
        { tab: { id: 10 } as chrome.tabs.Tab }
      );

      expect(mockSetBadgeText).toHaveBeenCalledWith({ text: 'REC' });
      expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#F44336' });
    });
  });

  // ── shortcut-release ───────────────────────────────────────────────────

  describe('shortcut-release', () => {
    it('transitions to processing state', async () => {
      const response = await sendMessageToSW(
        { action: 'shortcut-release', cursorX: 100, cursorY: 200 },
        { tab: { id: 10 } as chrome.tabs.Tab }
      );

      expect(response.ok).toBe(true);
      expect(response.state).toBe('processing');
    });

    it('sends bubble-state transcribing to the tab', async () => {
      await sendMessageToSW(
        { action: 'shortcut-release', cursorX: 0, cursorY: 0 },
        { tab: { id: 12 } as chrome.tabs.Tab }
      );

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        12,
        expect.objectContaining({ action: 'bubble-state', state: 'transcribing' })
      );
    });
  });

  // ── follow-up ──────────────────────────────────────────────────────────

  describe('follow-up', () => {
    it('acknowledges follow-up message', async () => {
      const response = await sendMessageToSW(
        { action: 'follow-up', text: 'tell me more' },
        { tab: { id: 20 } as chrome.tabs.Tab }
      );

      expect(response.ok).toBe(true);
    });

    it('calls sendTask for answer-type follow-up', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'answer',
        text: 'The price is $29.99',
        reasoning: 'Found price element',
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'what is the price?' },
        { tab: { id: 31 } as chrome.tabs.Tab }
      );

      // Wait for async pipeline to run
      await new Promise(r => setTimeout(r, 200));

      expect(sendTask).toHaveBeenCalled();
      // Should send bubble-answer-chunk to the tab
      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        31,
        expect.objectContaining({ action: 'bubble-answer-chunk' })
      );
    });

    it('sends reasoning to bubble when present in response', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'answer',
        text: 'answer text',
        reasoning: 'This is the reasoning',
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'question' },
        { tab: { id: 33 } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 200));

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        33,
        expect.objectContaining({
          action: 'bubble-reasoning',
          text: 'This is the reasoning',
        })
      );
    });

    it('sends TTS summary from first sentence of answer', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'answer',
        text: 'The price is $29.99. It was recently reduced from $39.99.',
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'price?' },
        { tab: { id: 34 } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 200));

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        34,
        expect.objectContaining({
          action: 'tts-summary',
          summary: 'The price is $29.99.',
        })
      );
    });
  });

  // ── Agent loop via follow-up triggering steps ──────────────────────────

  describe('agent loop behavior', () => {
    it('executes steps when sendTask returns steps response', async () => {
      const stepsResponse = {
        type: 'steps',
        actions: [
          { action: 'click', selector: '#add-to-cart', description: 'Click add to cart' },
        ],
      };
      (sendTask as jest.Mock).mockResolvedValue(stepsResponse);
      (sendTaskContinue as jest.Mock).mockResolvedValue({ type: 'done' });

      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          return Promise.resolve({ ok: true, summary: "Clicked 'Add to Cart'" });
        }
        if (msg.action === 'scrape-dom') {
          return Promise.resolve({ ok: true, snapshot: { url: 'https://example.com' } });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        return Promise.resolve(undefined);
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'add item to cart' },
        { tab: { id: 30 } as chrome.tabs.Tab }
      );

      // Wait for async pipeline to complete
      await new Promise(r => setTimeout(r, 500));

      // sendTask should have been called
      expect(sendTask).toHaveBeenCalled();
      // sendTaskContinue should have been called (re-observation)
      expect(sendTaskContinue).toHaveBeenCalled();
    });

    it('stops on action failure', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [
          { action: 'click', selector: '#nonexistent', description: 'Click missing element' },
        ],
      });

      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          return Promise.resolve({ ok: false, summary: '', error: 'Element not found' });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        return Promise.resolve(undefined);
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'click something' },
        { tab: { id: 35 } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 300));

      // Should send pipeline-error
      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        35,
        expect.objectContaining({
          action: 'pipeline-error',
          error: expect.stringContaining('Element not found'),
        })
      );
    });

    it('sends bubble-state executing when starting steps', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [
          { action: 'click', selector: '#btn', description: 'Click it' },
        ],
      });
      (sendTaskContinue as jest.Mock).mockResolvedValue({ type: 'done' });

      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          return Promise.resolve({ ok: true, summary: "Clicked" });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        if (msg.action === 'scrape-dom') {
          return Promise.resolve({ ok: true, snapshot: {} });
        }
        return Promise.resolve(undefined);
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'click' },
        { tab: { id: 36 } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 300));

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        36,
        expect.objectContaining({
          action: 'bubble-state',
          state: 'executing',
        })
      );
    });

    it('sends bubble-step with action description', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [
          { action: 'click', selector: '#btn', description: 'Click the button' },
        ],
      });
      (sendTaskContinue as jest.Mock).mockResolvedValue({ type: 'done' });

      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          return Promise.resolve({ ok: true, summary: "Clicked 'Button'" });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        if (msg.action === 'scrape-dom') {
          return Promise.resolve({ ok: true, snapshot: {} });
        }
        return Promise.resolve(undefined);
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'click' },
        { tab: { id: 37 } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 300));

      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        37,
        expect.objectContaining({
          action: 'bubble-step',
          stepName: 'Click the button',
        })
      );
    });
  });

  // ── waitForDomStable ───────────────────────────────────────────────────

  describe('waitForDomStable', () => {
    it('sends wait-for-dom-stable message during agent loop', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [{ action: 'click', selector: '#btn', description: 'Click' }],
      });
      (sendTaskContinue as jest.Mock).mockResolvedValue({ type: 'done' });

      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          return Promise.resolve({ ok: true, summary: "Clicked" });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        if (msg.action === 'scrape-dom') {
          return Promise.resolve({ ok: true, snapshot: {} });
        }
        return Promise.resolve(undefined);
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'click it' },
        { tab: { id: 40 } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 500));

      const waitCalls = mockTabsSendMessage.mock.calls.filter(
        (call: any[]) => call[1]?.action === 'wait-for-dom-stable'
      );
      expect(waitCalls.length).toBeGreaterThan(0);
    });
  });

  // ── Navigation handling ────────────────────────────────────────────────

  describe('navigation handling', () => {
    it('handles content script disconnect during navigation', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [
          { action: 'navigate', url: 'https://example.com/page2', description: 'Go to page 2' },
        ],
      });
      (sendTaskContinue as jest.Mock).mockResolvedValue({ type: 'done' });

      let executeCallCount = 0;
      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          executeCallCount++;
          // Simulate content script disconnect on navigation
          return Promise.reject(new Error('Could not establish connection'));
        }
        if (msg.action === 'scrape-dom') {
          // Content script has reconnected
          return Promise.resolve({ ok: true, snapshot: { url: 'https://example.com/page2' } });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        return Promise.resolve(undefined);
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'go to page 2' },
        { tab: { id: 50 } as chrome.tabs.Tab }
      );

      // Navigation reconnection takes ~2s + processing
      await new Promise(r => setTimeout(r, 3500));

      // Should have attempted scrape-dom after navigation
      const scrapeCalls = mockTabsSendMessage.mock.calls.filter(
        (call: any[]) => call[1]?.action === 'scrape-dom'
      );
      expect(scrapeCalls.length).toBeGreaterThan(0);
    }, 10000);
  });

  // ── Conversation history ───────────────────────────────────────────────

  describe('conversation history', () => {
    it('tracks conversation across follow-ups', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'answer',
        text: 'First answer',
      });

      const tabId = 60;

      await sendMessageToSW(
        { action: 'follow-up', text: 'first question' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 300));

      // Check conversation info
      const infoResponse = await sendMessageToSW(
        { action: 'get-conversation-info' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      expect(infoResponse.ok).toBe(true);
      expect(infoResponse.info.turns).toBe(1);
    });

    it('clears conversation on clear-conversation message', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'answer',
        text: 'An answer',
      });

      const tabId = 61;

      // Add a conversation turn
      await sendMessageToSW(
        { action: 'follow-up', text: 'question' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 300));

      // Clear it
      await sendMessageToSW(
        { action: 'clear-conversation' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      // Verify cleared
      const infoResponse = await sendMessageToSW(
        { action: 'get-conversation-info' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      expect(infoResponse.info.turns).toBe(0);
    });

    it('stores step plans in conversation history', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [
          { action: 'click', selector: '#btn', description: 'Click button' },
        ],
      });
      (sendTaskContinue as jest.Mock).mockResolvedValue({ type: 'done' });

      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          return Promise.resolve({ ok: true, summary: "Clicked" });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        if (msg.action === 'scrape-dom') {
          return Promise.resolve({ ok: true, snapshot: {} });
        }
        return Promise.resolve(undefined);
      });

      const tabId = 62;

      await sendMessageToSW(
        { action: 'follow-up', text: 'click the button' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 500));

      const infoResponse = await sendMessageToSW(
        { action: 'get-conversation-info' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      // Steps also count as a conversation turn
      expect(infoResponse.info.turns).toBe(1);
    });
  });

  // ── Lifecycle: onInstalled ─────────────────────────────────────────────

  describe('onInstalled', () => {
    it('opens welcome tab on fresh install', () => {
      expect(onInstalledListeners.length).toBeGreaterThan(0);
      const handler = onInstalledListeners[0];
      handler({ reason: 'install' });
      expect(mockTabsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('welcome.html') })
      );
    });

    it('does not open welcome tab on update', () => {
      mockTabsCreate.mockClear();
      const handler = onInstalledListeners[0];
      handler({ reason: 'update' });
      // Should not create welcome tab on update (just resolveIconState)
      expect(mockTabsCreate).not.toHaveBeenCalled();
    });
  });

  // ── Tabs onRemoved cleans up conversations ─────────────────────────────

  describe('tabs.onRemoved', () => {
    it('cleans up conversation when tab is removed', async () => {
      const tabId = 70;
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'answer',
        text: 'answer',
      });

      // Add conversation
      await sendMessageToSW(
        { action: 'follow-up', text: 'q' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );

      await new Promise(r => setTimeout(r, 300));

      // Verify conversation exists
      let info = await sendMessageToSW(
        { action: 'get-conversation-info' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );
      expect(info.info.turns).toBe(1);

      // Simulate tab removal
      expect(tabsRemovedListeners.length).toBeGreaterThan(0);
      tabsRemovedListeners[0](tabId);

      // Verify conversation is cleaned up
      info = await sendMessageToSW(
        { action: 'get-conversation-info' },
        { tab: { id: tabId } as chrome.tabs.Tab }
      );
      expect(info.info.turns).toBe(0);
    });
  });

  // ── MAX_AGENT_ITERATIONS ───────────────────────────────────────────────

  describe('MAX_AGENT_ITERATIONS limit', () => {
    it('stops after 10 iterations when Nova keeps returning steps', async () => {
      (sendTask as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [{ action: 'click', selector: '#btn', description: 'Click' }],
      });
      // sendTaskContinue always returns more steps (never done)
      (sendTaskContinue as jest.Mock).mockResolvedValue({
        type: 'steps',
        actions: [{ action: 'click', selector: '#btn2', description: 'Click again' }],
      });

      mockTabsSendMessage.mockImplementation((_tabId: number, msg: any) => {
        if (msg.action === 'execute-action') {
          return Promise.resolve({ ok: true, summary: "Clicked" });
        }
        if (msg.action === 'wait-for-dom-stable') {
          return Promise.resolve({ stable: true });
        }
        if (msg.action === 'scrape-dom') {
          return Promise.resolve({ ok: true, snapshot: {} });
        }
        return Promise.resolve(undefined);
      });

      await sendMessageToSW(
        { action: 'follow-up', text: 'keep clicking' },
        { tab: { id: 80 } as chrome.tabs.Tab }
      );

      // Wait long enough for all iterations (each has delays)
      await new Promise(r => setTimeout(r, 5000));

      // Should eventually reach max iterations and send done
      expect(mockTabsSendMessage).toHaveBeenCalledWith(
        80,
        expect.objectContaining({
          action: 'bubble-state',
          state: 'done',
        })
      );

      // sendTaskContinue should have been called up to 10 times
      const continueCallCount = (sendTaskContinue as jest.Mock).mock.calls.length;
      expect(continueCallCount).toBeLessThanOrEqual(10);
    }, 15000);
  });
});
