from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from voxrox.config import SAMPLE_RATE, get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="VoxRox", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok", "sampleRate": SAMPLE_RATE}

    from voxrox.routers import profiles, vocab

    app.include_router(vocab.router)
    app.include_router(profiles.router)
    app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")
    return app


app = create_app()
