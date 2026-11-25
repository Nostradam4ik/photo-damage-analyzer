"""The JSON contract and the service that enforces it. No network: providers are faked."""

import io
import json
from types import SimpleNamespace

import pytest
from PIL import Image
from pydantic import ValidationError

from app import service
from app.config import settings
from app.schema import AnalysisResult

GOOD = {
    "subject": "drain pipe",
    "determination": True,
    "confidence": 0.9,
    "likely_location": "lower joint",
    "evidence": ["rust stain", "visible drip"],
    "recommended_action": "Replace the joint",
    "needs_more_photos": False,
}


def _image_bytes(size=(64, 64), mode="RGB", fmt="PNG") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, (120, 30, 30) if mode == "RGB" else (120, 30, 30, 128)).save(buf, format=fmt)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------


def test_valid_payload_is_accepted():
    result = AnalysisResult(**GOOD)
    assert result.subject == "drain pipe"
    assert result.evidence == ["rust stain", "visible drip"]


def test_needs_more_photos_defaults_to_false():
    payload = {k: v for k, v in GOOD.items() if k != "needs_more_photos"}
    assert AnalysisResult(**payload).needs_more_photos is False


@pytest.mark.parametrize("confidence", [-0.01, 1.01, 5])
def test_confidence_outside_unit_interval_is_rejected(confidence):
    with pytest.raises(ValidationError):
        AnalysisResult(**{**GOOD, "confidence": confidence})


@pytest.mark.parametrize("confidence", [0.0, 0.5, 1.0])
def test_confidence_bounds_are_inclusive(confidence):
    assert AnalysisResult(**{**GOOD, "confidence": confidence}).confidence == confidence


def test_evidence_must_not_be_empty():
    with pytest.raises(ValidationError):
        AnalysisResult(**{**GOOD, "evidence": []})


@pytest.mark.parametrize("missing", ["subject", "determination", "confidence", "likely_location", "evidence", "recommended_action"])
def test_required_fields_are_required(missing):
    payload = {k: v for k, v in GOOD.items() if k != missing}
    with pytest.raises(ValidationError):
        AnalysisResult(**payload)


# ---------------------------------------------------------------------------
# Image processing
# ---------------------------------------------------------------------------


def test_large_image_is_shrunk_to_the_configured_dimension(monkeypatch):
    monkeypatch.setattr(settings, "max_image_dimension", 100)
    data, mime = service._process_image(_image_bytes(size=(400, 300)))
    out = Image.open(io.BytesIO(data))
    assert max(out.size) == 100
    assert mime == "image/jpeg"


def test_rgb_becomes_jpeg_and_alpha_stays_png():
    _, rgb_mime = service._process_image(_image_bytes(mode="RGB"))
    _, rgba_mime = service._process_image(_image_bytes(mode="RGBA"))
    assert rgb_mime == "image/jpeg"
    assert rgba_mime == "image/png"


def test_undecodable_bytes_raise_value_error():
    with pytest.raises(ValueError, match="Cannot decode image"):
        service._process_image(b"this is not an image")


# ---------------------------------------------------------------------------
# analyze_images: configuration and the confidence gate
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "provider, key_attr",
    [("openai", "openai_api_key"), ("anthropic", "anthropic_api_key"), ("groq", "groq_api_key")],
)
async def test_missing_api_key_is_reported(monkeypatch, provider, key_attr):
    monkeypatch.setattr(settings, "ai_provider", provider)
    monkeypatch.setattr(settings, key_attr, "")
    with pytest.raises(ValueError, match="is not set"):
        await service.analyze_images([_image_bytes()])


@pytest.mark.parametrize(
    "confidence, model_says, expected",
    [(0.5, False, True), (0.64, False, True), (0.65, True, False), (0.95, True, False)],
)
async def test_needs_more_photos_follows_the_threshold_not_the_model(monkeypatch, confidence, model_says, expected):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "test")
    monkeypatch.setattr(settings, "confidence_threshold", 0.65)

    async def fake_call(images):
        return AnalysisResult(**{**GOOD, "confidence": confidence, "needs_more_photos": model_says})

    monkeypatch.setattr(service, "_call_openai", fake_call)
    result = await service.analyze_images([_image_bytes()])
    assert result.needs_more_photos is expected


# ---------------------------------------------------------------------------
# Providers (fake SDK clients)
# ---------------------------------------------------------------------------


def _fake_openai(monkeypatch, content=None, choices=None):
    seen = {}

    class FakeClient:
        def __init__(self, api_key, base_url):
            seen["api_key"], seen["base_url"] = api_key, base_url
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

        async def _create(self, **kwargs):
            seen["kwargs"] = kwargs
            if choices is not None:
                return SimpleNamespace(choices=choices)
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    monkeypatch.setattr(service.openai, "AsyncOpenAI", FakeClient)
    return seen


async def test_openai_path_parses_a_valid_json_answer(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "k")
    seen = _fake_openai(monkeypatch, content=json.dumps(GOOD))
    result = await service.analyze_images([_image_bytes()])
    assert result.subject == "drain pipe"
    assert seen["kwargs"]["response_format"] == {"type": "json_object"}


async def test_groq_reuses_the_openai_client_with_its_own_credentials(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "groq-key")
    seen = _fake_openai(monkeypatch, content=json.dumps(GOOD))
    await service.analyze_images([_image_bytes()])
    assert seen["api_key"] == "groq-key"
    assert seen["base_url"] == settings.groq_base_url
    assert seen["kwargs"]["model"] == settings.groq_model


@pytest.mark.parametrize(
    "content",
    ["not json at all", json.dumps({"subject": "only this"}), json.dumps({**GOOD, "confidence": 3}), ""],
)
async def test_openai_malformed_answers_become_value_errors(monkeypatch, content):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "k")
    _fake_openai(monkeypatch, content=content)
    with pytest.raises(ValueError, match="malformed"):
        await service.analyze_images([_image_bytes()])


async def test_openai_empty_choices_become_a_value_error(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", "k")
    _fake_openai(monkeypatch, choices=[])
    with pytest.raises(ValueError, match="empty response"):
        await service.analyze_images([_image_bytes()])


def _fake_anthropic(monkeypatch, blocks):
    class FakeClient:
        def __init__(self, api_key):
            self.messages = SimpleNamespace(create=self._create)

        async def _create(self, **kwargs):
            assert kwargs["tool_choice"] == {"type": "tool", "name": "record_analysis"}
            return SimpleNamespace(content=blocks)

    monkeypatch.setattr(service.anthropic, "AsyncAnthropic", FakeClient)


async def test_anthropic_path_reads_the_forced_tool_call(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "k")
    _fake_anthropic(monkeypatch, [SimpleNamespace(type="text"), SimpleNamespace(type="tool_use", input=GOOD)])
    result = await service.analyze_images([_image_bytes()])
    assert result.determination is True


async def test_anthropic_without_a_tool_call_is_a_value_error(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "k")
    _fake_anthropic(monkeypatch, [SimpleNamespace(type="text")])
    with pytest.raises(ValueError, match="tool call"):
        await service.analyze_images([_image_bytes()])


async def test_anthropic_tool_input_that_breaks_the_contract_is_a_value_error(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "k")
    _fake_anthropic(monkeypatch, [SimpleNamespace(type="tool_use", input={**GOOD, "evidence": []})])
    with pytest.raises(ValueError, match="schema validation"):
        await service.analyze_images([_image_bytes()])
