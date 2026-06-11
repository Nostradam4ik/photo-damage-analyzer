from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ai_provider: Literal["openai", "anthropic", "groq"] = "openai"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    # empty string means "use the SDK default" — service.py converts "" to None before passing it
    openai_base_url: str = ""

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-8"

    groq_api_key: str = ""
    groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # env vars can only hold strings, so we store origins as CSV and parse in cors_origins_list
    cors_allowed_origins: str = (
        "http://localhost:8081,"
        "http://localhost:19000,"
        "http://localhost:19006,"
        "exp://localhost:8081"
    )

    confidence_threshold: float = 0.65
    max_image_size_mb: int = 10
    max_image_dimension: int = 1024

    # AI call tuning — exposed as env vars so ops can adjust without a deploy
    ai_max_tokens: int = 1024
    ai_temperature: float = 0.1

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


settings = Settings()
