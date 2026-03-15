import asyncio

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.services.event_bus import event_bus
from backend.services.nova_sonic import transcribe_audio

router = APIRouter()


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    mime_type: str = Form(default="audio/webm"),
):
    """Receive audio file, transcribe via Nova Sonic, return transcript."""
    audio_bytes = await audio.read()

    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    if len(audio_bytes) > 25 * 1024 * 1024:  # 25 MB limit
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

    await event_bus.emit("status", {"stage": "transcribing"})

    try:
        # boto3 is synchronous — run it in a thread pool to avoid blocking the event loop
        transcript = await asyncio.to_thread(transcribe_audio, audio_bytes, mime_type)
        await event_bus.emit("status", {"stage": "done", "transcript": transcript})
        return {"transcript": transcript}
    except ValueError as e:
        error_msg = str(e)
        await event_bus.emit("status", {"stage": "error", "detail": error_msg})
        if "credentials" in error_msg.lower() or "aws" in error_msg.lower():
            raise HTTPException(
                status_code=500,
                detail=f"AWS credentials not configured — check backend .env file: {error_msg}",
            )
        raise HTTPException(status_code=422, detail=error_msg)
    except Exception as e:
        error_msg = str(e)
        await event_bus.emit("status", {"stage": "error", "detail": error_msg})
        if "credentials" in error_msg.lower() or "NoCredentials" in error_msg:
            raise HTTPException(
                status_code=500,
                detail="AWS credentials not configured — check backend .env file",
            )
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error_msg}")
