const GEMINI_STREAM_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';

const SYSTEM_PROMPT =
  'You are ScreenSense, a helpful AI assistant. The user is looking at their screen and asking a question about what they see. Analyze the screenshot and answer their question concisely in 2-4 sentences or short bullet points. Be direct, specific, and helpful -- like a knowledgeable friend explaining something quickly. Do not add preamble like "Based on the screenshot" or "I can see that".';

/**
 * Stream a multimodal response from Gemini given a screenshot and text query.
 * Calls onChunk for each text delta received from the SSE stream.
 * Returns the full accumulated text when the stream completes.
 */
export async function streamGeminiResponse(
  screenshotDataUrl: string,
  query: string,
  apiKey: string,
  onChunk: (text: string) => void
): Promise<string> {
  // Extract base64 data from data URL (strip "data:image/png;base64," prefix)
  const base64Match = screenshotDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error('Invalid screenshot data URL format');
  }
  const imageMimeType = base64Match[1];
  const screenshotBase64 = base64Match[2];

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: imageMimeType,
              data: screenshotBase64,
            },
          },
          {
            text: `${SYSTEM_PROMPT}\n\n${query}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const url = `${GEMINI_STREAM_URL}?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new Error('Gemini API key missing or invalid');
    }
    throw new Error(`AI response failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body from Gemini');
  }

  let fullText = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE lines
    const lines = buffer.split('\n');
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith(':')) {
        // Empty line or SSE comment, skip
        continue;
      }

      if (trimmed === 'data: [DONE]') {
        // Stream complete
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const text =
            parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
            onChunk(text);
          }
        } catch {
          // Skip malformed JSON chunks
          console.warn('[ScreenSense] Failed to parse Gemini SSE chunk:', jsonStr);
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
    const jsonStr = buffer.trim().slice(6);
    try {
      const parsed = JSON.parse(jsonStr);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        fullText += text;
        onChunk(text);
      }
    } catch {
      // Skip malformed final chunk
    }
  }

  return fullText;
}
