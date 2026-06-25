"""Carrega .env. Zero dependência externa."""
from __future__ import annotations
import os
from pathlib import Path
from dataclasses import dataclass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"


def _load_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


@dataclass(frozen=True)
class Config:
    clickup_api_token: str
    clickup_list_id_instagram: str
    clickup_workspace_id: str
    drive_meses_root_folder_id: str
    google_service_account_json: str
    meta_long_lived_token: str
    ig_business_account_id: str
    gcs_rehost_bucket: str
    tiktok_client_key: str
    tiktok_client_secret: str
    tiktok_redirect_uri: str
    anthropic_api_key: str
    anthropic_model: str
    dry_run: bool
    poll_interval_seconds: int
    cortex_ingest_url: str
    organico_ingest_token: str

    @classmethod
    def load(cls) -> "Config":
        env = {**_load_env_file(ENV_PATH), **os.environ}
        return cls(
            clickup_api_token=env.get("CLICKUP_API_TOKEN", ""),
            clickup_list_id_instagram=env.get("CLICKUP_LIST_ID_INSTAGRAM", "901300920768"),
            clickup_workspace_id=env.get("CLICKUP_WORKSPACE_ID", "31021986"),
            drive_meses_root_folder_id=env.get(
                "GOOGLE_DRIVE_MESES_ROOT_FOLDER_ID",
                "1yGxKCORxe7PipuYKY1yd508IWQyKgIIt",
            ),
            google_service_account_json=env.get("GOOGLE_SERVICE_ACCOUNT_JSON", ""),
            meta_long_lived_token=env.get("META_LONG_LIVED_TOKEN", ""),
            ig_business_account_id=env.get("IG_BUSINESS_ACCOUNT_ID", ""),
            gcs_rehost_bucket=env.get("GCS_REHOST_BUCKET", ""),
            tiktok_client_key=env.get("TIKTOK_CLIENT_KEY", ""),
            tiktok_client_secret=env.get("TIKTOK_CLIENT_SECRET", ""),
            tiktok_redirect_uri=env.get("TIKTOK_REDIRECT_URI", ""),
            anthropic_api_key=env.get("ANTHROPIC_API_KEY", ""),
            anthropic_model=env.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            dry_run=env.get("DRY_RUN", "1") not in ("0", "false", "False", ""),
            poll_interval_seconds=int(env.get("POLL_INTERVAL_SECONDS", "300")),
            cortex_ingest_url=env.get("CORTEX_INGEST_URL", ""),
            organico_ingest_token=env.get("ORGANICO_INGEST_TOKEN", ""),
        )

    def require_clickup(self) -> None:
        if not self.clickup_api_token:
            raise RuntimeError("CLICKUP_API_TOKEN ausente no .env")

    def require_google(self) -> None:
        if not self.google_service_account_json:
            raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON ausente no .env")
        if not Path(self.google_service_account_json).is_file():
            raise RuntimeError(
                f"GOOGLE_SERVICE_ACCOUNT_JSON aponta para arquivo inexistente: "
                f"{self.google_service_account_json}"
            )

    def require_meta(self) -> None:
        if not self.meta_long_lived_token or not self.ig_business_account_id:
            raise RuntimeError("META_LONG_LIVED_TOKEN ou IG_BUSINESS_ACCOUNT_ID ausentes")

    def require_rehost(self) -> None:
        if not self.gcs_rehost_bucket:
            raise RuntimeError(
                "GCS_REHOST_BUCKET ausente no .env — defina o nome do bucket GCS "
                "privado criado pelo admin (ex.: turbo-ig-rehost)"
            )

    def require_tiktok(self) -> None:
        if not self.tiktok_client_key or not self.tiktok_client_secret:
            raise RuntimeError(
                "TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET ausentes no .env — pegue no "
                "app em developers.tiktok.com (produto Content Posting API)"
            )


CONFIG = Config.load()
