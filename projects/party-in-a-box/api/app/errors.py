"""Error type and handlers producing the `{code, message, reasons}` shape."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, reasons: list[str] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.reasons = reasons or []


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status,
                            content={"code": exc.code, "message": exc.message, "reasons": exc.reasons})

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        reasons = [f"{'.'.join(str(p) for p in e.get('loc', []))}: {e.get('msg', '')}" for e in exc.errors()]
        return JSONResponse(status_code=422, content={
            "code": "validation_error", "message": "Some fields are invalid.", "reasons": reasons})

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        code = "not_found" if exc.status_code == 404 else f"http_{exc.status_code}"
        return JSONResponse(status_code=exc.status_code,
                            content={"code": code, "message": str(exc.detail), "reasons": []})
