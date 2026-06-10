import logging
from typing import Annotated, List, NoReturn

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from .config import settings
from .schema import AnalysisResponse
from .service import analyze_images

router = APIRouter()
logger = logging.getLogger(__name__)

_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
# computed once at startup, not per-request
_MAX_BYTES = settings.max_image_size_mb * 1024 * 1024


# NoReturn here so the type-checker knows `result` is always bound after the try/except block
def _error(status: int, error: str, detail: str) -> NoReturn:
    raise HTTPException(
        status_code=status,
        detail={"error": error, "detail": detail},
    )


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    responses={
        413: {"description": "File too large"},
        422: {"description": "Validation error or malformed model response"},
        503: {"description": "AI provider unavailable"},
    },
)
async def analyze(
    request: Request,
    images: Annotated[List[UploadFile], File(description="1 to 3 images (jpeg, png, webp)")],
):
    request_id: str = request.state.request_id

    if not images:
        _error(422, "No images provided", "At least one image is required.")
    if len(images) > 3:
        _error(422, "Too many images", "A maximum of 3 images may be submitted per request.")

    raw_images: list[bytes] = []
    for upload in images:
        # validate content_type before reading the body — avoids buffering 10 MB of a video just to reject it
        if upload.content_type not in _ALLOWED_MIME_TYPES:
            _error(
                422,
                "Unsupported file type",
                f"'{upload.filename}' has type '{upload.content_type}'. "
                "Accepted types: image/jpeg, image/png, image/webp, image/heic, image/heif.",
            )

        data = await upload.read()

        if len(data) > _MAX_BYTES:
            _error(
                413,
                "File too large",
                f"'{upload.filename}' is {len(data) // (1024*1024)} MB. "
                f"Maximum allowed is {settings.max_image_size_mb} MB.",
            )

        raw_images.append(data)

    try:
        result = await analyze_images(raw_images)
    except ValueError as exc:
        # ValueError means the model gave us garbage — surface that to the caller
        logger.error("analysis_value_error", extra={"request_id": request_id, "error": str(exc)})
        _error(422, "Analysis failed", str(exc))
    except Exception as exc:
        # anything else is probably the AI provider being down
        logger.error("analysis_unexpected_error", extra={"request_id": request_id, "error": str(exc)})
        _error(
            503,
            "Service unavailable",
            "The AI provider returned an error. Please try again in a moment.",
        )

    return AnalysisResponse(**result.model_dump(), request_id=request_id)
