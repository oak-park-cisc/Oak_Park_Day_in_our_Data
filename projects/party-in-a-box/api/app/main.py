"""FastAPI app entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .blocks import get_index
from .config import load_rules, settings, today
from .db import init_db
from .errors import install_handlers
from .routers import public, resident, threads, vendor, village


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    get_index()
    yield


app = FastAPI(title="Party in a Box API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_methods=["*"],
                   allow_headers=["*"], expose_headers=[])
install_handlers(app)

for _mod in (public, resident, vendor, village, threads):
    app.include_router(_mod.router, prefix="/v1")


@app.get("/v1/health")
def health():
    return {"ok": True, "today": today(), "blocks": len(get_index()),
            "rules_year": load_rules()["rules_year"]}
