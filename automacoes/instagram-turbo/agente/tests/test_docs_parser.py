"""
Testes do parser do Doc mestre.
Roda com: python3 -m agente.tests.test_docs_parser
(não depende de pytest)
"""
import sys
from pathlib import Path

# permite rodar como script direto
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from agente.docs_parser import parse_doc, find_legenda_for_task, _normalize


FIXTURE = r"""# SOCIAL MEDIA TURBO \[ABRIL\]

 **SOCIAL MEDIA TURBO \[ABRIL\]**

**RECORDE NEYMAR**

**IMG 1**

Neymar bateu recorde de R$200 mil no TikTok Shop.

**IMG 8**

O TikTok pode ser o canal que estava faltando para você escalar suas vendas.

**LEGENDA**

R$200 mil em uma hora, sem anúncio, sem varejista e com conversão dez vezes acima do e-commerce tradicional.

O Neymar não usou fama. Usou estrutura e canal certo no momento certo.

Comenta "QUERO" se quiser estruturar isso na sua marca.

**E SE A GENTE SE MUDASSE**

**LEGENDA**

E se a gente se mudasse…?

Pra um espaço maior, com mais estrutura, metas mais desafiadoras…

**TREND FOUNDERS**

https://www.instagram.com/p/DVTvBDvkYjW/

Quem é mais provável de chegar atrasado na empresa?

**LEGENDA**

Quem é mais provável? rsss #turbopartners

**CONTENT MKT**

**LEGENDA**

**DIA DO FRETE GRÁTIS/BEIJO/CAFÉ/AMIGO E ETC**

**IMG 1**

Se você só usa a Black Friday pra vender mais…

**LEGENDA**

Se você só lembra de vender em datas grandes… você está ignorando oportunidades todos os meses.

**NÃO BASTA EMPREENDER**

**IMG 1**

Não basta só empreender, você tem que virar "blogueirinho"

**LEGENDA**

O problema nunca foi "aparecer". É aparecer sem estratégia. #turbopartners
"""


def _assert(cond: bool, msg: str):
    if not cond:
        print(f"  ❌ FAIL: {msg}")
        raise SystemExit(1)
    print(f"  ✅ {msg}")


def run():
    print("\n=== parse_doc ===")
    sections = parse_doc(FIXTURE)
    headers = [s.header for s in sections]
    print(f"  headers encontrados: {headers}")
    expected = [
        "RECORDE NEYMAR",
        "E SE A GENTE SE MUDASSE",
        "TREND FOUNDERS",
        "CONTENT MKT",
        "DIA DO FRETE GRÁTIS/BEIJO/CAFÉ/AMIGO E ETC",
        "NÃO BASTA EMPREENDER",
    ]
    _assert(headers == expected, f"headers esperados: {expected}")

    # RECORDE NEYMAR tem legenda longa
    neymar = sections[0]
    _assert(neymar.has_marker, "RECORDE NEYMAR tem marker **LEGENDA**")
    _assert("R$200 mil em uma hora" in neymar.legenda, "legenda começa com R$200 mil")
    _assert("Comenta" in neymar.legenda, "legenda termina com Comenta")
    _assert("**LEGENDA**" not in neymar.legenda, "legenda limpa de asteriscos")

    # CONTENT MKT tem marker mas legenda vazia
    content_mkt = sections[3]
    _assert(content_mkt.has_marker, "CONTENT MKT tem marker")
    _assert(content_mkt.legenda == "", "CONTENT MKT tem legenda vazia")

    print("\n=== find_legenda_for_task ===")
    # Match exato
    leg, hdr = find_legenda_for_task(FIXTURE, "Não basta empreender")
    _assert(hdr == "NÃO BASTA EMPREENDER", "match 'Não basta empreender' → 'NÃO BASTA EMPREENDER'")
    _assert("aparecer sem estratégia" in leg, "legenda contém texto esperado")

    # Case-insensitive
    leg, hdr = find_legenda_for_task(FIXTURE, "RECORDE NEYMAR")
    _assert(hdr == "RECORDE NEYMAR", "match case-insensitive")

    # Sem acentos na task name, com acentos no header
    leg, hdr = find_legenda_for_task(FIXTURE, "Nao basta empreender")
    _assert(hdr == "NÃO BASTA EMPREENDER", "match ignora acentos")

    # Content MKT → marker presente, legenda vazia
    leg, hdr = find_legenda_for_task(FIXTURE, "Content MKT")
    _assert(hdr == "CONTENT MKT", "CONTENT MKT header matched")
    _assert(leg == "", "legenda vazia → string vazia")

    # Task sem match
    leg, hdr = find_legenda_for_task(FIXTURE, "task inexistente qualquer")
    _assert(hdr is None, "task inexistente → hdr None")
    _assert(leg == "", "task inexistente → legenda vazia")

    # Normalização de caracteres especiais
    _assert(_normalize("Não Basta Empreender!") == "NAO BASTA EMPREENDER", "normalize remove acentos + pontuação")
    _assert(_normalize("DIA DO FRETE GRÁTIS/BEIJO/CAFÉ") == "DIA DO FRETE GRATISBEIJOCAFE", "normalize com barras")

    # Tolerância a espaçamento: título "ES TÁ" casa com header "ESTÁ" (caso real do Creator Summit)
    _mini = (
        "**O MAIOR EVENTO DO ESTÁ CHEGANDO**\n"
        "**LEGENDA**\n"
        "Vem aí o Creator Summit! 🚀\n"
        "**PRÓXIMO POST**\n"
    )
    leg, hdr = find_legenda_for_task(_mini, "O MAIOR EVENTO DO ES TÁ CHEGANDO")
    _assert(hdr == "O MAIOR EVENTO DO ESTÁ CHEGANDO", "match tolera diferença de espaço (ES TÁ vs ESTÁ)")
    _assert("Creator Summit" in leg, "legenda do header com typo de espaço veio certa")

    print("\n=== formatação da legenda ===")
    test_legenda_preserva_paragrafos()

    print("\n🎉 Todos os testes passaram.")


