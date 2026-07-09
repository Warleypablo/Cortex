"""Filtro de stories no carrossel de feed (drive._is_story_asset / classify_assets).
Roda com: python3 -m agente.tests.test_story_filter

Caso real 09/jul/2026: pasta 'TURBO_asolucao' com 7 slides de feed
('A SOLUÇÃO N.png') + 7 de stories ('A SOLUÇÃO - stories N.png') = 14 assets
intercalados, acima do limite de 10 do IG. Stories vão manualmente pro Stories,
então o feed ignora.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from agente.drive import DriveFile, classify_assets, _is_story_asset


def _img(name):
    return DriveFile(id=name, name=name, mime_type="image/png", parent_id=None, size=1)


def _assert(cond, msg):
    if not cond:
        print(f"  ❌ FAIL: {msg}")
        raise SystemExit(1)
    print(f"  ✅ {msg}")


def run():
    print("\n=== _is_story_asset: pega stories, não pega palavra com 'stor' no meio ===")
    _assert(_is_story_asset("A SOLUÇÃO - stories 3.png"), "'- stories 3' é story")
    _assert(_is_story_asset("capa story.png"), "'story' é story")
    _assert(_is_story_asset("post-stories-1.png"), "'stories' após hífen é story")
    _assert(not _is_story_asset("A SOLUÇÃO 3.png"), "slide de feed não é story")
    _assert(not _is_story_asset("nossa história 2.png"), "'história' NÃO é story (stor no meio)")
    _assert(not _is_story_asset("storytelling 1.png"), "'storytelling' NÃO é story (palavra colada)")

    print("\n=== classify_assets ignora stories e mantém só o feed em ordem ===")
    files = []
    for i in range(1, 8):
        files.append(_img(f"A SOLUÇÃO {i}.png"))
        files.append(_img(f"A SOLUÇÃO - stories {i}.png"))
    tipo, assets = classify_assets(files)
    _assert(tipo == "carousel", "7 slides de feed -> carousel")
    _assert(len(assets) == 7, f"só 7 (stories fora) — veio {len(assets)}")
    _assert([a.name for a in assets] == [f"A SOLUÇÃO {i}.png" for i in range(1, 8)],
            "ordem 1..7, sem nenhum 'stories'")
    _assert(not any("stories" in a.name for a in assets), "nenhum asset de stories no feed")

    print("\n=== pasta só de stories -> vazia (não publica no feed) ===")
    tipo2, assets2 = classify_assets([_img(f"x - stories {i}.png") for i in range(1, 4)])
    _assert(tipo2 == "empty" and assets2 == [], "só stories -> empty (fail-safe)")

    print("\n🎉 Filtro de stories ok.")


def test_story_filter():
    run()


if __name__ == "__main__":
    run()
