const BACKEND_URL = 'http://localhost:8000';

/**
 * Transcribe audio by sending it to the FastAPI /transcribe endpoint.
 * Replaces the direct Groq Whisper API call.
 *
 * @param audioBase64 - Base64-encoded audio data from the offscreen recorder
 * @param mimeType - MIME type of the audio (e.g., "audio/webm")
 * @returns The transcript text
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  console.log('[ScreenSense][backend-client] transcribeAudio called — base64 length:', audioBase64.length, 'mimeType:', mimeType);

  // Convert base64 to Blob for multipart upload
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const ext = mimeType.includes('webm') ? 'webm'
    : mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mp4') ? 'mp4'
    : 'webm';
  const audioBlob = new Blob([bytes], { type: mimeType });

  console.log('[ScreenSense][backend-client] Audio blob size:', audioBlob.size, 'bytes, posting to', `${BACKEND_URL}/transcribe`);

  const formData = new FormData();
  formData.append('audio', audioBlob, `recording.${ext}`);
  formData.append('mime_type', mimeType);

  const response = await fetch(`${BACKEND_URL}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  console.log('[ScreenSense][backend-client] /transcribe response status:', response.status);

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.detail || JSON.stringify(errBody);
    } catch {
      detail = `HTTP ${response.status}`;
    }

    console.error('[ScreenSense][backend-client] /transcribe error:', detail);

    if (response.status === 500 && detail.includes('credentials')) {
      throw new Error('Backend AWS credentials not configured — check backend/.env');
    }
    throw new Error(`Transcription failed — ${detail}`);
  }

  const data = await response.json();
  console.log('[ScreenSense][backend-client] Transcript received:', data.transcript);
  return data.transcript;
}

/**
 * Connect to the backend SSE /events endpoint.
 * Returns an EventSource that emits "status" events.
 *
 * Usage:
 *   const es = connectSSE();
 *   es.addEventListener('status', (e) => {
 *     const data = JSON.parse(e.data);
 *     console.log('Stage:', data.stage);
 *   });
 */
export function connectSSE(): EventSource {
  return new EventSource(`${BACKEND_URL}/events`);
}

export interface TaskResponse {
  type: 'answer' | 'steps' | 'done';
  text?: string;
  summary?: string;  // used when type === 'done'
  actions?: Array<{
    action: string;
    selector?: string;
    value?: string;
    url?: string;
    direction?: string;
    description: string;
  }>;
}

export interface ActionHistoryEntry {
  description: string;
  result: string;
}

/**
 * Send a task (command + screenshot + DOM) to the backend for Nova 2 Lite reasoning.
 */
export async function sendTask(
  command: string,
  screenshotDataUrl: string,
  domSnapshot: object
): Promise<TaskResponse> {
  console.log('[ScreenSense][backend-client] sendTask called — command:', command);

  // Strip the data:image/png;base64, prefix to get raw base64
  const base64 = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch(`${BACKEND_URL}/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command,
      screenshot: base64,
      dom_snapshot: domSnapshot,
    }),
  });

  console.log('[ScreenSense][backend-client] /task response status:', response.status);

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.detail || JSON.stringify(errBody);
    } catch {
      detail = `HTTP ${response.status}`;
    }

    console.error('[ScreenSense][backend-client] /task error:', detail);

    if (response.status === 500 && detail.includes('credentials')) {
      throw new Error('Backend AWS credentials not configured — check backend/.env');
    }
    throw new Error(`Task processing failed — ${detail}`);
  }

  const result = await response.json();
  console.log('[ScreenSense][backend-client] Task result type:', result.type);
  return result;
}

/**
 * Continue a multi-step task by sending updated page state + action history to Nova.
 * Called after each action batch during the agent loop.
 */
export async function sendTaskContinue(
  originalCommand: string,
  actionHistory: ActionHistoryEntry[],
  screenshotDataUrl: string,
  domSnapshot: object
): Promise<TaskResponse> {
  console.log('[ScreenSense][backend-client] sendTaskContinue called — command:', originalCommand, 'history length:', actionHistory.length);

  // Strip the data:image/png;base64, prefix to get raw base64
  const base64 = screenshotDataUrl.replace(/^data:image\/\w+;base64,/, '');

  const response = await fetch(`${BACKEND_URL}/task/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      original_command: originalCommand,
      action_history: actionHistory,
      screenshot: base64,
      dom_snapshot: domSnapshot,
    }),
  });

  console.log('[ScreenSense][backend-client] /task/continue response status:', response.status);

  if (!response.ok) {
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.detail || JSON.stringify(errBody);
    } catch {
      detail = `HTTP ${response.status}`;
    }

    console.error('[ScreenSense][backend-client] /task/continue error:', detail);

    if (response.status === 500 && detail.includes('credentials')) {
      throw new Error('Backend AWS credentials not configured — check backend/.env');
    }
    throw new Error(`Continue task failed — ${detail}`);
  }

  const result = await response.json();
  console.log('[ScreenSense][backend-client] Continue result type:', result.type);
  return result;
}

/**
 * Check if the backend is reachable.
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
