from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ai_provider: Literal["openai", "anthropic"] = "openai"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    # Optional override — set to use any OpenAI-compatible provider (Groq, Azure, etc.)
    openai_base_url: str = ""

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-5"

    # Comma-separated list of origins allowed by CORS (no trailing slashes).
    # In production, set this to your app's actual origin(s).
    cors_allowed_origins: str = (
        "http://localhost:8081,"
        "http://localhost:19000,"
        "http://localhost:19006,"
        "exp://localhost:8081"
    )

    confidence_threshold: float = 0.65
    max_image_size_mb: int = 10
    max_image_dimension: int = 1024

    # AI call tuning — exposed as env vars so ops can adjust without a deploy.
    ai_max_tokens: int = 1024
    ai_temperature: float = 0.1

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


settings = Settings()
