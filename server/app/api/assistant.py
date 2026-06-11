from fastapi import APIRouter, Query, Body
from fastapi.responses import StreamingResponse
from typing import Optional
from pydantic import BaseModel

from app.services.ai_assistant_service import (
    AIAssistantService
)

router  = APIRouter()
service = AIAssistantService()


# ── Request models ────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    show_thinking: bool = False


# ── Endpoints ─────────────────────────────────────────

@router.get("/health")
def health_check():
    """
    Check if Ollama is running and qwen3.1:14b is loaded.
    """
    return service.health_check()


@router.post("/{repo_name}/chat")
def chat(
    repo_name: str,
    body: ChatRequest
):
    """
    Ask any natural language question about a repository.

    The assistant automatically:
      1. Detects question intent
         (architecture / workflow / database / routes / impact)
      2. Pulls targeted intelligence from relevant layers
      3. Builds a rich system prompt with codebase context
      4. Queries Qwen3.1:14b via Ollama
      5. Returns a structured, markdown-formatted answer

    Set show_thinking=true to also receive Qwen3's
    internal reasoning process.
    """
    return service.chat(
        repo_name,
        body.question,
        body.show_thinking
    )


@router.get("/{repo_name}/explain/file")
def explain_file(
    repo_name: str,
    path: str = Query(
        ...,
        description=(
            "File path relative to the repo root. "
            "e.g. app/services/auth_service.py"
        )
    ),
    show_thinking: bool = Query(False)
):
    """
    Get an AI explanation of a specific file.

    Context provided to the model:
      - File source code (first 120 lines)
      - What the file defines (classes, functions)
      - What it imports
      - What imports it
      - Repository architecture summary
    """
    return service.explain_file(
        repo_name, path, show_thinking
    )


@router.get("/{repo_name}/explain/function/{function_name}")
def explain_function(
    repo_name: str,
    function_name: str,
    show_thinking: bool = Query(False)
):
    """
    Get an AI explanation of a specific function.

    Context provided to the model:
      - All outgoing calls (what this function calls)
      - All callers (who calls this function)
      - Which HTTP workflows this function participates in
      - Repository architecture summary
    """
    return service.explain_function(
        repo_name, function_name, show_thinking
    )


@router.post("/{repo_name}/chat/stream")
async def chat_stream(
    repo_name: str,
    body: ChatRequest
):
    """
    Streaming version of chat using Server-Sent Events.

    The frontend should consume this as an EventSource
    or fetch with ReadableStream.

    Event format:
      data: {"token": "Hello"}
      data: {"token": " world"}
      ...
      data: {"done": true, "model": "qwen2.5:14b", ...}

    Tokens appear in real-time as Qwen generates them.
    Qwen3 <think> reasoning blocks are filtered out
    automatically.
    """

    return StreamingResponse(
        service.stream_chat(repo_name, body.question),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":       "keep-alive"
        }
    )
