#!/usr/bin/env python3
"""
Publica UMA task cuja pasta no Drive NÃO segue o padrão TURBO_<slug>
(ex.: designer subiu como "Turbo News 3" em vez de "TURBO_turbonews3"),
apontando a pasta pelo NOME exato dentro do mês.

Reusa o execute_plan testado (re-host → publish_carousel → mark_posted),
montando um PlannedAction à mão com os assets já resolvidos.

Uso:
  DRY_RUN=0 python3 scripts/publish_by_folder.py \
      --task-id <id> --mes JUNHO --folder-name "Turbo News 3" \
      --caption-file .cache/turbonews3_caption.txt [--slug TURBO_turbonews3]

Idempotência: execute_plan chama mark_posted ao final. Rode UMA vez.
"""
from __future__ import annotations
import argparse
import sys
import uuid


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--task-id", required=True)
    ap.add_argument("--mes", required=True, help="mês em maiúsculo, ex.: JUNHO")
    ap.add_argument("--folder-name", required=True, help="nome exato da pasta no Drive")
    ap.add_argument("--caption-file", required=True)
    ap.add_argument("--slug", default="", help="só rótulo/log; a pasta é achada pelo nome")
    args = ap.parse_args()

    from agente import drive, instagram, clickup
    from agente.main import PlannedAction, execute_plan

    with open(args.caption_file, encoding="utf-8") as fh:
        caption = fh.read().rstrip("\n")
    if not caption.strip():
        print("❌ legenda vazia — abortado (Turbo nunca sobe sem legenda)")
        return 2

    # 1) identifica a conta IG ANTES de qualquer publish
    acc = instagram.verify_token()
    print(f"📸 IG ativa: @{acc.username} ({acc.name or '—'}) id={acc.id} "
          f"seguidores={acc.followers_count}")

    # 2) carrega a task só pra confirmar nome/status
    t = clickup.get_task(args.task_id)
    print(f"📋 task {t.id} «{t.name}» status={t.status}")

    # 3) resolve a pasta pelo NOME dentro do mês
    june = drive.resolve_mes_drive_folder(args.mes)
    if not june:
        print(f"❌ pasta do mês {args.mes} não encontrada no Drive")
        return 1
    files = drive.list_folder(june.id)
    target = args.folder_name.strip().lower()
    match = [f for f in files if f.name.strip().lower() == target]
    if len(match) != 1:
        print(f"❌ pasta «{args.folder_name}» ambígua/ausente: {[f.name for f in match]}")
        return 1
    folder = match[0]
    assets_all = drive.list_folder(folder.id)
    tipo, assets = drive.classify_assets(assets_all)
    print(f"📁 pasta «{folder.name}» ({folder.id}) → tipo={tipo} assets={len(assets)}")
    for a in assets:
        print(f"     {a.name} | {a.mime_type}")
    if tipo not in ("carousel", "single", "reels"):
        print(f"❌ tipo de post inválido: {tipo}")
        return 1

    plan = PlannedAction(
        task_id=t.id, task_name=t.name, parent_id=t.parent_id, mes=args.mes,
        turbo_slug=args.slug or None, formato_card=None, criativo=t.name,
        is_placeholder=False,
        tipo_post=tipo, asset_count=len(assets),
        asset_ids=[a.id for a in assets],
        asset_mimes=[a.mime_type for a in assets],
        legenda_text=caption, legenda_len=len(caption), legenda_source="doc",
        slot_now=None, drive_folder_found=True,
    )
    print(f"📝 legenda ({len(caption)} chars): {caption!r}")

    res = execute_plan(plan, run_id=uuid.uuid4().hex[:8], force_now=True)
    if res.error:
        print(f"❌ {res.error}")
        return 1
    print(f"✅ publicado: media_id={res.ig_media_id}")
    print(f"   {res.permalink}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
