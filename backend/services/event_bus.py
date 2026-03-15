import asyncio
import json
from typing import AsyncGenerator


class EventBus:
    """In-process pub/sub for SSE events. One publisher, multiple subscribers."""

    def __init__(self):
        self._subscribers: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        """Create a new subscriber queue."""
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        """Remove a subscriber queue."""
        self._subscribers = [s for s in self._subscribers if s is not q]

    async def emit(self, event_type: str, data: dict | str = ""):
        """Broadcast an event to all subscribers."""
        payload = {
            "event": event_type,
            "data": data if isinstance(data, str) else json.dumps(data),
        }
        for q in self._subscribers:
            await q.put(payload)


# Singleton instance
event_bus = EventBus()
