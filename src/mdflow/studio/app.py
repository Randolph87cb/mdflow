from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from mdflow.errors import CliUsageError, ValidationError
from mdflow.studio.api.files import router as files_router
from mdflow.studio.api.nodes import router as nodes_router
from mdflow.studio.api.runs import router as runs_router
from mdflow.studio.api.system import router as system_router
from mdflow.studio.api.workflows import router as workflows_router


def create_app(project_root: Path) -> FastAPI:
    app = FastAPI(title="mdflow Workflow Studio")
    app.state.project_root = project_root
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(system_router)
    app.include_router(workflows_router)
    app.include_router(nodes_router)
    app.include_router(runs_router)
    app.include_router(files_router)

    @app.exception_handler(CliUsageError)
    def handle_cli_usage_error(_request, exc: CliUsageError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(ValidationError)
    def handle_validation_error(_request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": exc.messages})

    dist_dir = project_root / "web" / "dist"
    assets_dir = dist_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa_fallback(path: str) -> HTMLResponse:
        index_path = dist_dir / "index.html"
        if index_path.is_file():
            return HTMLResponse(index_path.read_text(encoding="utf-8"))
        return HTMLResponse(
            "<html><body><h1>mdflow Workflow Studio</h1><p>Frontend has not been built yet. Build web/ first.</p></body></html>"
        )

    return app
