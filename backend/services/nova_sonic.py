"""
Speech-to-text service using Amazon Transcribe Streaming.

Uses AWS-native transcription for reliable audio processing with any length
recording. Falls back to Groq Whisper if Amazon Transcribe is unavailable.
"""

import asyncio
import os
import requests

# Try to import Amazon Transcribe streaming SDK
try:
    from amazon_transcribe.client import TranscribeStreamingClient
    from amazon_transcribe.handlers import TranscriptResultStreamHandler
    from amazon_transcribe.model import TranscriptEvent
    HAS_TRANSCRIBE_SDK = True
except ImportError:
    HAS_TRANSCRIBE_SDK = False


def transcribe_audio_streaming(audio_chunks: list, mime_type: str) -> str:
    """Transcribe pre-accumulated audio chunks.

    Designed for use with the WebSocket streaming endpoint where audio data
    is accumulated server-side during recording.
    """
    audio_bytes = b"".join(audio_chunks)
    return transcribe_audio(audio_bytes, mime_type)


def transcribe_audio(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe audio — tries Amazon Transcribe first, falls back to Groq Whisper."""
    # Try Amazon Transcribe Streaming first (AWS-native)
    if HAS_TRANSCRIBE_SDK:
        try:
            return _transcribe_with_aws(audio_bytes, mime_type)
        except Exception as e:
            print(f"[ScreenSense] Amazon Transcribe failed: {e}, falling back to Groq")

    # Fallback: Groq Whisper
    return _transcribe_with_groq(audio_bytes, mime_type)


def _transcribe_with_aws(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe using Amazon Transcribe Streaming API."""
    aws_region = os.getenv("AWS_REGION", "us-east-1")

    # Determine media encoding from MIME type
    if "ogg" in mime_type or "opus" in mime_type:
        media_encoding = "ogg-opus"
    elif "webm" in mime_type:
        media_encoding = "ogg-opus"  # WebM with Opus codec
    elif "wav" in mime_type:
        media_encoding = "pcm"
    elif "flac" in mime_type:
        media_encoding = "flac"
    else:
        media_encoding = "ogg-opus"

    transcript_parts: list[str] = []

    class Handler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, transcript_event: TranscriptEvent):
            results = transcript_event.transcript.results
            for result in results:
                if not result.is_partial:
                    for alt in result.alternatives:
                        transcript_parts.append(alt.transcript)

    async def _run():
        client = TranscribeStreamingClient(region=aws_region)
        stream = await client.start_stream_transcription(
            language_code="en-US",
            media_sample_rate_hz=48000,
            media_encoding=media_encoding,
        )

        # Send audio in chunks
        CHUNK_SIZE = 16384
        for i in range(0, len(audio_bytes), CHUNK_SIZE):
            chunk = audio_bytes[i:i + CHUNK_SIZE]
            await stream.input_stream.send_audio_event(audio_chunk=chunk)
        await stream.input_stream.end_stream()

        handler = Handler(stream.output_stream)
        await handler.handle_events()

    # Run async transcription in a new event loop (we're called from a sync context via to_thread)
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_run())
    finally:
        loop.close()

    transcript = " ".join(transcript_parts).strip()
    if not transcript:
        raise ValueError("Amazon Transcribe returned empty transcript")
    return transcript


def _transcribe_with_groq(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe audio using Groq Whisper API (fallback)."""
    groq_key = os.getenv("GROQ_API_KEY")

    if not groq_key or groq_key == "your-key-here":
        raise ValueError(
            "Groq API key not configured — set GROQ_API_KEY in backend/.env"
        )

    # Determine file extension from mime type
    if "webm" in mime_type:
        ext = "webm"
    elif "ogg" in mime_type:
        ext = "ogg"
    elif "mp4" in mime_type:
        ext = "mp4"
    elif "wav" in mime_type:
        ext = "wav"
    else:
        ext = "webm"

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {groq_key}"},
            files={"file": (f"recording.{ext}", audio_bytes, mime_type)},
            data={"model": "whisper-large-v3-turbo", "language": "en"},
            timeout=30,
        )

        if response.status_code != 200:
            raise ValueError(
                f"Groq Whisper error (HTTP {response.status_code}): {response.text}"
            )

        result = response.json()
        transcript = result.get("text", "").strip()

        if not transcript:
            raise ValueError(
                "No transcript produced — audio may be too short or unclear"
            )

        return transcript

    except requests.exceptions.Timeout:
        raise ValueError("Transcription timed out — try again")
    except requests.exceptions.ConnectionError:
        raise ValueError("Cannot reach Groq API — check your internet connection")
    except Exception as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Transcription failed: {e}") from e
