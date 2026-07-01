"""
Parser do Google Docs mestre "SOCIAL MEDIA TURBO [MÊS]".

O Doc é exportado como texto (via Drive API ou MCP read_file_content) e aqui
extraímos, por task.name, a LEGENDA correspondente.

Convenções validadas empiricamente (Doc de ABRIL/JUNHO, 2026):

  **SOCIAL MEDIA TURBO [ABRIL]**     ← cabeçalho geral (ignorar)
  **RECORDE NEYMAR**                  ← TÍTULO do post (bold UPPER)
  **IMG 1**                           ← rótulo de slide (ignorar pro match)
  **O RESULTADO DISSO?**              ← subhead do post (bold UPPER, mas NÃO é
                                        um novo post — pertence ao mesmo bloco)
  ...
  **LEGENDA**                         ← MARCADOR de início da legenda do post
  <texto que vai pro IG>
  **PRÓXIMO POST**                    ← início do próximo post (fim da legenda)

Modelo de "bloco" (o ponto central deste parser)
------------------------------------------------
Cada post é um BLOCO ancorado no marcador `**LEGENDA**`:

    [título]  [subheads/IMG...]  **LEGENDA**  [legenda até o próximo título]

Uma linha em bold+UPPER NÃO é necessariamente um novo post: subheads como
"O RESULTADO DISSO?" ou "AS CAMPANHAS MAIS CRIATIVAS" aparecem ANTES do
`**LEGENDA**` do mesmo post. Se cada linha bold+UPPER virasse um post novo, a
legenda se desgrudava do título certo (bug real: card "Estratégia da Cimed na
copa do mundo" tinha a legenda no Doc mas caía no subhead "O RESULTADO DISSO?").

Por isso:
  - Um bloco cobre do fim da legenda anterior até o fim da SUA legenda.
  - TODAS as linhas bold+UPPER antes do `**LEGENDA**` do bloco são headers
    CANDIDATOS desse bloco (título + subheads).
  - No match, o nome da task é comparado contra TODOS os candidatos do bloco —
    e com tolerância a typo (overlap de tokens), porque a cardista às vezes
    digita o título com uma palavra a mais/menos que o card (ex.: Doc diz
    "CIMED DA NA COPA", card diz "CIMED NA COPA").

A exportação do Docs pode vir em markdown (preservando `**...**`) ou plain text
(sem asteriscos). Este parser aceita as duas. Também aceita o formato do
read_file_content do MCP (onde colchetes vêm escapados `\\[ABRIL\\]`).
"""
from __future__ import annotations
import re
import unicodedata
from dataclasses import dataclass, field


# Primeiras palavras que identificam headers INTERNOS de seção (não são títulos de post)
_INTERNAL_FIRST_WORDS = frozenset({
    "IMG", "LEGENDA", "TELA", "SLIDE", "CENA", "CASE",
    "HOOK", "BODY", "CTA", "STORY", "REELS", "LIVE", "CARROSSEL",
})

# Uma linha isolada "**LEGENDA**" / "LEGENDA" / "LEGENDA:" (marca o início da legenda)
_LEGENDA_LINE_RE = re.compile(r"\**\s*LEGENDA\s*:?\s*\**", re.IGNORECASE)

# Overlap mínimo de tokens (Jaccard) pra aceitar um match por similaridade quando
# não houve match exato nem por espaçamento. 0.6 é estrito o suficiente pra não
# casar títulos genéricos, mas tolera 1 palavra a mais/menos ou um typo de espaço.
_TOKEN_MATCH_THRESHOLD = 0.6


def _strip_bold(s: str) -> str:
    """Remove ** ao redor (markdown)."""
    return re.sub(r"^\*+|\*+$", "", s.strip())


def _normalize(s: str) -> str:
    """
    Normaliza pra comparação (case insensitive, remove acentos, trim, compacta espaços).
    """
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s.strip().upper())
    # remove pontuação comum que aparece em headers
    s = re.sub(r"[^\w\s]", "", s)
    return s


def _is_legenda_line(line: str) -> bool:
    """A linha é só o marcador LEGENDA (com/sem bold, com/sem `:`)."""
    return bool(_LEGENDA_LINE_RE.fullmatch(line.strip()))


