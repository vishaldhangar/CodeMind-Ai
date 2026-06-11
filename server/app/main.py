from fastapi import FastAPI

from app.api.repository import router as repo_router
from app.api.scanner import router as scanner_router
from app.api.ast import router as ast_router
from app.api.dependency import router as dependency_router
from app.api.dependency_analytics import router as dependency_analytics_router
from app.api.architecture import router as architecture_router
from app.api.call_graph import router as call_graph_router
from app.api.routes import router as routes_router
from app.api.database import router as database_router
from app.api.workflow import router as workflow_router
from app.api.impact import router as impact_router
from app.api.knowledge_graph import router as knowledge_graph_router



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


app.include_router(
    ast_router,
    prefix="/ast",
    tags=["AST"]
)

app.include_router(
    dependency_router,
    prefix="/dependencies",
    tags=["Dependencies"]
)

app.include_router(
    dependency_analytics_router,
    prefix="/dependencies",
    tags=["Dependency Analytics"]
)

app.include_router(
    architecture_router,
    prefix="/architecture",
    tags=["Architecture"]
)

app.include_router(
    call_graph_router,
    prefix="/callgraph",
    tags=["Call Graph"]
)

app.include_router(
    routes_router,
    prefix="/routes",
    tags=["Routes"]
)

app.include_router(
    database_router,
    prefix="/database",
    tags=["Database"]
)

app.include_router(
    workflow_router,
    prefix="/workflow",
    tags=["Workflow"]
)

app.include_router(
    impact_router,
    prefix="/impact",
    tags=["Impact Analysis"]
)

app.include_router(
    knowledge_graph_router,
    prefix="/knowledge",
    tags=["Knowledge Graph"]
)


@app.get("/") 
def root():
    return {
        "message": "CodeMind AI Backend Running"
    }