"""
Poller do publicador Orgânico — o "engine" que o painel comanda.

Cada tick:
  1. reporta o estado das tasks aprovadas (saúde + Aprovados/Agendados/Publicados)
  2. consome a fila de comandos do painel (Soltar agora / Agendar / Cancelar)
  3. publica os agendados cujo horário venceu

Modos:
  python3 -m agente.main_poller --once          # 1 tick e sai (ideal p/ cron/launchd)
  python3 -m agente.main_poller                  # loop infinito (intervalo do .env)

--mode separa a releitura PESADA do ClickUp do laço LEVE de publicação, pra rodar
em ritmos diferentes (ver DEPLOY-RENDER.md):
  --mode report    # só relê o ClickUp e atualiza o calendário (cron de hora em hora)
  --mode publish   # só publica os vencidos + executa os botões (cron a cada 5 min;
                   #   NÃO relê o ClickUp inteiro — consulta o Cortex, é leve)
  --mode all       # os dois (default; usado no loop/manual)

DRY_RUN=1 (default): reporta e consome, mas NÃO publica de verdade — seguro p/ testar.
DRY_RUN=0: publica na conta real.

Obs (v1): o pausar/dry-run do painel ainda não controla o worker — quem manda é o
DRY_RUN do .env. Wire do settings → worker fica p/ a próxima iteração.
"""
from __future__ import annotations
import argparse
import time
import uuid
from datetime import datetime, timezone

from agente import clickup, commands, state_sink
from agente import main as core
from agente.config import CONFIG

PLATFORM = "instagram"


def _report_approved(platform: str, *, run_id: str, dry_run: bool) -> None:
    """Lista aprovadas no ClickUp, planeja (force_now) e reporta o estado pro painel."""
    try:
        tasks = clickup.list_approved_tasks()
    except Exception as e:  # noqa: BLE001
        print(f"   ⚠️  não consegui listar aprovadas: {type(e).__name__}: {e}")
        return
    posts: list[dict] = []
    counts: dict = {"approved_seen": len(tasks)}
    for t in tasks:
        try:
            plan = core.plan_task(t, force_now=True)
        except Exception as e:  # noqa: BLE001
            print(f"   ⚠️  plan falhou {getattr(t, 'id', '?')}: {type(e).__name__}: {e}")
            continue
        post = state_sink.panel_post(plan, platform)
        counts[post["state"]] = counts.get(post["state"], 0) + 1
        posts.append(post)
    state_sink.report_cycle(
        platform, run_id=run_id, dry_run=dry_run,
        started_at=datetime.now(timezone.utc).isoformat(), counts=counts, posts=posts,
    )
    print(f"   📋 reportadas {len(posts)} task(s): "
          + ", ".join(f"{k}={v}" for k, v in counts.items() if k != "approved_seen"))


def tick(platform: str = PLATFORM, *, dry_run: bool, mode: str = "all") -> None:
    """Um ciclo. `mode` escolhe o que roda — pra separar a releitura PESADA do
    ClickUp (modo 'report', de hora em hora) do laço LEVE de publicação/comandos
    (modo 'publish', a cada 5 min). 'all' faz os dois (loop/manual)."""
    run_id = uuid.uuid4().hex[:8]
    started = datetime.now(timezone.utc).isoformat()
    print(f"── tick {run_id}  {datetime.now().strftime('%H:%M:%S')}  dry_run={dry_run}  mode={mode}")
    if mode in ("all", "report"):
        _report_approved(platform, run_id=run_id, dry_run=dry_run)
    if mode in ("all", "publish"):
        n_cmds = commands.consume(platform, run_id=run_id, dry_run=dry_run)
        n_pub = commands.publish_due(platform, run_id=run_id, dry_run=dry_run)
        # No 'publish' puro o _report_approved não rodou (e é ele quem bate o
        # heartbeat). Batemos um heartbeat leve aqui pra a saúde do painel não
        # envelhecer 1h — mostra o agente vivo a cada tick de 5 min.
        if mode == "publish":
            counts: dict = {"mode": "publish", "commands": n_cmds}
            if n_pub:
                counts["published"] = n_pub
            state_sink.report_cycle(
                platform, run_id=run_id, dry_run=dry_run,
                started_at=started, counts=counts, posts=[],
            )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Poller do publicador Orgânico (painel)")
    ap.add_argument("--once", action="store_true", help="roda 1 tick e sai (cron/launchd)")
    ap.add_argument("--interval", type=int, default=CONFIG.poll_interval_seconds,
                    help="segundos entre ticks no modo loop")
    ap.add_argument("--mode", choices=("all", "publish", "report"), default="all",
                    help="all=tudo (loop/manual) · publish=só publica+comandos (cron 5min) · "
                         "report=só relê o ClickUp e atualiza o calendário (cron horário)")
    ap.add_argument("--platform", default=PLATFORM)
    args = ap.parse_args(argv)
    dry_run = CONFIG.dry_run

    if args.once:
        tick(args.platform, dry_run=dry_run, mode=args.mode)
        return 0

    print(f"poller iniciado — intervalo {args.interval}s, dry_run={dry_run}, mode={args.mode}")
    while True:
        try:
            tick(args.platform, dry_run=dry_run, mode=args.mode)
        except Exception as e:  # noqa: BLE001
            print(f"   ❌ tick falhou (segue): {type(e).__name__}: {e}")
        time.sleep(max(30, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
