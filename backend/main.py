"""
Morning Blotter API — serves trade data from SQLite and AI (Vanna) endpoints.
Run: uvicorn backend.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import fetch_all_trades
from backend.ai_routes import router as ai_router

app = FastAPI(title="Morning Blotter API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "source": "sqlite"}


@app.get("/api/trades")
def get_trades():
    """Return all trades from SQLite (joined, camelCase). Used by frontend and compatible with Trade type."""
    trades = fetch_all_trades()
    return trades
