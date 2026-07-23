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
    SEP = f"{WJ}\n{WJ}\n"  # linha em branco guardada (o formato que o IG exibe certo)
    print("\n=== _ig_safe_caption ===")
    _assert(_IG_LINE_BREAK_GUARD == WJ, "guard é o WORD JOINER U+2060")

    # Regressão do post achatado (22/07): reproduz o padrão do post manual da Turbo
    # (17/jul) que exibe certo — parágrafos separados por LINHA EM BRANCO GUARDADA.
    _assert(
        _ig_safe_caption("Com quem...2026?\n\nAproveite...") == f"Com quem...2026?{SEP}Aproveite...",
        "reproduz o padrão do post 17/jul (2 parágrafos, \\n\\n)",
    )
    # Regressão do "Como fazer conteúdos" (23/07): o Doc veio com \n SIMPLES entre
    # os parágrafos (1 Enter), então saía grudado mesmo com guard. Agora cada quebra
    # do Doc vira linha em branco guardada → parágrafos separados no IG.
    _assert(
        _ig_safe_caption("Criatividade é estratégia.\nQuando você domina, vira processo.\nComente SOCIAL MEDIA. #turbopartners")
        == f"Criatividade é estratégia.{SEP}Quando você domina, vira processo.{SEP}Comente SOCIAL MEDIA. #turbopartners",
        "\\n simples do Doc vira linha em branco guardada (separa os parágrafos)",
    )
    # Runs de quebras (\n, \n\n, \n\n\n) → sempre 1 separação de parágrafo
    _assert(_ig_safe_caption("a\n\n\nb") == f"a{SEP}b", "3+ quebras → 1 separação")
    # Guardas
    _assert(_ig_safe_caption("") == "", "legenda vazia → vazia")
    _assert(_ig_safe_caption("linha única") == "linha única", "sem quebra → inalterada")
    # Só invisível: removendo o guard, o texto visível é o mesmo (parágrafos por \n\n)
    out = _ig_safe_caption("linha1\nlinha2")
    _assert(out.replace(WJ, "") == "linha1\n\nlinha2", "sem os guards = parágrafos separados por linha em branco")

    print("\n🎉 Todos os testes passaram.")


if __name__ == "__main__":
    run()