def _is_post_header(line: str) -> bool:
    """
    Linha candidata a header (título OU subhead) de post:
    - Linha INTEIRA em bold (começa com `**`) — regra crítica
    - Conteúdo essencial em UPPER
    - Não é prefixo interno (IMG, LEGENDA, TELA, etc.)
    - Tem pelo menos 2 letras

    Exigir bold é essencial: textos internos de slide podem ser caps
    ("Na CIMED", "SEU TIME TEM MEDO DA CÂMERA?") sem estar em bold —
    sem essa regra, eles eram detectados como falsos headers.

    NOTA: isto detecta headers em geral (título e subheads). A distinção entre
    "título do post" e "subhead do mesmo post" é feita em parse_doc, agrupando
    por bloco de LEGENDA — não aqui.
    """
    raw = line.strip()
    if not raw:
        return False
    if not raw.startswith("**"):
        return False
    content = _strip_bold(raw)
    if not content:
        return False
    # tem que ter ao menos algumas letras maiúsculas e ser ≥85% upper
    letters = [c for c in content if c.isalpha()]
    if len(letters) < 2:
        return False
    uppers = sum(1 for c in letters if c.isupper())
    if uppers / len(letters) < 0.85:
        return False
    norm = _normalize(content)
    words = norm.split(" ") if norm else []
    first_word = words[0] if words else ""
    # Palavras como REELS/CARROSSEL/STORY são "internas" só quando aparecem
    # sozinhas (rotulam um slide). Em multi-palavra (ex: "REELS EVENTO PILEA")
    # são títulos de post legítimos.
    if first_word in _INTERNAL_FIRST_WORDS and len(words) == 1:
        return False
    # Sub-rótulos compostos tipo "STORY 1" / "REELS 2" também são internos
    if first_word in _INTERNAL_FIRST_WORDS and len(words) == 2 and re.fullmatch(r"\d+", words[1]):
        return False
    # N1/N2/N3 (news) — são headers internos de subitem
    if re.fullmatch(r"N\d+", first_word):
        return False
    return True


def _is_social_media_header(line: str) -> bool:
    """Título geral do Doc ('SOCIAL MEDIA TURBO [MÊS]') — não é um post."""
    return "SOCIAL MEDIA TURBO" in _normalize(_strip_bold(line))


def _sanitize_line_for_text(line: str) -> str:
    """Remove bold markers mantendo conteúdo."""
    return re.sub(r"\*+", "", line)


def _clean_caption(text: str) -> str:
    """Limpa a legenda: remove `*`, tira linhas só de ruído (traços/pontos), trim."""
    text = _sanitize_line_for_text(text).strip()
    text = "\n".join(
        l for l in text.splitlines()
        if l.strip() and not re.fullmatch(r"[\s\-_=·•]+", l.strip())
    ).strip()
    return text


@dataclass
class ParsedSection:
    header: str          # TÍTULO do post (primeiro candidato) — como aparece no doc (UPPER)
    header_normalized: str
    legenda: str         # texto já limpo (sem ** e trim)
    has_marker: bool     # tinha **LEGENDA**
    start_line: int      # pra debug
    headers: list[str] = field(default_factory=list)             # todos os candidatos (título + subheads)
    headers_normalized: list[str] = field(default_factory=list)  # normalizados, mesma ordem


