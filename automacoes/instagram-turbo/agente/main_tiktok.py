"""
Orquestrador do TikTok orgânico.

Entrypoint SEPARADO do agente do Instagram (agente/main.py) — de propósito:
o IG está em produção e NÃO deve ser tocado. Este módulo REUSA toda a parte
de leitura/planejamento que já existe e é agnóstica de plataforma:

  - clickup.list_approved_tasks(list_id)  → lê a lista do TikTok no ClickUp
  - main.plan_task(task)                  → resolve mês, Doc/legenda, pasta Drive
                                            e classifica os assets (mesmo plano do IG)

…e só troca o passo de PUBLICAÇÃO:

  - sem rehost (o TikTok sobe os bytes direto via FILE_UPLOAD — ver tiktok.py)
  - publica via tiktok.post_video_file_id(asset_id, draft=..., title=legenda)
  - marca no ClickUp com clickup_write.create_comment + update_task_status
    (reusa o marker [agente:postado v1], então a idempotência do plan_task
     já pula o que foi postado — TikTok e IG vivem em listas diferentes)

Diferenças do TikTok vs Instagram (por isso não é só "trocar a função"):
  - SÓ VÍDEO. Carrossel/imagem não são suportados aqui (TikTok photo mode
    não está implementado). Posts não-vídeo são pulados com aviso.
  - Modo de post (env TIKTOK_POST_MODE):
      • draft  (default) → cai nos rascunhos da conta; NÃO exige auditoria do app.
                           A legenda NÃO é aplicada (a pessoa digita ao publicar).
      • direct           → publica direto; exige auditoria p/ público. A legenda
                           vira o título. App não auditado só posta SELF_ONLY.

Config (env):
  CLICKUP_LIST_ID_TIKTOK   (obrigatório)  id da lista TikTok no ClickUp
  TIKTOK_POST_MODE         draft|direct   (default: draft)
  TIKTOK_PRIVACY_LEVEL     SELF_ONLY|PUBLIC_TO_EVERYONE|... (só p/ direct; default SELF_ONLY)

Modos:
  DRY_RUN=1 python3 -m agente.main_tiktok                    # dry-run completo
  DRY_RUN=1 python3 -m agente.main_tiktok --task-id <id>     # debug 1 card
  DRY_RUN=0 python3 -m agente.main_tiktok --task-id <id> --force-now
      # publica esse card agora (rascunho por default). Use conta de teste.
"""
from __future__ import annotations
import argparse
import os
import sys
import traceback
import uuid
from datetime import date, datetime, timezone

from agente import clickup, clickup_write, main as ig_main
from agente.config import CONFIG
from agente.idempotency import Lock, LockHeld, MARKER_POSTED


def _tiktok_list_id() -> str:
    lid = os.environ.get("CLICKUP_LIST_ID_TIKTOK", "").strip()
    if not lid:
        raise RuntimeError(
            "CLICKUP_LIST_ID_TIKTOK ausente no .env — id da lista do TikTok no ClickUp"
        )
    return lid


def _post_mode() -> str:
    m = os.environ.get("TIKTOK_POST_MODE", "draft").strip().lower()
    return m if m in ("draft", "direct") else "draft"


def _privacy_level() -> str:
    return os.environ.get("TIKTOK_PRIVACY_LEVEL", "SELF_ONLY").strip() or "SELF_ONLY"


def tiktok_ready(plan: "ig_main.PlannedAction", mode: str) -> tuple[bool, str | None]:
    """Readiness específico do TikTok (vídeo-only). Retorna (ok, motivo_se_nao)."""
    if plan.skip_reason:
        return False, plan.skip_reason
    if plan.error:
        return False, plan.error
    if plan.oauth_pending:
        return False, "aguardando OAuth Google (Doc/Drive)"
    if plan.asset_count == 0 or not plan.asset_ids:
        return False, "sem assets na pasta do Drive"
    if plan.tipo_post not in ("reels", "single"):
        return False, f"TikTok só posta vídeo — tipo '{plan.tipo_post}' não suportado (carrossel/foto)"
    if not (plan.asset_mimes and plan.asset_mimes[0].startswith("video/")):
        return False, "asset principal não é vídeo (TikTok = vídeo)"
    if mode == "direct" and plan.legenda_empty:
        return False, "modo direct precisa de legenda (vira o título); Doc sem legenda"
    return True, None


