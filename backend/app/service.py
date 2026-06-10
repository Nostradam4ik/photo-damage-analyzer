import base64
import io
import json
import logging
from typing import Any, List

import anthropic
import openai
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from .config import settings
from .schema import AnalysisResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# AI prompt + tool definition
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are an expert damage and wear assessment specialist. "
    "Analyse the provided image(s) and determine whether visible damage or wear is present. "
    "Be factual and base your assessment solely on what is visible. "
    "You MUST call the record_analysis tool with your findings — do not respond in prose."
)

_ANALYSIS_TOOL_SCHEMA = {
    "name": "record_analysis",
    "description": "Record the structured damage/wear analysis result.",
    "input_schema": {
        "type": "object",
        "properties": {
            "subject": {
                "type": "string",
                "description": "What the main object being analysed is",
            },
            "determination": {
                "type": "boolean",
                "description": "True if damage or wear is present, false otherwise",
            },
            "confidence": {
                "type": "number",
                "description": "Confidence in the determination, 0.0 to 1.0",
            },
            "likely_location": {
                "type": "string",
                "description": "Where in the image the damage/wear is located",
            },
            "evidence": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Short observations that support the determination",
            },
            "recommended_action": {
                "type": "string",
                "description": "Recommended next step based on the assessment",
            },
            "needs_more_photos": {
                "type": "boolean",
                "description": "True when image quality or angle is insufficient for confident analysis",
            },
        },
        "required": [
            "subject",
            "determination",
            "confidence",
            "likely_location",
            "evidence",
            "recommended_action",
            "needs_more_photos",
        ],
    },
}

# OpenAI JSON-mode prompt suffix
_OPENAI_JSON_SCHEMA = (
    "\n\nRespond ONLY with a valid JSON object that matches exactly this schema:\n"
    '{"subject": string, "determination": boolean, "confidence": number (0-1), '
    '"likely_location": string, "evidence": string[], '
    '"recommended_action": string, "needs_more_photos": boolean}'
)


# ---------------------------------------------------------------------------
# Image processing
# ---------------------------------------------------------------------------


def _process_image(data: bytes) -> tuple[bytes, str]:
    """Resize to max dimension and normalise format. Returns (bytes, mime_type)."""
    try:
        img = Image.open(io.BytesIO(data))
    except UnidentifiedImageError as exc:
        raise ValueError("Cannot decode image — file may be corrupt or unsupported") from exc

    img.thumbnail(
        (settings.max_image_dimension, settings.max_image_dimension),
        Image.LANCZOS,
    )

    # Normalise to JPEG (RGB) or PNG (RGBA / palette)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGBA")
        save_fmt, mime = "PNG", "image/png"
    else:
        img = img.convert("RGB")
        save_fmt, mime = "JPEG", "image/jpeg"

    buf = io.BytesIO()
    img.save(buf, format=save_fmt, quality=85, optimize=True)
    return buf.getvalue(), mime


# ---------------------------------------------------------------------------
# Provider calls
# ---------------------------------------------------------------------------


async def _call_openai(images: list[tuple[bytes, str]]) -> AnalysisResult:
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    user_content: list[dict[str, Any]] = [
        {"type": "text", "text": "Analyse these images for damage and wear."}
    ]
    for img_bytes, mime in images:
        encoded = base64.b64encode(img_bytes).decode()
        user_content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{mime};base64,{encoded}",
                    "detail": "high",
                },
            }
        )

    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT + _OPENAI_JSON_SCHEMA},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        max_tokens=settings.ai_max_tokens,
        temperature=settings.ai_temperature,
    )

    if not response.choices:
        raise ValueError("OpenAI returned an empty response (no choices)")

    raw = response.choices[0].message.content or ""
    try:
        payload = json.loads(raw)
        return AnalysisResult(**payload)
    except (json.JSONDecodeError, ValidationError) as exc:
        logger.error("openai_response_parse_error", extra={"raw": raw[:500], "error": str(exc)})
        raise ValueError(f"Model returned a malformed response: {exc}") from exc


async def _call_anthropic(images: list[tuple[bytes, str]]) -> AnalysisResult:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_content: list[dict[str, Any]] = []
    for img_bytes, mime in images:
        encoded = base64.b64encode(img_bytes).decode()
        user_content.append(
            {
                "type": "image",
                "source": {"type": "base64", "media_type": mime, "data": encoded},
            }
        )
    user_content.append({"type": "text", "text": "Analyse these images for damage and wear."})

    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.ai_max_tokens,
        system=_SYSTEM_PROMPT,
        tools=[_ANALYSIS_TOOL_SCHEMA],
        tool_choice={"type": "tool", "name": "record_analysis"},
        messages=[{"role": "user", "content": user_content}],
    )

    tool_block = next(
        (block for block in response.content if block.type == "tool_use"),
        None,
    )
    if tool_block is None:
        raise ValueError("Model did not return the expected tool call")

    try:
        return AnalysisResult(**tool_block.input)
    except ValidationError as exc:
        logger.error("anthropic_tool_validation_error", extra={"error": str(exc)})
        raise ValueError(f"Model tool input failed schema validation: {exc}") from exc


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


async def analyze_images(raw_images: List[bytes]) -> AnalysisResult:
    processed = [_process_image(img) for img in raw_images]

    if settings.ai_provider == "anthropic" and settings.anthropic_api_key:
        result = await _call_anthropic(processed)
    else:
        result = await _call_openai(processed)

    # Enforce threshold — service layer owns this invariant
    if result.confidence < settings.confidence_threshold:
        result.needs_more_photos = True

    return result
