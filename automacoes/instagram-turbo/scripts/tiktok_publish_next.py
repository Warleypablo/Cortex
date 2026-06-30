#!/usr/bin/env python3
"""
Sobe pro rascunho/inbox do TikTok UM Reel por vez, do MAIS ANTIGO ao mais
recente, puxando o vídeo direto do Instagram (fonte = a própria conta IG, via
Graph API `media_url`). Assim a ordem cronológica é exata e o operador mantém
só 1 rascunho pendente por vez (mais fácil de organizar a publicação).

Por quê puxar do IG e não do Drive: nem todo vídeo postado no IG tem pasta
original no Drive, e cruzar Drive↔data é frágil. A lista do IG é a verdade
cronológica. Custo: o vídeo vem recomprimido pelo IG (qualidade um pouco menor).

Fila persistida em .cache/tiktok_maio_queue.json (construída na 1ª execução).
Idempotência: cada item subido fica marcado uploaded=true e não sobe de novo.

ATENÇÃO ao limite anti-spam do TikTok: ~5 rascunhos PENDENTES → inbox/init
recusa com 'spam_risk_too_many_pending_share'. Como aqui é 1 por vez, basta
o operador publicar/descartar o rascunho atual antes de rodar de novo.

Uso:
    python3 scripts/tiktok_publish_next.py --list            # só lista a fila
    DRY_RUN=1 python3 scripts/tiktok_publish_next.py         # plano (não sobe)
    DRY_RUN=0 python3 scripts/tiktok_publish_next.py         # sobe o próximo
    python3 scripts/tiktok_publish_next.py --rebuild         # refaz a fila do IG
"""
from __future__ import annotations
import argparse
import json
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agente import instagram, tiktok          # noqa: E402
from agente.instagram import _graph            # noqa: E402
from agente.config import CONFIG, PROJECT_ROOT  # noqa: E402

_QUEUE = PROJECT_ROOT / ".cache" / "tiktok_maio_queue.json"
_SP = ZoneInfo("America/Sao_Paulo")
_YEAR, _MONTH = 2026, 5  # maio/2026


def _fetch_month_videos() -> list[dict]:
    """Reels (media_type=VIDEO) postados no mês alvo, do mais antigo ao recente."""
    out: list[dict] = []
    after = None
    stop = False
    for _ in range(40):
        if stop:
            break
        params = {"fields": "id,media_type,timestamp,permalink,caption", "limit": 50}
        if after:
            params["after"] = after
        r = _graph("GET", f"/{CONFIG.ig_business_account_id}/media", params)
        data = r.get("data", [])
        if not data:
            break
        for m in data:
            dt = datetime.strptime(m["timestamp"], "%Y-%m-%dT%H:%M:%S%z").astimezone(_SP)
            if dt.year == _YEAR and dt.month == _MONTH and m.get("media_type") == "VIDEO":
                cap = (m.get("caption") or "").strip().splitlines()
                out.append({
                    "date": dt.strftime("%Y-%m-%d %H:%M"),
                    "media_id": m["id"],
                    "permalink": m.get("permalink"),
                    "caption_line": (cap[0].strip() if cap else ""),
                    "uploaded": False,
                    "publish_id": None,
                })
            if dt.year < _YEAR or (dt.year == _YEAR and dt.month < _MONTH):
                stop = True
        after = ((r.get("paging") or {}).get("cursors") or {}).get("after")
        if not after:
            break
    out.sort(key=lambda x: x["date"])  # mais antigo primeiro
    return out


def _load_queue(rebuild: bool = False) -> dict:
    if _QUEUE.is_file() and not rebuild:
        return json.loads(_QUEUE.read_text(encoding="utf-8"))
    q = {"month": f"{_YEAR}-{_MONTH:02d}", "items": _fetch_month_videos()}
    _save_queue(q)
    return q


def _save_queue(q: dict) -> None:
    _QUEUE.parent.mkdir(parents=True, exist_ok=True)
    _QUEUE.write_text(json.dumps(q, indent=2, ensure_ascii=False), encoding="utf-8")


def _fresh_media_url(media_id: str) -> str:
    """media_url do IG é assinado e EXPIRA — busca na hora do upload."""
    r = _graph("GET", f"/{media_id}", {"fields": "media_url"})
    url = r.get("media_url")
    if not url:
        raise SystemExit(f"sem media_url para {media_id}")
    return url


def _print_queue(q: dict) -> None:
    items = q["items"]
    done = sum(1 for it in items if it["uploaded"])
    print(f"Fila TikTok (maio) — {len(items)} vídeos | já subidos: {done} | faltam: {len(items)-done}\n")
    for i, it in enumerate(items, 1):
        mark = "✅" if it["uploaded"] else "  "
        d = it["date"][5:10].replace("-", "/")  # MM/DD -> dia
        print(f" {mark} {i:>2}. {d}  {it['caption_line'][:64]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true", help="só lista a fila")
    ap.add_argument("--rebuild", action="store_true", help="refaz a fila a partir do IG")
    args = ap.parse_args()

    q = _load_queue(rebuild=args.rebuild)

    if args.list or args.rebuild:
        _print_queue(q)
        if args.list:
            return 0

    nxt = next((it for it in q["items"] if not it["uploaded"]), None)
    if not nxt:
        print("🎉 fila vazia — todos os vídeos de maio já foram pro rascunho.")
        return 0

    label = f"{nxt['date']}  «{nxt['caption_line'][:60]}»"
    if CONFIG.dry_run:
        print(f"\n[dry] próximo a subir: {label}\n  {nxt['permalink']}")
        return 0

    print(f"\n⬆️  baixando do IG e subindo rascunho: {label}", flush=True)
    url = _fresh_media_url(nxt["media_id"])
    with urllib.request.urlopen(url, timeout=120) as resp:
        data = resp.read()
    print(f"   baixado {len(data)/1024/1024:.1f}MB do IG, enviando ao TikTok...", flush=True)
    try:
        res = tiktok.post_video_bytes(data, draft=True, title=nxt["caption_line"][:150])
    except tiktok.TikTokError as e:
        if "spam_risk_too_many_pending_share" in str(e):
            print("\n🛑 LIMITE ANTI-SPAM: ainda há rascunho(s) pendente(s) no TikTok.\n"
                  "   → Publique/descarte o rascunho atual no app e rode de novo.")
            return 3
        print(f"  ❌ falhou: {e}")
        return 1

    nxt["uploaded"] = True
    nxt["publish_id"] = res.publish_id
    _save_queue(q)
    done = sum(1 for it in q["items"] if it["uploaded"])
    print(f"   ✅ {res.status}  publish_id={res.publish_id}")
    print(f"\n── {done}/{len(q['items'])} no rascunho. "
          f"Publique este no app; depois rode de novo p/ o próximo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
