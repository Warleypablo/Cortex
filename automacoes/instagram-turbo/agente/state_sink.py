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
    """Mapeia um PlannedAction pro estado que o painel mostra.

    Para o painel do operador, uma task aprovada e PRONTA (assets + legenda),
    SEM Horário definido, vira 'aprovado' — é o que o operador pode soltar/agendar.
    Com Horário definido (card ou operador) = 'agendado'. Legenda pendente =
    'aguardando_ia'. Sem assets/placeholder = 'pulado'.
    Planejar com force_now=True faz os skips de data não mascararem a prontidão.
    """
    src = getattr(plan, "legenda_source", None)
    if plan.legenda_empty or src in ("claude-precisa", "ia"):
        return "aguardando_ia"
    if getattr(plan, "scheduled_at", None):  # tem Horário definido (card ou operador) → agendado
        return "agendado"
    if getattr(plan, "is_ready_to_publish", False):
        return "aprovado"
    return "pulado"


# Códigos de bloqueio POR CARD (o front mapeia pra rótulo humano):
#   legenda = sem legenda no Doc · midia = sem mídia/tipo · horario = sem Horário no card
#   google = OAuth pendente · erro = erro no plano · pulado = skip (placeholder/idempotência)
def panel_readiness(plan: Any) -> tuple[str, list[str]]:
    """Prontidão POR CARD: o conteúdo está pronto e tem horário pra sair? Calculada do MESMO
    dado que o worker usa pra publicar (as condições do is_ready_to_publish, destrinchadas)
    + horário do card. O painel só PINTA isto — nunca infere de snapshot. Retorna
    (readiness, reasons): 'published' já postado · 'ready' pronto · 'blocked' (reasons = o quê falta).

    NB: dry-run e "agente pausado" são estados GLOBAIS (vêm no run/settings, não no card). O
    painel COMBINA este readiness com esses globais — por isso não entram aqui como bloqueio.
    """
    if getattr(plan, "already_posted", False):
        return "published", []
    reasons: list[str] = []
    src = getattr(plan, "legenda_source", None)
    if plan.legenda_empty or src != "doc":
        reasons.append("legenda")
    if not getattr(plan, "asset_count", 0) or plan.tipo_post not in ("reels", "carousel", "single"):
        reasons.append("midia")
    if getattr(plan, "oauth_pending", False):
        reasons.append("google")
    if getattr(plan, "error", None):
        reasons.append("erro")
    if getattr(plan, "skip_reason", None):
        reasons.append("pulado")
    if not getattr(plan, "scheduled_at", None):
        reasons.append("horario")
    return ("ready" if not reasons else "blocked"), reasons


def panel_post(plan: Any, platform: str = "instagram") -> dict:
    """Dict de um post a partir do PlannedAction (estado pré-publicação)."""
    readiness, block_reasons = panel_readiness(plan)
    return {
        "clickup_task_id": plan.task_id,
        "task_name": plan.task_name,
        "platform": platform,
        "mes": plan.mes,
        "turbo_slug": plan.turbo_slug,
        "posting_date": plan.posting_date,        # ISO 'YYYY-MM-DD' ou None
        "posting_time": getattr(plan, "posting_time", None),   # 'HH:MM' explícito ou None
        "card_scheduled_at": getattr(plan, "scheduled_at", None),  # data+hora do card (ISO)
        "slot": plan.slot_now,
        "tipo_post": plan.tipo_post,
        "asset_count": plan.asset_count,
        "legenda_source": plan.legenda_source,
        "legenda_len": plan.legenda_len,
        "legenda_empty": plan.legenda_empty,
        "state": panel_state(plan),
        "readiness": readiness,           # prontidão autoritativa: vai sair? (ready/blocked/published)
        "block_reasons": block_reasons,   # códigos do que falta quando blocked (front mapeia)
        "skip_reason": plan.skip_reason,
        "error_text": plan.error,
        "permalink": None,
        "published_media_id": None,
    }


def _send_ingest(payload: dict) -> bool:
    """POST fail-soft pro /ingest do Cortex. Nunca levanta exceção. True se 2xx."""
    url = (CONFIG.cortex_ingest_url or "").strip()
    token = (CONFIG.organico_ingest_token or "").strip()
    if not url or not token:
        print("   ℹ️  painel: CORTEX_INGEST_URL/ORGANICO_INGEST_TOKEN não setados — não reporto")
        return False
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            n = len(payload.get("posts") or [])
            print(f"   📡 painel atualizado: {n} post(s) reportado(s) (HTTP {r.status})")
            return True
    except urllib.error.HTTPError as e:
        body = e.read()[:200] if hasattr(e, "read") else b""
        print(f"   ⚠️  painel: ingest retornou {e.code} (segue normal) — {body!r}")
    except Exception as e:  # noqa: BLE001
        print(f"   ⚠️  painel: falha ao reportar (segue normal) — {type(e).__name__}: {e}")
    return False


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
    _send_ingest({
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
    })


def report_posts(platform: str, posts: list[dict]) -> None:
    """Reporta só posts (sem run/heartbeat) — usado pelo consumidor de comandos."""
    _send_ingest({"platform": platform, "run": None, "posts": posts})
