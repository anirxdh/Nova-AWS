/**
 * Offscreen document for audio recording.
 * Runs in the extension's origin so mic permission is granted once and persists
 * across all page navigations.
 */

let mediaRecorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let stopped = false;
let amplitudeInterval: ReturnType<typeof setInterval> | null = null;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function startRecording(): Promise<void> {
  stopped = false;
  chunks = [];

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    chrome.runtime.sendMessage({ action: 'offscreen-error', error: 'Microphone access denied' }).catch(() => {});
    return;
  }

  // Set up AudioContext + AnalyserNode for amplitude data
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  // Choose best MIME type
  let mimeType: string | undefined;
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    mimeType = 'audio/webm;codecs=opus';
  } else if (MediaRecorder.isTypeSupported('audio/webm')) {
    mimeType = 'audio/webm';
  }

  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  mediaRecorder.start(100);

  // Send amplitude data every 50ms
  amplitudeInterval = setInterval(() => {
    if (stopped || !analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    // Send as regular array (Uint8Array doesn't serialize well in chrome messages)
    chrome.runtime.sendMessage({ action: 'offscreen-amplitude', data: Array.from(data) }).catch(() => {});
  }, 50);

  chrome.runtime.sendMessage({ action: 'offscreen-started' }).catch(() => {});
}

async function stopRecording(): Promise<void> {
  stopped = true;

  // Stop amplitude polling
  if (amplitudeInterval !== null) {
    clearInterval(amplitudeInterval);
    amplitudeInterval = null;
  }

  // Stop MediaRecorder and collect audio
  const blob = await new Promise<Blob>((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(new Blob(chunks, { type: 'audio/webm' }));
      return;
    }

    mediaRecorder.onstop = () => {
      const type = mediaRecorder?.mimeType || 'audio/webm';
      resolve(new Blob(chunks, { type }));
    };

    mediaRecorder.stop();
  });

  // Stop stream tracks
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  // Close AudioContext
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
    analyser = null;
  }

  mediaRecorder = null;

  // Convert to base64 and send back
  const audioBase64 = await blobToBase64(blob);
  chrome.runtime.sendMessage({
    action: 'offscreen-recording-complete',
    audioBase64,
    mimeType: blob.type,
  }).catch(() => {});
}

// Listen for commands from service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen') return;

  if (message.action === 'start-recording') {
    startRecording();
  } else if (message.action === 'stop-recording') {
    stopRecording();
  }
});
