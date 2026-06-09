from fastapi import FastAPI

from app.api.repository import router as repo_router
from app.api.scanner import router as scanner_router

app = FastAPI(
    title="CodeMind AI",
    version="1.0.0"
)

app.include_router(
    repo_router,
    prefix="/repo",
    tags=["Repository"]
)

app.include_router(
    scanner_router,
    prefix="/scan",
    tags=["Scanner"]
)

@app.get("/")
def root():
    return {
        "message": "CodeMind AI Backend Running"
    }