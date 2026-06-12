"""
SSE router — Server-Sent Events stream for real-time Enterprise pipeline progress.
In-memory queues keyed by job_id.
"""

import asyncio
import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["sse"])

# In-memory event queues — keyed by job_id
# {job_id: asyncio.Queue}
event_queues: dict[str, asyncio.Queue] = {}


def get_or_create_queue(job_id: str) -> asyncio.Queue:
    if job_id not in event_queues:
        event_queues[job_id] = asyncio.Queue()
    return event_queues[job_id]


async def push_event(job_id: str, payload: dict):
    """Called by agents to push progress events. Import this in every agent."""
    queue = get_or_create_queue(job_id)
    await queue.put(json.dumps(payload))
    logger.debug(f"SSE push: job={job_id} event={payload.get('event')}")


@router.get("/api/stream/{job_id}")
async def stream_job(job_id: str):
    """
    SSE endpoint — frontend subscribes here after upload.
    Sends events until pipeline_complete or pipeline_error is received.
    """
    queue = get_or_create_queue(job_id)

    async def generator():
        # Send initial heartbeat so frontend knows stream is alive
        yield "data: {\"event\": \"stream_connected\"}\n\n"
        try:
            while True:
                event = await asyncio.wait_for(queue.get(), timeout=120)
                yield f"data: {event}\n\n"
                parsed = json.loads(event)
                if parsed.get("event") in ("pipeline_complete", "pipeline_error"):
                    break
        except asyncio.TimeoutError:
            yield "data: {\"event\": \"stream_timeout\"}\n\n"
        finally:
            # Clean up queue
            event_queues.pop(job_id, None)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
