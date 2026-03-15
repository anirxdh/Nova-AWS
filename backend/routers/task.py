import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services.event_bus import event_bus
from backend.services.nova_reasoning import reason_about_page


class TaskRequest(BaseModel):
    command: str       # User's voice command text
    screenshot: str    # Base64-encoded PNG screenshot
    dom_snapshot: dict  # Structured DOM data (buttons, links, inputs, etc.)


router = APIRouter()


@router.post("/task")
async def process_task(request: TaskRequest):
    """Receive a voice command, screenshot, and DOM snapshot; return answer or action steps."""
    await event_bus.emit("status", {"stage": "understanding"})

    try:
        # boto3 is synchronous — run it in a thread pool to avoid blocking the event loop
        result = await asyncio.to_thread(
            reason_about_page,
            request.command,
            request.screenshot,
            request.dom_snapshot,
        )
        await event_bus.emit(
            "status",
            {"stage": "task_complete", "type": result["type"]},
        )
        return result
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
        raise HTTPException(status_code=500, detail=f"Task processing failed: {error_msg}")
