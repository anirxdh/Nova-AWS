import os
import requests


def transcribe_audio_streaming(audio_chunks: list, mime_type: str) -> str:
    """Transcribe pre-accumulated audio chunks using Groq Whisper.

    Designed for use with the WebSocket streaming endpoint where audio data
    is accumulated server-side during recording. Eliminates upload latency
    by joining chunks that are already on the server when transcription begins.
    """
    audio_bytes = b"".join(audio_chunks)
    return transcribe_audio(audio_bytes, mime_type)


def transcribe_audio(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe audio using Groq Whisper API."""
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
        if "ValueError" in type(e).__name__:
            raise
        raise ValueError(f"Transcription failed: {e}") from e
