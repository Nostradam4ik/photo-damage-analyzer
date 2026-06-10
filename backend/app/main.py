import logging
import sys
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pythonjsonlogger import jsonlogger

from .config import settings
from .router import router


# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------

def _setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        jsonlogger.JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
    )
    root = logging.getLogger()
    # uvicorn adds its own handlers on reload — clear them first to avoid duplicate lines
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


_setup_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Photo Damage Analyzer",
    version="1.0.0",
    description="Analyse photos for damage and wear using GPT-4o or Claude.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Middleware: attach a request_id to every request
# ---------------------------------------------------------------------------

@app.middleware("http")
async def attach_request_id(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    logger.info(
        "request_started",
        extra={"request_id": request_id, "method": request.method, "path": request.url.path},
    )
    response = await call_next(request)
    # handy for correlating client-side network logs with server-side logs
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_finished",
        extra={"request_id": request_id, "status_code": response.status_code},
    )
    return response


# ---------------------------------------------------------------------------
# Error handlers — normalise all errors to {error, detail}
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # our own errors pack a dict into detail; FastAPI's built-in errors (e.g. 422) use strings
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "Request error", "detail": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # request_id might not be set if the error happened before our middleware ran
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error("unhandled_exception", extra={"request_id": request_id, "error": str(exc)})
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "An unexpected error occurred."},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(router)
