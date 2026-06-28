"""
Consumidor da fila de comandos do painel Orgânico + publicação de agendados vencidos.

Fluxo (chamado a cada tick do poller):
  consume(platform)     → puxa /commands/pending e executa cada um:
       publish_now       → publica a task AGORA (force) e dá ack done
       schedule          → grava scheduled_at no post (vira "agendado") e dá ack done
       cancel_schedule   → limpa scheduled_at (volta a "aprovado") e dá ack done
  publish_due(platform) → puxa /posts/due (agendados vencidos) e publica cada um

DRY_RUN: nada é publicado de verdade — o consumidor planeja, valida prontidão e
dá ack 'done' com {dry_run:true}, mas NÃO chama execute_plan. Assim dá pra testar
todo o controle de fluxo sem tocar na conta real.

Idempotência da publicação continua garantida pelo marker de comentário no ClickUp
(o agente recusa repostar uma task já marcada POSTADO), então um comando repetido
não duplica post.
"""
from __future__ import annotations
from typing import Any

from agente import panel_client, state_sink


def _plan(task_id: str):
    """Carrega a task no ClickUp e monta o PlannedAction (force_now: ignora data/slot)."""
    from agente import clickup, main as core
    task = clickup.get_task(task_id)
    return core.plan_task(task, force_now=True)


def _publish(platform: str, task_id: str, *, run_id: str, dry_run: bool) -> tuple[bool, Any]:
    """Publica uma task agora. Retorna (ok, result_dict | mensagem_erro)."""
    from agente import main as core
    plan = _plan(task_id)
    if plan.error:
        return False, plan.error
    if not getattr(plan, "is_ready_to_publish", False):
        return False, plan.skip_reason or "post não está pronto para publicar"
    if dry_run:
        return True, {"dry_run": True, "tipo": plan.tipo_post, "task": task_id}
    res = core.execute_plan(plan, run_id=run_id, force_now=True)
    if res.error:
        return False, res.error
    post = state_sink.panel_post(plan, platform)
    post.update(state="publicado", readiness="published", published_media_id=res.ig_media_id, permalink=res.permalink)
    state_sink.report_posts(platform, [post])
    return True, {"media_id": res.ig_media_id, "permalink": res.permalink}


def _report_scheduled(platform: str, task_id: str, scheduled_at: Any, state: str) -> None:
    """Reporta o post com (ou sem) agendamento — move ele entre Aprovados/Agendados."""
    plan = _plan(task_id)
    post = state_sink.panel_post(plan, platform)
    post.update(state=state, scheduled_at=scheduled_at)  # scheduled_at=None LIMPA no ingest
    state_sink.report_posts(platform, [post])


def consume(platform: str = "instagram", *, run_id: str, dry_run: bool) -> int:
    """Puxa e executa os comandos pending da plataforma. Retorna quantos processou."""
    cmds = panel_client.pull_pending(platform)
    if not cmds:
        return 0
    print(f"   📥 {len(cmds)} comando(s) pending")
    for cmd in cmds:
        cid = cmd.get("id")
        action = cmd.get("action")
        task_id = cmd.get("clickupTaskId")
        payload = cmd.get("payload") or {}
        try:
            if action == "publish_now":
                if not task_id:
                    panel_client.ack(cid, "failed", error="publish_now sem task")
                    continue
                panel_client.ack(cid, "running")
                ok, info = _publish(platform, task_id, run_id=run_id, dry_run=dry_run)
                panel_client.ack(cid, "done" if ok else "failed",
                                 result=info if ok else None,
                                 error=None if ok else str(info))
                print(f"   {'✅' if ok else '❌'} publish_now {task_id}: {info}")

            elif action == "schedule":
                when = payload.get("scheduled_at")
                if not task_id or not when:
                    panel_client.ack(cid, "failed", error="schedule sem task/scheduled_at")
                    continue
                _report_scheduled(platform, task_id, when, "agendado")
                panel_client.ack(cid, "done", result={"scheduled_at": when})
                print(f"   🗓  agendado {task_id} → {when}")

            elif action == "cancel_schedule":
                if not task_id:
                    panel_client.ack(cid, "failed", error="cancel sem task")
                    continue
                _report_scheduled(platform, task_id, None, "aprovado")
                panel_client.ack(cid, "done")
                print(f"   🚫 agendamento cancelado {task_id}")

            else:
                # ações reconhecidas mas ainda não implementadas no worker v1
                panel_client.ack(cid, "done", result={"note": f"{action} sem ação no worker v1"})
                print(f"   ℹ️  {action} reconhecido, sem ação (v1)")
        except Exception as e:  # noqa: BLE001
            panel_client.ack(cid, "failed", error=f"{type(e).__name__}: {e}")
            print(f"   ❌ comando {cid} ({action}) falhou: {type(e).__name__}: {e}")
    return len(cmds)


def publish_due(platform: str = "instagram", *, run_id: str, dry_run: bool) -> int:
    """Publica os agendados cujo horário já venceu (state != publicado)."""
    due = panel_client.get_due(platform)
    if not due:
        return 0
    print(f"   🌙 {len(due)} agendado(s) vencido(s)")
    published = 0
    for p in due:
        task_id = p.get("clickupTaskId")
        if not task_id:
            continue
        if dry_run:
            print(f"   🌙 (dry-run) venceu {task_id} — publicaria agora")
            continue
        ok, info = _publish(platform, task_id, run_id=run_id, dry_run=False)
        if ok:
            published += 1
            print(f"   ✅ agendado publicado {task_id}: {info}")
        else:
            print(f"   ⚠️  falha publicando agendado {task_id}: {info}")
    return published
