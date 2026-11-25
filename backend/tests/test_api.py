"""The HTTP layer: validation, error shape, request ids. The analysis itself is faked."""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import router as router_module
from app.main import app
from app.schema import AnalysisResult

client = TestClient(app, raise_server_exceptions=False)

RESULT = AnalysisResult(
    subject="toilet tank",
    determination=False,
    confidence=0.8,
    likely_location="none",
    evidence=["clean surface"],
    recommended_action="No action needed",
)


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (10, 10, 10)).save(buf, format="PNG")
    return buf.getvalue()


def _files(n=1, content_type="image/png", name="photo.png"):
    return [("images", (name, _png(), content_type)) for _ in range(n)]


@pytest.fixture
def fake_analysis(monkeypatch):
    async def ok(raw_images):
        return RESULT

    monkeypatch.setattr(router_module, "analyze_images", ok)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_every_response_carries_a_request_id():
    response = client.get("/health")
    assert len(response.headers["X-Request-ID"]) == 36


def test_success_returns_the_contract_plus_the_request_id(fake_analysis):
    response = client.post("/analyze", files=_files())
    assert response.status_code == 200
    body = response.json()
    assert body["subject"] == "toilet tank"
    assert body["request_id"] == response.headers["X-Request-ID"]
    assert set(body) == set(AnalysisResult.model_fields) | {"request_id"}


def test_three_images_are_accepted(fake_analysis):
    assert client.post("/analyze", files=_files(3)).status_code == 200


def test_four_images_are_rejected(fake_analysis):
    response = client.post("/analyze", files=_files(4))
    assert response.status_code == 422
    assert response.json()["error"] == "Too many images"


def test_no_images_are_rejected():
    response = client.post("/analyze")
    assert response.status_code == 422
    assert set(response.json()) == {"error", "detail"}


def test_unsupported_file_type_is_rejected_before_analysis(fake_analysis):
    response = client.post("/analyze", files=_files(content_type="video/mp4", name="clip.mp4"))
    assert response.status_code == 422
    assert response.json()["error"] == "Unsupported file type"
    assert "clip.mp4" in response.json()["detail"]


def test_oversized_file_is_rejected(fake_analysis, monkeypatch):
    monkeypatch.setattr(router_module, "_MAX_BYTES", 10)
    response = client.post("/analyze", files=_files())
    assert response.status_code == 413
    assert response.json()["error"] == "File too large"


def test_a_model_that_breaks_the_contract_surfaces_as_422(monkeypatch):
    async def bad(raw_images):
        raise ValueError("Model returned a malformed response")

    monkeypatch.setattr(router_module, "analyze_images", bad)
    response = client.post("/analyze", files=_files())
    assert response.status_code == 422
    assert response.json()["error"] == "Analysis failed"


def test_a_provider_outage_surfaces_as_503(monkeypatch):
    async def down(raw_images):
        raise RuntimeError("upstream timeout")

    monkeypatch.setattr(router_module, "analyze_images", down)
    response = client.post("/analyze", files=_files())
    assert response.status_code == 503
    assert response.json()["error"] == "Service unavailable"
    assert "upstream timeout" not in response.text  # internal detail is not leaked


def test_error_bodies_always_use_the_error_detail_shape(fake_analysis):
    for response in (
        client.post("/analyze", files=_files(4)),
        client.post("/analyze", files=_files(content_type="text/plain")),
        client.get("/does-not-exist"),
    ):
        assert set(response.json()) == {"error", "detail"}
