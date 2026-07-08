"""Ordem de slides do carrossel (drive._slide_sort_key via classify_assets).
Roda com: python3 -m agente.tests.test_slide_sort  (sem pytest)

Regressão do 7x1 (07/jul/2026): arquivos '... 7x1 1.png' … '10.png' — o '7' do
tema no MEIO do nome era pego como índice do slide, todos empatavam e caíam em
ordem alfabética (1,10,2,3…), então o slide 10 saía como 2ª imagem. O fix pega
o número IMEDIATAMENTE antes da extensão.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from agente.drive import DriveFile, classify_assets


def _img(name):
    return DriveFile(id=name, name=name, mime_type="image/png", parent_id=None, size=1)


def _assert(cond, msg):
    if not cond:
        print(f"  ❌ FAIL: {msg}")
        raise SystemExit(1)
    print(f"  ✅ {msg}")


def run():
    print("\n=== 7x1: número no MEIO não sequestra a ordem ===")
    files = [_img(f"Você vai perder de 7x1 {i}.png") for i in [3, 10, 1, 7, 2, 9, 4, 6, 5, 8]]
    tipo, ordered = classify_assets(files)
    nums = [o.name for o in ordered]
    _assert(tipo == "carousel", "10 imagens -> carousel")
    esperado = [f"Você vai perder de 7x1 {i}.png" for i in range(1, 11)]
    _assert(nums == esperado, f"ordem 1..10 (não 1,10,2,3…) — veio {[n.split()[-1] for n in nums]}")

    print("\n=== '07- N.png' (news de hoje) ordena 1..7 ===")
    files = [_img(f"07- {i}.png") for i in [7, 3, 2, 4, 5, 6, 1]]
    _, ordered = classify_assets(files)
    _assert([o.name for o in ordered] == [f"07- {i}.png" for i in range(1, 8)], "ordem 1..7")

    print("\n🎉 Ordem de slides ok.")


def test_slide_sort():
    run()


if __name__ == "__main__":
    run()
