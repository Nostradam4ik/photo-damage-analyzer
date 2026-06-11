# Photo Damage Analyzer

## Overview

Mobile app + AI backend that accepts 1–3 photos and returns a structured assessment of visible damage or wear. The backend calls Groq (Llama 4), OpenAI, or Anthropic (configurable via `AI_PROVIDER`) with a strict JSON contract, validates the model's output via Pydantic, and enforces a confidence threshold before sending results to the client.

---

## Architecture

```
[Expo App] ──POST /analyze (multipart)──▶ [FastAPI Backend]
                                                │
                        ┌───────────────────────┤
                        │  1. Validate & resize images (Pillow)
                        │  2. Call AI provider (OpenAI / Anthropic)
                        │  3. Parse + validate JSON with Pydantic
                        │  4. Enforce confidence threshold
                        └───────────────────────┤
                                                ▼
                              { subject, determination, confidence,
                                likely_location, evidence[],
                                recommended_action, needs_more_photos }
```

`backend/app/` is split into `config.py` (settings), `schema.py` (Pydantic models), `service.py` (image processing + AI calls), and `router.py` (HTTP layer). The frontend mirrors the schema in `types/api.ts`.

Copy Report — one-tap clipboard export of the full analysis result.

---

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # fill in your API key
uvicorn app.main:app --reload --port 8000
```

Or with Docker:

```bash
cp backend/.env.example backend/.env   # fill in your API key
docker-compose up --build
```

### Frontend

> **Before you start:** `frontend/.env` must point at your machine's LAN IP — `localhost` does not reach the host from a physical device.
> Find your IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux) and update `frontend/.env`:
> ```
> EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
> ```
> The simulator can use `localhost:8000` without changes.

```bash
cd frontend
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your device, or press `i` / `a` for simulator.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | **Yes** | `openai`, `anthropic`, or `groq` — must be set explicitly; the API key alone does not switch providers |
| `OPENAI_API_KEY` | If provider=openai | OpenAI secret key |
| `OPENAI_MODEL` | No | Default: `gpt-4o` |
| `ANTHROPIC_API_KEY` | If provider=anthropic | Anthropic secret key |
| `ANTHROPIC_MODEL` | No | Default: `claude-opus-4-8` |
| `GROQ_API_KEY` | If provider=groq | Groq secret key |
| `GROQ_MODEL` | No | Default: `meta-llama/llama-4-scout-17b-16e-instruct` |
| `CONFIDENCE_THRESHOLD` | No | Float 0–1, default `0.65` |
| `MAX_IMAGE_SIZE_MB` | No | Per-file limit, default `10` |
| `MAX_IMAGE_DIMENSION` | No | Resize ceiling px, default `1024` |
| `AI_MAX_TOKENS` | No | Token budget for AI response, default `1024` |
| `AI_TEMPERATURE` | No | Sampling temperature (OpenAI only), default `0.1` |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed origins, default: Expo localhost ports |

Frontend:

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | No | Backend URL, default `http://localhost:8000` |

---

## API Reference

### `POST /analyze`

**Request** — `multipart/form-data`

| Field | Type | Constraints |
|---|---|---|
| `images` | File[] | 1–3 files, jpeg/png/webp, max 10 MB each |

**Response 200**

```jsonc
{
  "subject": "Car door panel",
  "determination": true,
  "confidence": 0.91,
  "likely_location": "lower-left quadrant",
  "evidence": ["deep scratch ~15cm", "paint missing to bare metal"],
  "recommended_action": "Professional respray required",
  "needs_more_photos": false,
  "request_id": "3fa85f64-..."
}
```

**Errors**

| Status | When |
|---|---|
| 413 | Any file exceeds size limit |
| 422 | Wrong file type, >3 files, or model returned malformed JSON |
| 503 | AI provider API failure |

All errors: `{ "error": "Short title", "detail": "Human-readable explanation" }`

### `GET /health`

Returns `{ "status": "ok" }`.

---

## From Prototype to Production

- **Auth**: Add an API key header or OAuth2 to the `/analyze` endpoint.
- **Storage**: Persist uploaded images to S3/GCS; store results in Postgres with a `request_id` index.
- **Queue**: Move the AI call to a background task (Celery + Redis) and return a job ID; poll or use WebSockets for status.
- **Rate limiting**: Add per-IP/per-user limits via a middleware or API gateway.
- **Observability**: Route JSON logs to Datadog / Grafana Loki; add Prometheus metrics for latency and error rates.
- **Model fallback**: If the primary provider is unavailable, retry with the secondary before returning 503.

---

## What Was Faked / Cut

- No auth — any client can call `/analyze`.
- Images are not persisted (processed in memory only).
- No retry logic on the AI call (one attempt per request).
- Expo web is untested; UI is optimised for mobile.
- No end-to-end tests — only Pydantic validation acts as a contract test.

---

## What I'm Least Confident About

- **Confidence calibration**: The 0.65 threshold is arbitrary; in production it should be tuned against a labelled dataset.
- **MIME validation**: We check `Content-Type` headers and Pillow's format detection, but a determined client could spoof both — a magic-byte check would be more robust.
- **Groq structured output reliability**: The tool-call approach forces a JSON response, but I haven't stress-tested it against ambiguous or very dark images.
- **OpenAI schema enforcement**: The OpenAI/Groq path uses `response_format: json_object`, which guarantees valid JSON but not schema conformance — the field list is a hint in the system prompt. GPT-4o supports `response_format: json_schema` for true schema enforcement, but Groq does not, so a single code path uses the weaker mode. In production this should be split: structured outputs for OpenAI, tool-call forcing for Groq.
