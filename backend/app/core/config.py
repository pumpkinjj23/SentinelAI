import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "SentinelAI - AI-Powered SOC Alert Triage Platform"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = os.getenv("APP_ENV", "development")

    # Database: Defaults to local SQLite for immediate execution; supports PostgreSQL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sentinelai.db")

    # AI Engine Settings: "mock" | "openai" | "gemini" | "ollama"
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.1")

    # Threat Intelligence Settings: "mock" | "live"
    IOC_MODE: str = os.getenv("IOC_MODE", "mock")
    ABUSEIPDB_API_KEY: str = os.getenv("ABUSEIPDB_API_KEY", "")
    VIRUSTOTAL_API_KEY: str = os.getenv("VIRUSTOTAL_API_KEY", "")

    # 2FA & Security Encryption Settings
    # 32-byte URL-safe base64 Fernet key for encrypting per-user TOTP secrets at rest
    TOTP_ENCRYPTION_KEY: str = os.getenv(
        "TOTP_ENCRYPTION_KEY",
        "U2VudGluZWxBSV8yRkFfRmVybmV0X0tleV8yMDI2X1NPQ19TZWMy",
    )
    BOOTSTRAP_USERNAME: str = os.getenv("BOOTSTRAP_USERNAME", "admin")
    BOOTSTRAP_PASSWORD: str = os.getenv("BOOTSTRAP_PASSWORD", "Admin@2026")
    SESSION_COOKIE_NAME: str = "sentinelai_session"
    SESSION_MAX_AGE_SECONDS: int = 86400  # 24 hours
    MAX_FAILED_AUTH_ATTEMPTS: int = 5
    LOCKOUT_DURATION_SECONDS: int = 300  # 5 minutes

    # Datasets path
    DATASETS_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent / "datasets"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
