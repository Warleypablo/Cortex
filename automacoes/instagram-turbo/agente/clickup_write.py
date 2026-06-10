"""
Operações de ESCRITA no ClickUp.

Módulo separado do clickup.py (que é read-only) pra deixar explícito quando
o agente está mutando estado do workspace compartilhado da TurboPartners.

Tudo aqui respeita DRY_RUN: se DRY_RUN=1, retorna stub sem chamar a API.

Operações:
  - update_task_status(task_id, status)       PUT /task/{id}
  - create_comment(task_id, text)             POST /task/{id}/comment
  - mark_posted(task_id, ig_media_id, ig_url) atalho: comment com marker
                                              [agente:postado v1] + status=postado
"""
from __future__ import annotations
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone

from agente.config import CONFIG
from agente.idempotency import MARKER_POSTED

API_BASE = "https://api.clickup.com/api/v2"


def _request(method: str, path: str, body: dict | None = None) -> dict:
    CONFIG.require_clickup()
    url = f"{API_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": CONFIG.clickup_api_token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_err = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"ClickUp {e.code} em {method} {path}: {body_err}") from e


def update_task_status(task_id: str, status: str) -> dict:
    """
    Muda status da task. Em DRY_RUN, só loga.
    Retorna o payload da API (ou stub em dry-run).
    """
    if CONFIG.dry_run:
        return {"_dry_run": True, "task_id": task_id, "status": status}
    return _request("PUT", f"/task/{task_id}", {"status": status})


def create_comment(task_id: str, text: str) -> dict:
    """
    Cria comentário na task. Em DRY_RUN, só loga.
    """
    if CONFIG.dry_run:
        return {"_dry_run": True, "task_id": task_id, "comment_text": text}
    return _request("POST", f"/task/{task_id}/comment", {"comment_text": text})


def mark_posted(task_id: str, ig_media_id: str, ig_permalink: str | None,
                tipo_post: str, run_id: str | None = None) -> dict:
    """
    Atalho idempotente: cria comment com marker + URL do post e muda status pra 'postado'.
    Retorna {'comment': ..., 'status_update': ...}.

    O marker [agente:postado v1] é o que idempotency.inspect_comments procura
    em runs seguintes pra NÃO repostar a mesma task.
    """
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    permalink_line = f"\n🔗 {ig_permalink}" if ig_permalink else ""
    run_line = f" run_id={run_id}" if run_id else ""
    text = (
        f"✅ Publicado no Instagram ({tipo_post})"
        f"{permalink_line}"
        f"\n\n{MARKER_POSTED} media_id={ig_media_id}{run_line} at={ts}"
    )
    comment = create_comment(task_id, text)
    status_update = update_task_status(task_id, "postado")
    return {"comment": comment, "status_update": status_update}


def mark_error(task_id: str, error_text: str) -> dict:
    """
    Registra erro como comment (sem mudar status). Usa marker [agente:erro]
    pra deixar rastreável; NÃO bloqueia reprocesso futuro.
    """
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    text = f"⚠️ Erro na automação ({ts}):\n```\n{error_text}\n```\n\n[agente:erro]"
    return create_comment(task_id, text)
