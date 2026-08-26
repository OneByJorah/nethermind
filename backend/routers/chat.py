"""Nethermind AI Chat endpoints.

Streaming chat with tool calling via SSE (Server-Sent Events).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import ChatMessage
from schemas import ChatRequest, ChatMessageOut
from services.nethermind_agent import ask

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """Send a message to Nethermind AI and stream the response."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    return await ask(req.session_id, req.message)


@router.get("/history/{session_id}", response_model=list[ChatMessageOut])
def get_chat_history(session_id: str, limit: int = 100, db: Session = Depends(get_db)):
    """Get chat history for a session."""
    return db.query(ChatMessage).filter_by(session_id=session_id)\
        .order_by(ChatMessage.created_at).limit(limit).all()


@router.delete("/history/{session_id}")
def clear_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Clear chat history for a session."""
    db.query(ChatMessage).filter_by(session_id=session_id).delete()
    db.commit()
    return {"message": "History cleared"}
