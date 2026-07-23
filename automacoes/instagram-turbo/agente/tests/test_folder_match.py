"""Testes do matcher pasta<->card por NOME (drive._pick_folder_for_card).
Roda com: python3 -m agente.tests.test_folder_match  (sem pytest)

Contexto: em 08/jul/2026 o publicador postou conteúdo ERRADO porque casava a
pasta pelo slug 'TURBO_<x>' da descrição, que vem podre do template (card
'Seu cliente...' com slug 'TURBO_datassazonais' -> saiu o carrossel de outro
post). O fix casa pelo NOME DO CARD contra o nome da pasta.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from agente.drive import (
    _content_key, _pick_folder_for_card, _matching_folder_names, _resolve_folder_tie,
)


def _assert(cond, msg):
    if not cond:
        print(f"  ❌ FAIL: {msg}")
        raise SystemExit(1)
    print(f"  ✅ {msg}")


# Pastas reais de 07-Julho (subpastas do mês)
JULHO = [
    "Palestrantes Creator Summit", "Post Fixado", "TURBO_ News 1",
    "TURBO_asolucao", "TURBO_datassazonais", "TURBO_porquealgumasmarcas",
    "TURBO_procurase", "TURBO_seucliente", "TURBO_storyveneza",
    "TURBO_vocevaiperder", "\xa0TURBO_os3primeirosseg",
]


def run():
    print("\n=== _content_key ===")
    _assert(_content_key("TURBO_seucliente") == "SEUCLIENTE", "tira prefixo TURBO_")
    _assert(_content_key("\xa0TURBO_os3primeirosseg") == "OS3PRIMEIROSSEG", "tira NBSP + prefixo")
    _assert(_content_key("TURBO_ News 1") == "NEWS 1", "prefixo com espaço + mantém número")
    _assert(_content_key("Seu cliente é o seu maior redator") == "SEU CLIENTE E O SEU MAIOR REDATOR",
            "card sem prefixo: só normaliza (acento/caixa)")
    _assert(_content_key("Post Fixado") == "POST FIXADO", "pasta sem prefixo TURBO_")

    print("\n=== o bug do dia 08/jul: 'Seu cliente' NÃO pode cair em datassazonais ===")
    got = _pick_folder_for_card("Seu cliente é o seu maior redator", JULHO)
    _assert(got == "TURBO_seucliente", f"casa TURBO_seucliente (veio {got!r})")
    _assert(got != "TURBO_datassazonais", "NÃO casa a pasta errada (datassazonais)")

    print("\n=== casos que o slug velho errava/quebrava ===")
    _assert(_pick_folder_for_card("Turbo News 1", JULHO) == "TURBO_ News 1",
            "'Turbo News 1' -> 'TURBO_ News 1' (nome com espaço)")
    _assert(_pick_folder_for_card("Porque algumas marcas parecem gente de verdade", JULHO)
            == "TURBO_porquealgumasmarcas", "slug truncado 'porquea' não impede match por nome")
    _assert(_pick_folder_for_card("Os 3 primeiros segundos", JULHO) == "\xa0TURBO_os3primeirosseg",
            "NBSP no nome da pasta é tolerado")

    print("\n=== não confunde números de série (Turbo News) ===")
    got5 = _pick_folder_for_card("Turbo News 5", JULHO)
    _assert(got5 is None, f"'Turbo News 5' não casa 'TURBO_ News 1' (número difere) — veio {got5!r}")

    print("\n=== casos corretos continuam corretos ===")
    _assert(_pick_folder_for_card("Datas sazonais para você aproveitar no mês de julho", JULHO)
            == "TURBO_datassazonais", "datas sazonais -> datassazonais")
    _assert(_pick_folder_for_card("Você vai perder pro Instagram de 7x1 de novo", JULHO)
            == "TURBO_vocevaiperder", "7x1 -> vocevaiperder")
    _assert(_pick_folder_for_card("Procura-se creators", JULHO) == "TURBO_procurase",
            "procura-se -> procurase")

    print("\n=== fail-safe: sem pasta e ambíguo ===")
    _assert(_pick_folder_for_card("Card que não tem pasta nenhuma no mês", JULHO) is None,
            "sem match -> None (não publica)")
    # ambiguidade: duas pastas com a MESMA chave casando o card -> None
    amb = _pick_folder_for_card("Relatorio", ["TURBO_relatorio", "relatorio"])
    _assert(amb is None, "empate de chave (2 pastas iguais) -> None (ambíguo, fail-safe)")
    # chave curta (<5) não casa à toa
    _assert(_pick_folder_for_card("Ana e o mar", ["TURBO_ana"]) is None,
            "chave curta (<5 chars) não casa")

    print("\n=== pasta duplicada: desempate por ATIVO (16/jul/2026) ===")
    test_pasta_duplicada_desempata_por_ativo()

    print("\n=== slug com palavras coladas + reordenadas (word-break, 23/jul) ===")
    # Regressão do card «Como Manu Cit está construindo um império» (post 15h15
    # não saía): pasta 'TURBO_imperiomanucit' = 'imperio'+'manu'+'cit' — palavras
    # do card coladas e em outra ordem. Igualdade/substring/subset não pegam
    # (substring exige contígua; subset vê a chave-blob como 1 token).
    JUL2 = JULHO + ["TURBO_imperiomanucit"]
    _assert(_pick_folder_for_card("(Esther) Como Manu Cit está construindo um império ", JUL2)
            == "TURBO_imperiomanucit", "word-break casa 'Manu Cit... império' → imperiomanucit")
    # Falso-positivo: card SEM essas palavras não pode cair no imperiomanucit
    _assert(_pick_folder_for_card("Datas sazonais para você aproveitar no mês de julho", JUL2)
            == "TURBO_datassazonais", "card de outro tema não é sequestrado pelo imperiomanucit")
    # Guarda de token curto: palavras <3 chars ('um','o','e') não formam match
    _assert(_pick_folder_for_card("um e o", ["TURBO_umeo"]) is None,
            "tokens <3 chars não casam por word-break")

    print("\n🎉 Todos os testes do matcher passaram.")


def test_pasta_duplicada_desempata_por_ativo():
    # Regressão do card «Marketing é...» (16/jul/2026): existiam DUAS pastas
    # 'TURBO_marketinge' no mês, uma VAZIA e uma com os 5 ativos. O código antigo
    # via empate de chave e desistia (fail-safe) → post não saía. Pior: um dict
    # por nome colapsava as duas pastas de nome idêntico numa só (a vazia vencia).
    # Agora: nomes que casam vêm TODOS; desempata por presença de ativo.

    # 1) o núcleo de nomes: duas pastas de nome idêntico → ambas voltam
    names = _matching_folder_names("Marketing é...", ["TURBO_marketinge", "TURBO_marketinge"])
    _assert(names == ["TURBO_marketinge", "TURBO_marketinge"],
            f"nomes idênticos casam AMBOS (veio {names!r})")

    # 2) desempate PURO por ativo (has_assets injetado; sem Drive)
    class F:  # stand-in de DriveFile
        def __init__(self, id, empty): self.id, self.empty = id, empty
    vazia, cheia = F("VAZIA", True), F("CHEIA", False)
    has_assets = lambda f: not f.empty

    got = _resolve_folder_tie([vazia, cheia], has_assets)
    _assert(got is cheia, "duas pastas, uma vazia + uma cheia → escolhe a CHEIA")
    got2 = _resolve_folder_tie([cheia], has_assets)
    _assert(got2 is cheia, "uma pasta só → ela (mesmo caminho)")
    _assert(_resolve_folder_tie([], has_assets) is None, "nenhuma → None")

    # 3) fail-safe preservado: 2+ com conteúdo → ambíguo de verdade → None
    cheia2 = F("CHEIA2", False)
    _assert(_resolve_folder_tie([cheia, cheia2], has_assets) is None,
            "2 pastas COM conteúdo → ambíguo real → None (não chuta)")
    # todas vazias → None (nada pra postar)
    vazia2 = F("VAZIA2", True)
    _assert(_resolve_folder_tie([vazia, vazia2], has_assets) is None,
            "todas vazias → None")


def test_folder_match_por_nome():
    """Wrapper pro pytest coletar (run() usa _assert -> SystemExit em falha)."""
    run()


if __name__ == "__main__":
    run()
