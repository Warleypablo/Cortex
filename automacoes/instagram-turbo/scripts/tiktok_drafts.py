#!/usr/bin/env python3
"""
Sobe REELS (1 vídeo = post inteiro) pros rascunhos/inbox do TikTok, em lote.

Por quê um script à parte: o main.py é só Instagram e filtra por Data=hoje.
Aqui a gente varre uma pasta de mês no Drive, pega só os posts que são REELS
(classify_assets == 'reels'), e sobe cada vídeo como rascunho (scope
video.upload, sem auditoria). A pessoa abre o app e publica com 1 toque.

Pegadinhas tratadas:
  - Limite anti-spam do TikTok: depois de ~5 rascunhos PENDENTES, inbox/init
    devolve 'spam_risk_too_many_pending_share'. O script PARA nesse erro e
    avisa — é só publicar os rascunhos no app e rodar de novo.
  - Idempotência: registra cada file_id subido em .cache/tiktok_uploads.json
    e pula o que já foi (não existe outra forma de saber o que já está no
    rascunho — a API não lista a inbox).

Uso:
    DRY_RUN=1 python3 scripts/tiktok_drafts.py --mes "06 - Junho"          # plano
    DRY_RUN=0 python3 scripts/tiktok_drafts.py --mes "06 - Junho" --max 5  # sobe
    DRY_RUN=0 python3 scripts/tiktok_drafts.py --mes "06 - Junho" --mes "05 - Maio"
"""
from __future__ import annotations
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agente import drive, tiktok          # noqa: E402
from agente.config import CONFIG, PROJECT_ROOT  # noqa: E402

# id das pastas de mês na raiz "01 - Criativos" (estável)
MES_FOLDERS = {
    "06 - Junho": "1ENeVovfGXFNZyKBiGHXgUgeqPEvgxMsp",
    "05 - Maio":  "1PI6gd6pythPwAJzkONkmuFyWtzbhnrPn",
}

_TRACK = PROJECT_ROOT / ".cache" / "tiktok_uploads.json"
_SPAM = "spam_risk_too_many_pending_share"


def _human(n: int | None) -> str:
    if n is None:
        return "?"
    x = float(n)
    for u in ("B", "KB", "MB", "GB"):
        if x < 1024:
            return f"{x:.0f}{u}"
        x /= 1024
    return f"{x:.1f}TB"


def _load_track() -> dict:
    if _TRACK.is_file():
        return json.loads(_TRACK.read_text(encoding="utf-8"))
    return {"uploaded": {}}


def _save_track(t: dict) -> None:
    _TRACK.parent.mkdir(parents=True, exist_ok=True)
    _TRACK.write_text(json.dumps(t, indent=2, ensure_ascii=False), encoding="utf-8")


def discover_reels(mes: str) -> list[dict]:
    """Retorna [{slug, file_id, name, size}] pros posts que são REELS no mês."""
    folder_id = MES_FOLDERS.get(mes)
    if not folder_id:
        raise SystemExit(f"mês desconhecido: {mes!r} (tenho {list(MES_FOLDERS)})")
    out: list[dict] = []
    subs = [f for f in drive.list_folder(folder_id) if f.mime_type.endswith("folder")]
    for sub in sorted(subs, key=lambda x: x.name):
        tipo, assets = drive.classify_assets(drive.list_folder(sub.id))
        if tipo != "reels":
            continue
        v = assets[0]
        out.append({"mes": mes, "slug": sub.name, "file_id": v.id,
                    "name": v.name, "size": v.size})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mes", action="append", required=True,
                    help="pasta de mês (repetível). ex.: --mes '06 - Junho'")
    ap.add_argument("--max", type=int, default=5,
                    help="máximo de uploads nesta rodada (default 5 = teto anti-spam)")
    args = ap.parse_args()

    track = _load_track()
    done = track["uploaded"]

    candidates: list[dict] = []
    for mes in args.mes:
        candidates.extend(discover_reels(mes))

    pending = [c for c in candidates if c["file_id"] not in done]
    skipped = [c for c in candidates if c["file_id"] in done]
    # menor primeiro: teste do limite anti-spam falha barato (download_bytes
    # carrega o arquivo ANTES do init), e os curtos sobem rápido.
    pending.sort(key=lambda c: c["size"] or 0)

    print(f"DRY_RUN={CONFIG.dry_run}   candidatos={len(candidates)}  "
          f"já subidos={len(skipped)}  a subir={len(pending)}  teto={args.max}\n")
    for c in skipped:
        print(f"  ✓ já no rascunho: {c['slug']} / {c['name']}")
    if skipped:
        print()

    if not pending:
        print("nada novo a subir.")
        return 0

    uploaded = 0
    for c in pending:
        if uploaded >= args.max:
            print(f"\n⏸  atingi o teto desta rodada ({args.max}). "
                  f"Publique os rascunhos no app e rode de novo p/ continuar.")
            break
        label = f"{c['slug']} / {c['name']} [{_human(c['size'])}]"
        if CONFIG.dry_run:
            print(f"  [dry] subiria rascunho: {label}")
            uploaded += 1
            continue
        print(f"  ⬆️  subindo rascunho: {label} ...", flush=True)
        try:
            res = tiktok.post_video_file_id(
                c["file_id"], draft=True,
                title=c["slug"].replace("TURBO_", ""),
            )
        except tiktok.TikTokError as e:
            payload = e.payload if isinstance(e.payload, dict) else {}
            code = ((payload.get("error") or {}).get("code")
                    or (payload.get("data") or {}).get("error_code") or "")
            if _SPAM in str(e) or _SPAM in str(code):
                print(f"\n🛑 LIMITE ANTI-SPAM do TikTok: já tem rascunhos pendentes "
                      f"demais. Subi {uploaded} nesta rodada.\n"
                      f"   → Abra o TikTok, PUBLIQUE os rascunhos e rode de novo.")
                break
            print(f"  ❌ falhou: {e}")
            continue
        done[c["file_id"]] = {
            "slug": c["slug"], "name": c["name"], "mes": c["mes"],
            "publish_id": res.publish_id, "status": res.status,
        }
        _save_track(track)
        uploaded += 1
        print(f"     ✅ {res.status}  publish_id={res.publish_id}")
        time.sleep(2)  # respiro entre uploads

    print(f"\n── resumo: {uploaded} rascunho(s) nesta rodada. "
          f"Total registrado: {len(done)}.")
    if uploaded:
        print("   Abra o TikTok da Turbo → notificação de rascunho → publique 1 a 1.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