def parse_doc(content: str) -> list[ParsedSection]:
    """
    Varre o Doc e retorna lista de ParsedSection, 1 por BLOCO de LEGENDA (= 1 post).

    Cada bloco vai do fim da legenda anterior (ou início do doc) até o fim da sua
    própria legenda. Todos os headers bold+UPPER antes do `**LEGENDA**` do bloco
    entram como candidatos (`headers`); o primeiro é o título (`header`).
    """
    # Unescape de colchetes (\[ABRIL\] → [ABRIL]) + nbsp → space
    content = content.replace("\\[", "[").replace("\\]", "]").replace("\xa0", " ")
    lines = content.splitlines()

    header_idx = [
        i for i, line in enumerate(lines)
        if _is_post_header(line) and not _is_social_media_header(line)
    ]
    marker_idx = [i for i, line in enumerate(lines) if _is_legenda_line(line)]

    sections: list[ParsedSection] = []
    prev_end = 0  # linha onde a legenda anterior terminou (início da busca por candidatos)

    for m in marker_idx:
        # fim da legenda = primeiro header depois do marcador (= título do próximo post)
        cap_end = next((h for h in header_idx if h > m), len(lines))
        # candidatos deste bloco = headers em [prev_end, m)
        cands = [h for h in header_idx if prev_end <= h < m]
        legenda = _clean_caption("\n".join(lines[m + 1:cap_end]))

        if not cands:
            # LEGENDA sem título antes (ex.: 2º **LEGENDA** dentro do mesmo post).
            # Não cria bloco novo; só avança pra não engolir o próximo.
            prev_end = cap_end
            continue

        headers_raw = [_strip_bold(lines[h].strip()) for h in cands]
        sections.append(
            ParsedSection(
                header=headers_raw[0],
                header_normalized=_normalize(headers_raw[0]),
                legenda=legenda,
                has_marker=True,
                start_line=cands[0],
                headers=headers_raw,
                headers_normalized=[_normalize(h) for h in headers_raw],
            )
        )
        prev_end = cap_end

    return sections


def _iter_candidates(sections: list[ParsedSection]):
    """Gera (section, header_normalizado, header_raw) pra cada candidato de cada bloco."""
    for s in sections:
        for hn, hr in zip(s.headers_normalized, s.headers):
            yield s, hn, hr


def find_legenda_for_task(doc_content: str, task_name: str) -> tuple[str, str | None]:
    """
    Retorna (legenda_text, matched_header).
    - legenda_text = "" se não achar bloco ou se bloco tem marker mas legenda vazia.
    - matched_header = header do doc que bateu (None se sem match).

    O nome da task é comparado contra TODOS os headers candidatos de cada bloco
    (título + subheads), em camadas de tolerância crescente:
      1. match exato (normalizado)
      2. match ignorando espaços (typo de espaço: "ES TÁ" vs "ESTÁ")
      3. overlap de tokens (typo de 1 palavra a mais/menos: "CIMED DA NA" vs "CIMED NA")
      4. substring em qualquer direção (header é abreviação do card: "GUIA RÁPIDO")
    """
    target = _normalize(task_name)
    sections = parse_doc(doc_content)
    if not target or not sections:
        return "", None

    # 1. match exato
    for s, hn, hr in _iter_candidates(sections):
        if hn == target:
            return s.legenda, hr

    # 2. match ignorando espaços (ex.: card "...DO ES TÁ CHEGANDO" vs Doc "...DO ESTÁ CHEGANDO")
    tns = target.replace(" ", "")
    for s, hn, hr in _iter_candidates(sections):
        if hn.replace(" ", "") == tns:
            return s.legenda, hr

    # 3. overlap de tokens (Jaccard). Pega o melhor acima do threshold — tolera
    #    palavra a mais/menos e ordem trocada sem afrouxar pra títulos genéricos.
    target_tokens = set(target.split())
    best = None  # (score, header_len, section, header_raw)
    for s, hn, hr in _iter_candidates(sections):
        htok = set(hn.split())
        if not htok:
            continue
        inter = len(target_tokens & htok)
        union = len(target_tokens | htok)
        score = inter / union if union else 0.0
        key = (score, len(hn))
        if best is None or key > (best[0], best[1]):
            best = (score, len(hn), s, hr)
    if best and best[0] >= _TOKEN_MATCH_THRESHOLD:
        return best[2].legenda, best[3]

    # 4. substring em qualquer direção (header é prefixo/abreviação do nome da task).
    #    Preferimos o header mais longo (mais específico) em caso de múltiplos.
    candidates = [
        (s, hn, hr) for s, hn, hr in _iter_candidates(sections)
        if target in hn or hn in target
    ]
    if candidates:
        s, hn, hr = max(candidates, key=lambda x: len(x[1]))
        return s.legenda, hr

    # 4b. mesmo substring, ignorando espaços (última tolerância)
    if tns:
        loose = [
            (s, hn, hr) for s, hn, hr in _iter_candidates(sections)
            if hn.replace(" ", "") and (tns in hn.replace(" ", "") or hn.replace(" ", "") in tns)
        ]
        if loose:
            s, hn, hr = max(loose, key=lambda x: len(x[1]))
            return s.legenda, hr

    return "", None
