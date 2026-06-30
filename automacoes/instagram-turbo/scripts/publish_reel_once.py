"""
Publica UM reel (vídeo único) de uma task, com RETRY no container do vídeo
(fetcher de mídia do Meta anda lento — ver [[meta-carousel-publish-flaky]]),
e marca POSTADO no fim. Pra posts NOVOS (não republish).

Aponta a pasta por FOLDER_ID direto (robusto: independe de slug). A legenda vem
de um arquivo (a copy desse card mora num Doc à parte, fora do fluxo padrão).

DRY_RUN=1 → cria o container e espera processar (FINISHED), mas NÃO publica.
DRY_RUN=0 → publica e marca POSTADO.

_publish é o ponto perigoso: se falhar na rede, pode ter publicado mesmo assim,
então NÃO re-tento (evita duplicar) — reporto e saio != 0.

Uso: python3 scripts/publish_reel_once.py <task_id> <folder_id> <caption_file>
"""
from __future__ import annotations
import os
import sys
import time
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agente import clickup, drive, rehost, instagram, clickup_write  # noqa: E402
from agente.config import CONFIG  # noqa: E402

CONTAINER_ATTEMPTS = 15
SLEEP = 5


def main() -> int:
    if len(sys.argv) != 4:
        print("uso: publish_reel_once.py <task_id> <folder_id> <caption_file>")
        return 2
    task_id, folder_id, caption_file = sys.argv[1:4]

    caption = open(caption_file, encoding="utf-8").read().strip()
    if not caption:
        print("❌ legenda vazia — abortado (Turbo nunca sobe sem legenda)")
        return 2
    print(f"task={task_id} folder={folder_id} caption={len(caption)} chars dry_run={CONFIG.dry_run}")

    acc = instagram.verify_token()
    print(f"📸 IG: @{acc.username} ({acc.followers_count} seguidores)")

    files = drive.list_folder(folder_id)
    tipo, assets = drive.classify_assets(files)
    print(f"📁 tipo={tipo} assets={[a.name for a in assets]}")
    if tipo != "reels":
        print(f"❌ esperava reels, veio {tipo}")
        return 1
    v = assets[0]

    # 1) container do vídeo com retry (passo que sofre com a lentidão do Meta)
    container = None
    last = None
    for att in range(1, CONTAINER_ATTEMPTS + 1):
        try:
            url = rehost.rehost_file_id(v.id, mime=v.mime_type, filename=v.name)
            t0 = time.time()
            container = instagram._create_video_container(url, caption, media_type="REELS")
            print(f"🎬 container={container}  (att {att}, {time.time()-t0:.1f}s)", flush=True)
            break
        except Exception as e:
            last = e
            print(f"   att {att}/{CONTAINER_ATTEMPTS} falhou: {type(e).__name__}: {e}", flush=True)
            time.sleep(SLEEP)
    if not container:
        print(f"❌ container do vídeo não criado em {CONTAINER_ATTEMPTS} tentativas: {last}")
        return 1

    # 2) espera o vídeo processar (FINISHED), tolerando reset de rede no polling
    for att in range(1, 6):
        try:
            instagram._wait_for_finished(container, label="reel")
            break
        except instagram.MetaError:
            raise  # ERROR/EXPIRED/timeout real do processamento — não adianta insistir
        except Exception as e:
            print(f"   wait_for_finished att {att} erro de rede: {type(e).__name__} — re-tentando")
            time.sleep(SLEEP)

    if CONFIG.dry_run:
        print(f"⚠️  DRY-RUN — container pronto e NÃO publicado: {container}")
        return 0

    # 3) publish (blindado contra re-tentativa cega)
    try:
        media_id = instagram._publish(container)
    except Exception as e:
        print(f"\n⚠️  _publish falhou na rede: {type(e).__name__}: {e}")
        print("    Pode ter publicado mesmo assim. NÃO re-tento (risco de duplicar).")
        print(f"    → cheque o feed @{acc.username}; container pronto = {container}")
        return 1
    permalink = instagram.get_permalink(media_id)
    print(f"\n✅ PUBLICADO  media_id={media_id}")
    if permalink:
        print(f"   {permalink}")

    # 4) marca POSTADO (com retry — o marker é o que evita repost futuro)
    for att in range(1, 6):
        try:
            clickup_write.mark_posted(task_id, media_id, permalink, "reels", run_id=uuid.uuid4().hex[:8])
            print("   ✅ ClickUp marcado POSTADO")
            break
        except Exception as e:
            print(f"   mark_posted att {att} falhou: {e}")
            time.sleep(SLEEP)
    else:
        print(f"   🛑 POSTOU mas NÃO marcou ClickUp! Marcar manualmente: {permalink or media_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
