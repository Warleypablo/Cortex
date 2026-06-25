"""
Reporta o estado de cada ciclo do publicador pro painel "Orgânico" do Cortex.

Zero dependência externa (só urllib, como o resto do agente). Em vez de escrever
direto no Postgres (que exigiria driver + credenciais do banco no worker), o worker
faz um POST autenticado por token pro Cortex, que escreve nas tabelas content_*.

Fail-soft DE PROPÓSITO: se CORTEX_INGEST_URL/ORGANICO_INGEST_TOKEN não estiverem
setados, ou se o POST falhar, apenas loga um aviso e segue — NUNCA quebra a
publicação por causa de telemetria do painel.

Config (env, opcionais — ficam no .env do agente):
  CORTEX_INGEST_URL      ex.: https://cortex.turbopartners.com.br/api/growth/organico/ingest
  ORGANICO_INGEST_TOKEN  token compartilhado (mesmo valor no .env do Cortex)
"""
from __future__ import annotations
import json
import urllib.error
import urllib.request
from datetime import date
from typing import Any

from agente.config import CONFIG


def _today() -> str:
    return date.today().isoformat()


def panel_state(plan: Any) -> str:
    """Mapeia um PlannedAction pro estado que o painel mostra."""
    if plan.legenda_empty:
        return "aguardando_ia"
    if plan.skip_reason:
        # task com data futura ainda está "na fila" (agendada), não "pulada"
        if plan.posting_date and plan.posting_date > _today():
            return "agendado"
        return "pulado"
    return "agendado"


def panel_post(plan: Any, platform: str = "instagram") -> dict:
    """Dict de um post a partir do PlannedAction (estado pré-publicação)."""
    return {
        "clickup_task_id": plan.task_id,
        "task_name": plan.task_name,
        "platform": platform,
        "mes": plan.mes,
        "turbo_slug": plan.turbo_slug,
        "posting_date": plan.posting_date,        # ISO 'YYYY-MM-DD' ou None
        "slot": plan.slot_now,
        "tipo_post": plan.tipo_post,
        "asset_count": plan.asset_count,
        "legenda_source": plan.legenda_source,
        "legenda_len": plan.legenda_len,
        "legenda_empty": plan.legenda_empty,
        "state": panel_state(plan),
        "skip_reason": plan.skip_reason,
        "error_text": plan.error,
        "permalink": None,
        "published_media_id": None,
    }


def report_cycle(
    platform: str,
    *,
    run_id: str,
    dry_run: bool,
    started_at: str,
    counts: dict,
    posts: list[dict],
    status: str = "ok",
) -> None:
    """POST fail-soft do ciclo (run + posts) pro Cortex. Nunca levanta exceção."""
    url = (CONFIG.cortex_ingest_url or "").strip()
    token = (CONFIG.organico_ingest_token or "").strip()
    if not url or not token:
        print("   ℹ️  painel: CORTEX_INGEST_URL/ORGANICO_INGEST_TOKEN não setados — não reporto")
        return

    payload = {
        "platform": platform,
        "run": {
            "run_id": run_id,
            "platform": platform,
            "dry_run": dry_run,
            "status": status,
            "started_at": started_at,
            "counts": counts,
        },
        "posts": posts,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            print(f"   📡 painel atualizado: {len(posts)} post(s) reportado(s) (HTTP {r.status})")
    except urllib.error.HTTPError as e:
        body = e.read()[:200] if hasattr(e, "read") else b""
        print(f"   ⚠️  painel: ingest retornou {e.code} (segue normal) — {body!r}")
    except Exception as e:  # noqa: BLE001
        print(f"   ⚠️  painel: falha ao reportar (segue normal) — {type(e).__name__}: {e}")
