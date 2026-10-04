"""/threads/{threadId}/messages for all roles (docs/api/resident.openapi.yaml, Messages tag)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import Match, Message, Request, Thread, User, get_db, new_id, notify
from ..errors import ApiError
from ..schemas_resident import MessageIn

router = APIRouter()

STAFF = ("reviewer", "admin")


def _thread_for(db: Session, thread_id: str, user: User) -> tuple[Thread, Request]:
    thread = db.get(Thread, thread_id)
    if thread is None:
        raise ApiError(404, "not_found", "Thread not found.")
    req = db.get(Request, thread.request_id)
    allowed = user.role in STAFF or (req is not None and req.organizer_id == user.id)
    if not allowed and thread.kind == "job" and thread.match_id and user.vendor_account_id:
        match = db.get(Match, thread.match_id)
        allowed = match is not None and match.vendor_account_id == user.vendor_account_id
    if not allowed:
        raise ApiError(403, "forbidden", "You can't do that.")
    return thread, req


def _message_out(db: Session, m: Message) -> dict:
    author = db.get(User, m.author_id)
    return {"id": m.id, "thread_id": m.thread_id, "author_role": m.author_role,
            "author_display_name": author.display_name if author else "",
            "body": m.body, "created_at": m.created_at.isoformat() if m.created_at else None}


@router.get("/threads/{thread_id}/messages")
def list_messages(thread_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    thread, _ = _thread_for(db, thread_id, user)
    msgs = (db.query(Message).filter(Message.thread_id == thread.id)
            .order_by(Message.created_at, Message.id).all())
    return {"thread": {"id": thread.id, "kind": thread.kind, "request_id": thread.request_id,
                       "match_id": thread.match_id},
            "messages": [_message_out(db, m) for m in msgs]}


@router.post("/threads/{thread_id}/messages", status_code=201)
def post_message(thread_id: str, body: MessageIn, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    thread, req = _thread_for(db, thread_id, user)
    role = "village" if user.role in STAFF else "vendor" if user.role == "vendor" else "resident"
    msg = Message(id=new_id("msg"), thread_id=thread.id, author_id=user.id, author_role=role, body=body.body)
    db.add(msg)
    db.flush()
    payload = {"thread_id": thread.id, "request_id": thread.request_id}
    if role == "resident":
        if thread.kind == "job" and thread.match_id:
            match = db.get(Match, thread.match_id)
            targets = db.query(User).filter(User.vendor_account_id == match.vendor_account_id).all()
        else:
            targets = db.query(User).filter(User.role.in_(STAFF)).all()
    else:
        targets = [db.get(User, req.organizer_id)] if req else []
    for t in targets:
        if t is not None and t.id != user.id:
            notify(db, t.id, "new_message", payload)
    db.commit()
    return _message_out(db, msg)
