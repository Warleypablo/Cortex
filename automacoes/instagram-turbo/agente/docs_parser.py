"""
Parser do Google Docs mestre "SOCIAL MEDIA TURBO [MÊS]".

O Doc é exportado como texto (via Drive API ou MCP read_file_content) e aqui
extraímos, por task.name, a LEGENDA correspondente.

Convenções validadas empiricamente (Doc de ABRIL, 2026-04-21):

  **SOCIAL MEDIA TURBO [ABRIL]**     ← cabeçalho geral (ignorar)
  **RECORDE NEYMAR**                  ← header de post (bold UPPER)
  **IMG 1**                           ← header de slide (ignorar pro match)
  ...
  **LEGENDA**                         ← MARCADOR de início da legenda
  <texto que vai pro IG>
  **PRÓXIMO POST**                    ← fim da legenda anterior

Regras:
  - Header de post = linha em bold UPPER cuja primeira palavra NÃO é
    IMG / LEGENDA / TELA / N<número> (news headline).
  - "Legenda" de uma seção = tudo entre o primeiro `**LEGENDA**` dessa seção
    e o próximo header de post (ou EOF).
  - Se seção não tem `**LEGENDA**` OU legenda está vazia → retorna "".

A exportação do Docs pode vir em markdown (preservando `**...**`) ou plain text
(sem asteriscos). Este parser aceita as duas. Também aceita o formato do
read_file_content do MCP (onde colchetes vêm escapados `\\[ABRIL\\]`).
"""
from __future__ import annotations
import re
import unicodedata
from dataclasses import dataclass


# Primeiras palavras que identificam headers INTERNOS de seção (não são títulos de post)
_INTERNAL_FIRST_WORDS = frozenset({
    "IMG", "LEGENDA", "TELA", "SLIDE", "CENA", "CASE",
    "HOOK", "BODY", "CTA", "STORY", "REELS", "LIVE", "CARROSSEL",
})

_LEGENDA_MARKER = re.compile(r"^\s*\**\s*LEGENDA\s*\**\s*$", re.IGNORECASE | re.MULTILINE)


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


def _is_post_header(line: str) -> bool:
    """
    Linha candidata a header de post:
    - Linha INTEIRA em bold (começa com `**`) — regra crítica
    - Conteúdo essencial em UPPER
    - Não é prefixo interno (IMG, LEGENDA, TELA, etc.)
    - Tem pelo menos 2 letras

    Exigir bold é essencial: textos internos de slide podem ser caps
    ("Na CIMED", "SEU TIME TEM MEDO DA CÂMERA?") sem estar em bold —
    sem essa regra, eles eram detectados como falsos headers e cortavam
    a seção antes do marker **LEGENDA**.
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


def _sanitize_line_for_text(line: str) -> str:
    """Remove bold markers mantendo conteúdo."""
    return re.sub(r"\*+", "", line)


@dataclass
class ParsedSection:
    header: str          # como aparece no doc (UPPER)
    header_normalized: str
    legenda: str         # texto já limpo (sem ** e trim)
    has_marker: bool     # tinha **LEGENDA**
    start_line: int      # pra debug


def parse_doc(content: str) -> list[ParsedSection]:
    """
    Varre o Doc e retorna lista de ParsedSection, 1 por post.
    O primeiro header (geralmente "SOCIAL MEDIA TURBO [MES]") é ignorado
    como duplicata se aparecer logo no começo.
    """
    # Unescape de colchetes (\[ABRIL\] → [ABRIL])
    content = content.replace("\\[", "[").replace("\\]", "]")
    # nbsp → space
    content = content.replace("\xa0", " ")

    lines = content.splitlines()
    sections: list[ParsedSection] = []

    # Primeiro passe: acha índices das linhas que são headers de post
    header_indices: list[int] = []
    for i, line in enumerate(lines):
        if _is_post_header(line):
            header_indices.append(i)

    # Descarta 2 primeiras ocorrências do header "SOCIAL MEDIA TURBO [MES]"
    # (vem como título geral, às vezes repete)
    def _is_social_media_header(line: str) -> bool:
        norm = _normalize(_strip_bold(line))
        return "SOCIAL MEDIA TURBO" in norm

    # Filtra header_indices removendo os "SOCIAL MEDIA TURBO..."
    header_indices = [i for i in header_indices if not _is_social_media_header(lines[i])]

    for idx, hdr_line in enumerate(header_indices):
        next_hdr = header_indices[idx + 1] if idx + 1 < len(header_indices) else len(lines)
        header_raw = _strip_bold(lines[hdr_line].strip())
        body_lines = lines[hdr_line + 1 : next_hdr]
        body = "\n".join(body_lines)

        # procura **LEGENDA** no body
        legenda_match = _LEGENDA_MARKER.search(body)
        has_marker = bool(legenda_match)
        legenda_text = ""
        if legenda_match:
            # Pega tudo após o marker até o fim do body
            after = body[legenda_match.end():]
            # Se houver um segundo **LEGENDA** (caso de multiple legendas
            # dentro da mesma seção — raro), paramos no primeiro.
            legenda_text = after.strip()
            legenda_text = _sanitize_line_for_text(legenda_text)
            # Remove linhas que são apenas ruído (linhas só com espaços/traços)
            legenda_text = "\n".join(
                l for l in legenda_text.splitlines()
                if l.strip() and not re.fullmatch(r"[\s\-_=·•]+", l.strip())
            ).strip()

        sections.append(
            ParsedSection(
                header=header_raw,
                header_normalized=_normalize(header_raw),
                legenda=legenda_text,
                has_marker=has_marker,
                start_line=hdr_line,
            )
        )

    return sections


def find_legenda_for_task(doc_content: str, task_name: str) -> tuple[str, str | None]:
    """
    Retorna (legenda_text, matched_header).
    - legenda_text = "" se não achar seção ou se seção tem marker mas legenda vazia.
    - matched_header = header do doc que bateu (None se sem match).

    Match é por normalização (UPPER + sem acentos + compacta espaços).
    """
    target = _normalize(task_name)
    sections = parse_doc(doc_content)
    for s in sections:
        if s.header_normalized == target:
            return s.legenda, s.header
    # tolerância: match em qualquer direção. Casos reais:
    #  - task "Guia Rápido: otimize seu perfil..." vs header "GUIA RÁPIDO"
    #    (header do Doc é um prefixo/abreviação do nome da task)
    #  - task "Justin bieber" vs header "JUSTIN KARAOKE" (task é prefixo)
    # Preferimos o header mais longo (mais específico) em caso de múltiplos.
    candidates = [
        s for s in sections
        if target and (target in s.header_normalized or s.header_normalized in target)
    ]
    if candidates:
        best = max(candidates, key=lambda s: len(s.header_normalized))
        return best.legenda, best.header
    # Última tolerância: diferença SÓ de espaçamento entre título e header
    # (ex.: card "...DO ES TÁ CHEGANDO" vs Doc "...DO ESTÁ CHEGANDO"). Compara sem
    # espaços — pega quebra de palavra/typo de espaço sem afrouxar pra letras diferentes.
    target_ns = target.replace(" ", "")
    if target_ns:
        def ns(s: ParsedSection) -> str:
            return s.header_normalized.replace(" ", "")
        loose = [s for s in sections if ns(s) == target_ns]
        if not loose:
            loose = [s for s in sections if ns(s) and (target_ns in ns(s) or ns(s) in target_ns)]
        if loose:
            best = max(loose, key=lambda s: len(s.header_normalized))
            return best.legenda, best.header
    return "", None