def publish_tiktok(plan: "ig_main.PlannedAction", *, mode: str, privacy: str,
                   run_id: str) -> str:
    """Publica o vídeo no TikTok e marca a task no ClickUp. Retorna publish_id."""
    from agente import tiktok  # import tardio: só quando vai publicar de fato

    asset_id = plan.asset_ids[0]
    res = tiktok.post_video_file_id(
        asset_id, draft=(mode == "draft"), title=plan.legenda_text or "",
        privacy_level=privacy,
    )

    # marca no ClickUp (reusa marker → idempotência do plan_task já cobre)
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
    where = "rascunho/inbox" if res.mode == "inbox" else "direct"
    text = (
        f"✅ Enviado ao TikTok ({where}, status={res.status})"
        f"\n\n{MARKER_POSTED} publish_id={res.publish_id} run_id={run_id} at={ts}"
    )
    clickup_write.create_comment(plan.task_id, text)
    clickup_write.update_task_status(plan.task_id, "postado")
    return res.publish_id


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Agente de publicação TikTok (orgânico)")
    ap.add_argument("--task-id", help="processa só essa task (debug / teste)")
    ap.add_argument("--force-now", action="store_true",
                    help="ignora filtro de Data=hoje e de slot. Use em conta de teste.")
    ap.add_argument("--caption-override", help="usa esta legenda (só com --task-id)")
    ap.add_argument("--direct", action="store_true",
                    help="força modo direct (default: TIKTOK_POST_MODE ou rascunho)")
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    run_id = uuid.uuid4().hex[:8]
    mode = "direct" if args.direct else _post_mode()
    privacy = _privacy_level()

    print("═══════════════════════════════════════════════════════════")
    print(f"  Agente TikTok — DRY_RUN={CONFIG.dry_run}   run_id={run_id}")
    print(f"  Modo: {mode}{f' (privacy={privacy})' if mode == 'direct' else ''}   "
          f"Hoje: {date.today().isoformat()}   Agora: {datetime.now().strftime('%H:%M')}")
    if args.force_now:
        print("  ⚠️  --force-now: ignora filtros de data e slot")
    print("═══════════════════════════════════════════════════════════")

    try:
        CONFIG.require_clickup()
        tiktok_list = _tiktok_list_id()
    except RuntimeError as e:
        print(f"❌ {e}")
        return 2

    if not CONFIG.dry_run:
        try:
            CONFIG.require_tiktok()
            from agente import tiktok
            who = tiktok.whoami()
            print(f"🎵 TikTok ativo: {who.get('display_name', '?')} open_id={who.get('open_id', '?')}")
        except Exception as e:  # noqa: BLE001
            print(f"❌ DRY_RUN=0 mas TikTok não está pronto (token/app): {e}")
            return 2

    try:
        with Lock():
            try:
                if args.task_id:
                    tasks = [clickup.get_task(args.task_id)]
                    print(f"\n📋 1 task por --task-id: «{tasks[0].name}» status={tasks[0].status}")
                else:
                    tasks = clickup.list_approved_tasks(tiktok_list)
                    print(f"\n📋 {len(tasks)} task(s) aprovada(s) na lista TikTok ({tiktok_list})")
            except Exception as e:  # noqa: BLE001
                print(f"❌ ClickUp falhou: {e}")
                return 1

            ready = skipped = not_video = errors = published = failed = 0
            for t in tasks:
                try:
                    plan = ig_main.plan_task(t, force_now=args.force_now)
                    if args.caption_override and args.task_id:
                        plan.legenda_text = args.caption_override
                        plan.legenda_empty = False
                        plan.legenda_source = "doc"
                except Exception as e:  # noqa: BLE001
                    print(f"\n── Task {t.id} «{t.name}»\n   ❌ exceção: {e}")
                    traceback.print_exc()
                    errors += 1
                    continue

                ok, motivo = tiktok_ready(plan, mode)
                print(f"\n── Task {t.id} «{t.name}»")
                print(f"   mês={plan.mes or '?'} turbo={plan.turbo_slug or '—'} "
                      f"tipo={plan.tipo_post or '—'} assets={plan.asset_count}")
                if not ok:
                    if plan.skip_reason:
                        skipped += 1
                    elif "não suportado" in (motivo or "") or "não é vídeo" in (motivo or ""):
                        not_video += 1
                    else:
                        errors += 1
                    print(f"   ⏭  pula: {motivo}")
                    continue

                verb = "enviaria ao TikTok" if CONFIG.dry_run else "vai enviar ao TikTok"
                cap = f"{plan.legenda_len} chars" if not plan.legenda_empty else "sem legenda"
                print(f"   ▶️  {verb} como vídeo ({mode}) — legenda: {cap}")
                ready += 1
                if CONFIG.dry_run:
                    continue

                try:
                    pid = publish_tiktok(plan, mode=mode, privacy=privacy, run_id=run_id)
                    published += 1
                    print(f"   ✅ enviado: publish_id={pid}"
                          + ("  → abra o TikTok e publique o rascunho" if mode == "draft" else ""))
                except Exception as e:  # noqa: BLE001
                    failed += 1
                    print(f"   ❌ falha publicando: {type(e).__name__}: {e}")
                    try:
                        clickup_write.mark_error(plan.task_id, f"TikTok: {e}")
                    except Exception:  # noqa: BLE001
                        pass

            print("\n───────────── resumo TikTok ─────────────")
            print(f"  prontas (vídeo):        {ready}")
            if not CONFIG.dry_run:
                print(f"  enviadas com sucesso:   {published}")
                print(f"  falhas de envio:        {failed}")
            print(f"  puladas (não-vídeo):    {not_video}")
            print(f"  puladas (idempot/data): {skipped}")
            print(f"  erros:                  {errors}")
            print("──────────────────────────────────────────")
            return 0
    except LockHeld as e:
        print(f"⛔ {e}")
        return 3


if __name__ == "__main__":
    sys.exit(main())
