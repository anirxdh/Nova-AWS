export type DisplayMode = 'both' | 'audio-only' | 'text-only';

export type ExplanationLevel = 'kid' | 'school' | 'college' | 'phd' | 'executive';

export interface ExtensionSettings {
  shortcutKey: string; // default: '`'
  holdDelayMs: number; // default: 200
  maxRecordingMs: number; // default: 60000
  displayMode: DisplayMode; // default: 'both'
  explanationLevel: ExplanationLevel; // default: 'college'
}

export type ExtensionState = 'idle' | 'listening' | 'processing';

export type IconState = 'inactive' | 'ready' | 'recording';

export interface ShortcutEvent {
  type: 'shortcut-hold' | 'shortcut-release';
  cursorX: number;
  cursorY: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationInfo {
  turns: number;
  maxTurns: number;
}

export type MessageType =
  | { action: 'shortcut-hold'; cursorX: number; cursorY: number }
  | { action: 'shortcut-release'; cursorX: number; cursorY: number }
  | { action: 'capture-screenshot' }
  | { action: 'get-state' }
  | { action: 'state-changed'; state: ExtensionState }
  | { action: 'check-mic-permission' }
  | { action: 'mic-permission-result'; granted: boolean }
  | { action: 'open-welcome' }
  | { action: 'recording-complete'; audioBase64: string; mimeType: string }
  | { action: 'shortcut-release-complete'; screenshotUrl: string }
  | { action: 'pipeline-stage'; stage: 'transcribing' | 'thinking' | 'streaming' | 'complete' | 'error'; transcript?: string }
  | { action: 'stream-chunk'; text: string }
  | { action: 'stream-complete'; fullText: string }
  | { action: 'tts-summary'; summary: string }
  | { action: 'pipeline-error'; error: string }
  | { action: 'follow-up'; text: string }
  | { action: 'clear-conversation' }
  | { action: 'get-conversation-info' }
  | { action: 'conversation-info'; info: ConversationInfo };