def test_legenda_preserva_paragrafos():
    # Regressão do post de 06/jul/2026 ("Datas sazonais"): o Doc TINHA linha em
    # branco entre os parágrafos e a legenda subiu achatada pro Instagram.
    # Linha em branco = separação de parágrafo → tem que chegar intacta no IG.
    doc = (
        "**DATAS SAZONAIS**\n"
        "**LEGENDA**\n"
        "Já hora de planejar? Oi? 👀 \n"
        "\n"
        "Aqui estão as principais datas.\n"
        "\n"
        "\n"
        "\n"
        "----\n"
        'Comente "CALENDARIO"\x0bno direct. #turbopartners\n'
        "**PRÓXIMO POST**\n"
    )
    leg, hdr = find_legenda_for_task(doc, "Datas sazonais")
    _assert(hdr == "DATAS SAZONAIS", "header casou")
    esperado = (
        "Já hora de planejar? Oi? 👀\n"
        "\n"
        "Aqui estão as principais datas.\n"
        "\n"
        'Comente "CALENDARIO"\nno direct. #turbopartners'
    )
    _assert(
        leg == esperado,
        f"parágrafo preservado, 3+ quebras colapsam, ruído (----) fora, "
        f"\\x0b vira quebra, espaço no fim de linha some — veio: {leg!r}",
    )


def test_placeholder_bold_nao_corta_secao():
    # Regressão do post de 06/jul/2026 ("Cases de sucesso da nossa agência"):
    # placeholders de métrica em bold UPPER no slide 5 (**XPTO**, **LTV**)
    # viravam header de post e cortavam a seção ANTES do **LEGENDA** — o
    # worker via legenda vazia e recusou publicar às 18h. Bold no meio dos
    # slides de um post ainda aberto (IMG visto, LEGENDA não) não é header.
    doc = (
        "**CASES DE SUCESSO DA NOSSA AGÊNCIA**\n"
        "\n"
        "**IMG 1**\n"
        "\n"
        "CASE DE SUCESSO \n"
        "\n"
        "Haux\n"
        "\n"
        "**IMG 5**\n"
        "\n"
        "**XPTO**\n"
        "**XPTO ROAS**\n"
        "**LTV**\n"
        "\n"
        "Esse crescimento não veio do acaso.\n"
        "\n"
        "**IMG 6**\n"
        "\n"
        "Clique no **Link da Bio** e fale com um de nossos especialistas.\n"
        "\n"
        "**LEGENDA**\n"
        "Antes de aumentar as vendas, foi preciso mudar a percepção da marca.\n"
        "\n"
        "Se a sua marca está pronta, fala com a gente. #turbopartners\n"
        "\n"
        "**PRÓXIMO POST QUALQUER**\n"
        "**LEGENDA**\n"
        "Legenda do post seguinte.\n"
    )
    leg, hdr = find_legenda_for_task(doc, "Cases de sucesso da nossa agência")
    _assert(hdr == "CASES DE SUCESSO DA NOSSA AGÊNCIA", "header do card casou")
    _assert("Antes de aumentar as vendas" in leg, "legenda achada apesar dos placeholders bold")
    _assert("Legenda do post seguinte" not in leg, "legenda não vaza pro post seguinte")

    # Depois do **LEGENDA** o post "fecha": o próximo bold UPPER volta a ser header
    leg2, hdr2 = find_legenda_for_task(doc, "Próximo post qualquer")
    _assert(hdr2 == "PRÓXIMO POST QUALQUER", "post seguinte continua sendo seção própria")
    _assert(leg2 == "Legenda do post seguinte.", "legenda do post seguinte intacta")

    # Post SEM slide interno (sem IMG/CENA) seguido de outro post: split normal,
    # a demoção só vale dentro de conteúdo de slide.
    doc2 = (
        "**POST SEM LEGENDA**\n"
        "anotação solta\n"
        "**OUTRO POST**\n"
        "**LEGENDA**\n"
        "Legenda do outro post.\n"
    )
    leg3, hdr3 = find_legenda_for_task(doc2, "Post sem legenda")
    _assert(hdr3 == "POST SEM LEGENDA", "post sem legenda ainda é seção")
    _assert(leg3 == "", "post sem legenda não rouba a legenda do vizinho")


if __name__ == "__main__":
    run()
    test_legenda_preserva_paragrafos()
    test_placeholder_bold_nao_corta_secao()
