"""
Re-publica UMA task IGNORANDO a checagem de idempotência.

Uso pontual: quando uma task já foi marcada POSTADO mas o post foi arquivado
no Instagram e queremos re-publicar de propósito (ex.: saiu no horário errado).
O fluxo normal (agente.main) pularia a task por causa do marcador
[agente:postado v1]; aqui re-hospedamos os ativos e publicamos direto.

Uso: DRY_RUN=0 python3 scripts/republish.py <task_id> <MES> <turbo_slug> <caption_file>
"""
from __future__ import annotations
import os
import sys

# Garante que o root do projeto está no path (script vive em scripts/).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agente import drive, rehost, instagram, clickup_write
from agente.config import CONFIG


def main() -> int:
    if len(sys.argv) != 5:
        print("uso: republish.py <task_id> <MES> <turbo_slug> <caption_file>")
        return 2
    task_id, mes, slug, caption_file = sys.argv[1:5]

    caption = open(caption_file, encoding="utf-8").read().strip()
    print(f"task={task_id} mes={mes} slug={slug} caption={len(caption)} chars dry_run={CONFIG.dry_run}")

    mes_folder = drive.resolve_mes_drive_folder(mes)
    if not mes_folder:
        print(f"❌ pasta do mês {mes} não encontrada"); return 1
    post = drive.find_post_folder(mes_folder.id, slug)
    if not post:
        print(f"❌ pasta {slug} não encontrada"); return 1
    tipo, assets = drive.classify_assets(drive.list_folder(post.id))
    print(f"tipo={tipo} assets={[a.name for a in assets]}")
    if tipo == "empty":
        print("❌ sem mídia"); return 1

    urls = [rehost.rehost_file_id(a.id, mime=a.mime_type, filename=a.name) for a in assets]
    if tipo == "single":
        res = instagram.publish_single(urls[0], caption)
    elif tipo == "reels":
        res = instagram.publish_reel(urls[0], caption)
    else:  # carousel
        types = ["video" if a.mime_type.startswith("video/") else "image" for a in assets]
        res = instagram.publish_carousel(urls, caption, item_types=types)

    print(f"✅ media_id={res.ig_media_id}")
    if res.permalink:
        print(f"   {res.permalink}")
    if not CONFIG.dry_run:
        # status já é 'postado'; deixa só um comentário informativo do re-post
        clickup_write.create_comment(
            task_id, f"♻️ Re-publicado pelo agente. {res.permalink or res.ig_media_id}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
