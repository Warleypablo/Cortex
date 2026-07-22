"""
Testes do guard de quebra de linha da legenda (_ig_safe_caption).
Roda com: python3 -m agente.tests.test_caption
(não depende de pytest)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from agente.instagram import _ig_safe_caption, _IG_LINE_BREAK_GUARD

WJ = "⁠"  # WORD JOINER


def _assert(cond: bool, msg: str):
    if not cond:
        print(f"  ❌ FAIL: {msg}")
        raise SystemExit(1)
    print(f"  ✅ {msg}")


def run():
    print("\n=== _ig_safe_caption ===")
    _assert(_IG_LINE_BREAK_GUARD == WJ, "guard é o WORD JOINER U+2060")

    # Regressão do post achatado (22/07/2026): o IG colapsa \n\n na exibição — os
    # parágrafos saem grudados mesmo o caption tendo as quebras. Prepender U+2060
    # a cada \n (padrão confirmado no post manual da Turbo de 17/jul que exibe
    # certo) faz o IG preservar TODAS as quebras, inclusive as linhas em branco.
    _assert(
        _ig_safe_caption("Com quem...2026?\n\nAproveite...") == f"Com quem...2026?{WJ}\n{WJ}\nAproveite...",
        "reproduz o padrão do post 17/jul (2 parágrafos)",
    )
    _assert(
        _ig_safe_caption("a\nb\n\nc") == f"a{WJ}\nb{WJ}\n{WJ}\nc",
        "cada \\n ganha 1 guard (linha em branco fica protegida)",
    )
    # Guardas
    _assert(_ig_safe_caption("") == "", "legenda vazia → vazia")
    _assert(_ig_safe_caption("linha única") == "linha única", "sem quebra → inalterada")

    # O guard é invisível/zero-width: não altera o texto visível, só as quebras.
    out = _ig_safe_caption("linha1\nlinha2")
    _assert(out.replace(WJ, "") == "linha1\nlinha2", "removendo o guard volta ao original (é só invisível)")

    print("\n🎉 Todos os testes passaram.")


if __name__ == "__main__":
    run()
