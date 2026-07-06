"""
Cliente HTTP dos endpoints de MÁQUINA do painel Orgânico (token-auth).

O worker-poller usa isto pra:
  - puxar comandos pendentes  → GET  /commands/pending?platform=
  - dar ack nos comandos       → POST /commands/:id/ack
  - pegar agendados vencidos   → GET  /posts/due?platform=

Mesma filosofia do state_sink: zero dependência externa (só urllib) e FAIL-SOFT —
sem URL/token configurados, ou falha de rede, retorna vazio/False e loga, nunca
quebra o ciclo. A base é derivada de CORTEX_INGEST_URL (…/ingest → …).
"""
from __future__ import annotations
import json
import urllib.error
import urllib.request
from typing import Any
from urllib.parse import quote

from agente import http_retry
from agente.config import CONFIG


def _base() -> str:
    url = (CONFIG.cortex_ingest_url or "").strip()
    if url.endswith("/ingest"):
        url = url[: -len("/ingest")]
    return url


def _ready() -> bool:
    return bool(_base() and (CONFIG.organico_ingest_token or "").strip())


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {(CONFIG.organico_ingest_token or '').strip()}",
    }


def _get(path: str) -> dict | None:
    if not _ready():
        return None
    req = urllib.request.Request(f"{_base()}{path}", method="GET", headers=_headers())
    try:
        _status, body = http_retry.fetch(req, what=f"GET {path}")
        return json.loads(body.decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"   ⚠️  painel GET {path} falhou (segue) — {type(e).__name__}: {e}")
        return None


def pull_pending(platform: str) -> list[dict]:
    """Comandos pending da plataforma (mais antigos primeiro)."""
    data = _get(f"/commands/pending?platform={quote(platform)}")
    return list(data.get("commands") or []) if data else []


def get_due(platform: str) -> list[dict]:
    """Posts agendados cujo horário já venceu e ainda não publicaram."""
    data = _get(f"/posts/due?platform={quote(platform)}")
    return list(data.get("posts") or []) if data else []


def claim(platform: str, task_id: Any) -> bool:
    """Reivindica ATOMICAMENTE uma task pra publicar — só UM worker ganha, evitando post
    DUPLICADO em crons de publish sobrepostos. Retorna True só se ESTE worker ganhou o claim.

    Fail-CLOSED de propósito: se o painel não confirmar (não configurado, erro de rede,
    erro 5xx), retorna False e o worker NÃO publica neste tick — tenta no próximo. A
    segurança contra duplicata vem antes da pressa; o post não se perde, só atrasa 1 ciclo.
    Exceção: 404 (Cortex antigo sem /posts/claim) → fail-OPEN (publica sem claim, compat)."""
    if not _ready() or task_id is None:
        return False
    body = json.dumps({"platform": platform, "clickupTaskId": str(task_id)}).encode("utf-8")
    req = urllib.request.Request(
        f"{_base()}/posts/claim", data=body, method="POST", headers=_headers(),
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode("utf-8"))
            return bool(data.get("claimed"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("   ℹ️  painel sem /posts/claim (Cortex antigo) — publico sem claim")
            return True
        print(f"   ⚠️  painel claim({task_id}) HTTP {e.code} — NÃO publico neste tick (tenta no próximo)")
        return False
    except Exception as e:  # noqa: BLE001
        print(f"   ⚠️  painel claim({task_id}) falhou — NÃO publico neste tick — {type(e).__name__}: {e}")
        return False


def ack(command_id: Any, status: str, *, result: dict | None = None, error: str | None = None) -> bool:
    """Marca um comando: running | done | failed | canceled. Fail-soft."""
    if not _ready() or command_id is None:
        return False
    body: dict = {"status": status}
    if result is not None:
        body["result"] = result
    if error is not None:
        body["error"] = error
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{_base()}/commands/{command_id}/ack", data=data, method="POST", headers=_headers(),
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return 200 <= r.status < 300
    except Exception as e:  # noqa: BLE001
        print(f"   ⚠️  painel ack({command_id}, {status}) falhou (segue) — {type(e).__name__}: {e}")
        return False
