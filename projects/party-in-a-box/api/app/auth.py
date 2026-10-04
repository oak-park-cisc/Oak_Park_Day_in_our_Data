"""Dev-only bearer auth. Not for production."""
from __future__ import annotations

from fastapi import Depends, Header

from .config import settings
from .db import User, get_db
from .errors import ApiError


def get_current_user(authorization: str | None = Header(default=None), db=Depends(get_db)) -> User:
    if settings.AUTH_MODE != "dev":
        raise ApiError(501, "auth_not_configured", "Only dev auth is available.")
    token = None
    if authorization:
        parts = authorization.split(None, 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()
    user = db.query(User).filter(User.dev_token == token).first() if token else None
    if user is None:
        raise ApiError(401, "unauthorized", "Sign in first.")
    return user


def require_role(*roles: str):
    allowed = set(roles)
    if "reviewer" in allowed:
        allowed.add("admin")

    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise ApiError(403, "forbidden", "You can't do that.")
        return user
    return dep
