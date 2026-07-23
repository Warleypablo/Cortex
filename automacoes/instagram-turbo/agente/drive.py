"""
Wrapper read-only do Google Drive + Docs.

Autenticação: Service Account (JWT-bearer flow). O JSON da credencial é
apontado por GOOGLE_SERVICE_ACCOUNT_JSON no .env. As pastas/Docs precisam
estar compartilhados com o client_email da service account.

JWT é assinado via `openssl dgst -sha256 -sign` em subprocess para evitar
qualquer dependência Python externa (PyJWT/cryptography/google-auth).

APIs usadas:
  - Drive v3: files.list (search), files.get (metadata)
  - Docs v1: documents.get (conteúdo estruturado)
"""
from __future__ import annotations
import base64
import json
import re
import subprocess
import time
import unicodedata
import urllib.parse
import urllib.request
import urllib.error
from dataclasses import dataclass

from agente.config import CONFIG

_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
_DRIVE_API = "https://www.googleapis.com/drive/v3"
_DOCS_API = "https://docs.googleapis.com/v1"

_SCOPES = " ".join([
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    # Escrita no GCS (re-host de mídia → bucket privado, ver agente/rehost.py).
    # O mesmo token JWT passa a cobrir Drive-read + Storage-write. Pedir o
    # escopo é inofensivo mesmo sem o papel IAM — permissão é checada por chamada.
    "https://www.googleapis.com/auth/devstorage.read_write",
])


# Cache em memória do access_token
_access_token_cache: dict[str, float | str] = {"token": "", "expires_at": 0.0}


def _b64url(data: bytes) -> str:
    """Base64url sem padding (formato exigido pelo JWT)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _sign_rs256(private_key_pem: str, message: bytes) -> bytes:
    """Assina `message` com RS256 via openssl. Chave em tempfile (openssl -sign exige path)."""
    import os
    import tempfile
    fd, key_path = tempfile.mkstemp(prefix="gsa_key_", suffix=".pem")
    try:
        os.write(fd, private_key_pem.encode())
        os.close(fd)
        os.chmod(key_path, 0o600)
        proc = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=message,
            capture_output=True,
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"openssl falhou ao assinar JWT ({proc.returncode}): "
                f"{proc.stderr.decode(errors='replace')[:300]}"
            )
        return proc.stdout
    finally:
        try:
            os.remove(key_path)
        except OSError:
            pass


def _build_jwt_assertion(creds: dict) -> str:
    """Monta JWT assinado para grant urn:ietf:params:oauth:grant-type:jwt-bearer."""
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT", "kid": creds.get("private_key_id", "")}
    claim = {
        "iss": creds["client_email"],
        "scope": _SCOPES,
        "aud": _TOKEN_ENDPOINT,
        "iat": now,
        "exp": now + 3600,
    }
    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode())
    claim_b64 = _b64url(json.dumps(claim, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{claim_b64}".encode("ascii")
    signature = _sign_rs256(creds["private_key"], signing_input)
    return f"{header_b64}.{claim_b64}.{_b64url(signature)}"


def _load_service_account() -> dict:
    """Lê o JSON da service account."""
    with open(CONFIG.google_service_account_json, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_access_token() -> str:
    """Troca JWT assertion (service account) por access_token (1h). Cacheia."""
    CONFIG.require_google()
    now = time.time()
    if _access_token_cache["token"] and float(_access_token_cache["expires_at"]) > now + 60:
        return str(_access_token_cache["token"])

    creds = _load_service_account()
    assertion = _build_jwt_assertion(creds)
    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion,
    }).encode()
    req = urllib.request.Request(_TOKEN_ENDPOINT, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            payload = json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300]
        raise RuntimeError(f"Google JWT-bearer falhou ({e.code}): {body}") from e

    token = payload["access_token"]
    _access_token_cache["token"] = token
    _access_token_cache["expires_at"] = now + int(payload.get("expires_in", 3600))
    return token


def _gapi(method: str, url: str, params: dict | None = None) -> dict:
    token = _get_access_token()
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"Google API {e.code} em {method} {url}: {body}") from e


@dataclass
class DriveFile:
    id: str
    name: str
    mime_type: str
    parent_id: str | None
    size: int | None


def _files_list(query: str, fields: str = "files(id,name,mimeType,parents,size),nextPageToken") -> list[dict]:
    """files.list com paginação."""
    all_files: list[dict] = []
    page_token: str | None = None
    while True:
        params = {
            "q": query,
            "fields": fields,
            "pageSize": 100,
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true",
        }
        if page_token:
            params["pageToken"] = page_token
        r = _gapi("GET", f"{_DRIVE_API}/files", params)
        all_files.extend(r.get("files", []))
        page_token = r.get("nextPageToken")
        if not page_token:
            break
    return all_files


def find_folder_by_name(name: str, parent_id: str | None = None) -> DriveFile | None:
    q_parts = [
        "mimeType = 'application/vnd.google-apps.folder'",
        f"name = '{name.replace(chr(39), chr(92)+chr(39))}'",
        "trashed = false",
    ]
    if parent_id:
        q_parts.append(f"'{parent_id}' in parents")
    r = _files_list(" and ".join(q_parts))
    if not r:
        return None
    f = r[0]
    parents = f.get("parents") or []
    return DriveFile(
        id=f["id"],
        name=f["name"],
        mime_type=f["mimeType"],
        parent_id=parents[0] if parents else None,
        size=int(f["size"]) if f.get("size") else None,
    )


def find_doc_by_name(name: str) -> DriveFile | None:
    q = (
        "mimeType = 'application/vnd.google-apps.document' "
        f"and name = '{name.replace(chr(39), chr(92)+chr(39))}' "
        "and trashed = false"
    )
    r = _files_list(q)
    if not r:
        return None
    f = r[0]
    return DriveFile(
        id=f["id"], name=f["name"], mime_type=f["mimeType"],
        parent_id=(f.get("parents") or [None])[0],
        size=None,
    )


def list_folder(folder_id: str) -> list[DriveFile]:
    q = f"'{folder_id}' in parents and trashed = false"
    r = _files_list(q)
    out: list[DriveFile] = []
    for f in r:
        parents = f.get("parents") or []
        out.append(DriveFile(
            id=f["id"],
            name=f["name"],
            mime_type=f["mimeType"],
            parent_id=parents[0] if parents else None,
            size=int(f["size"]) if f.get("size") else None,
        ))
    return out


def download_bytes(file_id: str) -> bytes:
    """
    Baixa os bytes crus de um arquivo binário do Drive (imagem/vídeo) via
    files.get?alt=media. Usa o mesmo token (drive.readonly cobre o download).

    Só funciona pra arquivos binários — Google Docs/Sheets nativos exigiriam
    `export`, mas aqui só baixamos mídia (image/*, video/*).
    """
    token = _get_access_token()
    url = (
        f"{_DRIVE_API}/files/{urllib.parse.quote(file_id)}"
        "?alt=media&supportsAllDrives=true"
    )
    req = urllib.request.Request(
        url, method="GET", headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"Drive download {e.code} de {file_id}: {body}") from e


def get_doc_text(doc_id: str) -> str:
    """
    Lê o conteúdo do Doc via Docs API e retorna texto com marcadores de bold
    preservados como **...** (compatível com docs_parser.parse_doc).

    Suporta Docs com TABS (Google Workspace): concatena o conteúdo de todas
    as tabs (e sub-tabs recursivamente). Docs sem tabs caem no caminho
    legado (campo `body` direto).
    """
    doc = _gapi("GET", f"{_DOCS_API}/documents/{doc_id}", {"includeTabsContent": "true"})
    tabs = doc.get("tabs") or []
    if tabs:
        return _tabs_to_markdown(tabs)
    return _body_to_markdown(doc.get("body", {}))


def _tabs_to_markdown(tabs: list[dict]) -> str:
    """Concatena recursivamente o conteúdo de todas as tabs/sub-tabs."""
    out: list[str] = []
    for tab in tabs:
        dt = tab.get("documentTab") or {}
        body = dt.get("body") or {}
        out.append(_body_to_markdown(body))
        children = tab.get("childTabs") or []
        if children:
            out.append(_tabs_to_markdown(children))
    return "\n".join(out)


def _body_to_markdown(body: dict) -> str:
    """Converte um `body` do Docs em texto com **bold** preservado."""
    out: list[str] = []
    for el in body.get("content", []):
        para = el.get("paragraph")
        if not para:
            continue
        parts: list[str] = []
        for run in para.get("elements", []):
            tr = run.get("textRun")
            if not tr:
                continue
            txt = tr.get("content", "")
            bold = (tr.get("textStyle") or {}).get("bold")
            if bold and txt.strip():
                trailing_nl = "\n" if txt.endswith("\n") else ""
                core = txt.rstrip("\n")
                parts.append(f"**{core}**{trailing_nl}")
            else:
                parts.append(txt)
        out.append("".join(parts))
    return "".join(out)


# --------- Helpers de alto nível ---------

def resolve_mes_drive_folder(mes_upper: str) -> DriveFile | None:
    """
    'ABRIL' → DriveFile da pasta '04 - Abril' dentro da raiz fixa.
    """
    from agente.clickup import mes_to_num, mes_titled
    num = mes_to_num(mes_upper)
    if not num:
        return None
    name = f"{num} - {mes_titled(mes_upper.lower())}"  # "04 - Abril"
    return find_folder_by_name(name, parent_id=CONFIG.drive_meses_root_folder_id)


def resolve_mes_doc(mes_upper: str) -> DriveFile | None:
    """
    'ABRIL' → DriveFile do Doc 'SOCIAL MEDIA TURBO [ABRIL]'.
    """
    return find_doc_by_name(f"SOCIAL MEDIA TURBO [{mes_upper}]")


def _normalize_folder_name(name: str) -> str:
    """Normaliza nome de pasta: troca NBSP por espaço e remove whitespace de borda.

    Necessário porque a cardista frequentemente cola nomes com caracteres
    invisíveis (NBSP \\xa0, trailing spaces), e a query `name = '...'` do
    Drive faz match exato — falha silenciosamente nesses casos.
    """
    return name.replace("\xa0", " ").strip()


def find_post_folder(parent_mes_folder_id: str, turbo_slug: str) -> DriveFile | None:
    """Busca subpasta TURBO_<slug> dentro da pasta do mês.

    Lista todos os filhos da pasta do mês e compara nomes normalizados
    (NBSP/whitespace tolerados). Mais robusto que `find_folder_by_name`,
    que faz match exato e quebra com nomes "TURBO_x \\xa0".

    LEGADO: casa pelo SLUG da descrição, que vem podre/desatualizado do
    template e apontava pra pasta de OUTRO post. Use find_post_folder_by_card.
    """
    target = _normalize_folder_name(turbo_slug)
    for f in list_folder(parent_mes_folder_id):
        if f.mime_type != "application/vnd.google-apps.folder":
            continue
        if _normalize_folder_name(f.name) == target:
            return f
    return None


def _content_key(name: str) -> str:
    """Chave de conteúdo pra casar pasta<->card: remove o prefixo 'TURBO_'
    (e NBSP/espaços de borda), acentos e pontuação; devolve UPPER com espaços
    simples. Ex.: 'TURBO_seucliente' -> 'SEUCLIENTE'; 'Seu cliente é o seu
    maior redator' -> 'SEU CLIENTE E O SEU MAIOR REDATOR'.
    """
    n = name.replace("\xa0", " ")
    n = re.sub(r"^\s*turbo[_\s]+", "", n, flags=re.IGNORECASE)   # tira prefixo TURBO_
    n = unicodedata.normalize("NFD", n)
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")  # tira acentos
    n = re.sub(r"[^\w\s]", "", n)                                 # tira pontuação
    return re.sub(r"\s+", " ", n).strip().upper()


def _folder_key_covered_by_card_words(fk_ns: str, card_words: set[str]) -> bool:
    """A chave sem-espaço da pasta é uma CONCATENAÇÃO de palavras do card (qualquer
    ordem)?

    Ex.: pasta 'imperiomanucit' = 'imperio'+'manu'+'cit', todas palavras do card
    'Como Manu Cit está construindo um império'. O slug vem com as palavras coladas
    E reordenadas, então igualdade/substring/subset não pegam (substring exige
    sequência contígua; subset compara a chave-blob 'IMPERIOMANUCIT' como 1 token).

    Word-break (DP): fk_ns tem que ser TOTALMENTE segmentável em palavras do card,
    cada uma com 3+ chars (evita casar por 'um'/'o'/'e' à toa). Deliberadamente
    estrito — casar a pasta ERRADA publica conteúdo errado (pior que não publicar).
    """
    toks = {w for w in card_words if len(w) >= 3}
    if not toks:
        return False
    n = len(fk_ns)
    reach = [False] * (n + 1)
    reach[0] = True
    for i in range(n):
        if not reach[i]:
            continue
        for t in toks:
            if fk_ns.startswith(t, i):
                reach[i + len(t)] = True
    return reach[n]


def _matching_folder_names(card_name: str, folder_names: list[str]) -> list[str]:
    """Núcleo PURO: nomes de pasta que casam o card, TODOS empatados no topo.

    Casa por `_content_key` com tolerância: igualdade, substring sem-espaço em
    qualquer direção, o conjunto de palavras da pasta contido no do card
    (as pastas têm um nome abreviado do começo do card: 'TURBO_seucliente'
    p/ 'Seu cliente...'), OU a chave-blob da pasta ser uma concatenação de
    palavras do card em outra ordem ('imperiomanucit' p/ 'Manu Cit... império').
    Guarda de 5+ chars evita chave curta casar à toa.
    Em múltiplos matches, mantém só os de chave mais longa (mais específica).

    Retorna [] se nenhuma casa, [nome] se há um vencedor claro, ou [n1, n2, ...]
    quando há empate no topo (ex.: duas pastas 'TURBO_marketinge' idênticas) —
    o desempate por conteúdo fica com quem tem acesso ao Drive (find_post_...).
    """
    ck = _content_key(card_name)
    ck_ns = ck.replace(" ", "")
    if not ck_ns:
        return []
    cand: list[tuple[str, int]] = []
    for name in folder_names:
        fk = _content_key(name)
        fk_ns = fk.replace(" ", "")
        if len(fk_ns) < 5:
            continue
        if (fk == ck
                or fk_ns in ck_ns or ck_ns in fk_ns
                or set(fk.split()) <= set(ck.split())
                or _folder_key_covered_by_card_words(fk_ns, set(ck.split()))):
            cand.append((name, len(fk_ns)))
    if not cand:
        return []
    top = max(c[1] for c in cand)
    return [name for name, score in cand if score == top]


def _pick_folder_for_card(card_name: str, folder_names: list[str]) -> str | None:
    """Compat: um vencedor único, ou None se nenhuma casa OU empate (ambíguo).

    Fail-safe puro (sem olhar conteúdo da pasta). O desempate por presença de
    ativo é feito em `find_post_folder_by_card` (que tem acesso ao Drive).
    """
    names = _matching_folder_names(card_name, folder_names)
    return names[0] if len(names) == 1 else None


def find_post_folder_by_card(parent_mes_folder_id: str, card_name: str) -> DriveFile | None:
    """Acha a subpasta do post casando pelo NOME DO CARD (fonte confiável do
    calendário), NÃO pelo slug 'TURBO_<x>' da descrição.

    Motivo: o slug vem copiado do template e desatualizado — apontava pra pasta
    de OUTRO post e publicou conteúdo errado em 08/jul/2026 (card 'Seu cliente é
    o seu maior redator' com slug 'TURBO_datassazonais' -> saiu o carrossel de
    'Datas sazonais'). As pastas do mês têm nome de conteúdo derivado do card
    ('TURBO_seucliente', 'TURBO_ News 1'), então casamos contra o nome do card.

    FAIL-SAFE: None se nenhuma pasta casa OU se há ambiguidade — melhor não
    publicar (e alertar) do que publicar o post errado.
    """
    folders = [f for f in list_folder(parent_mes_folder_id)
               if f.mime_type == "application/vnd.google-apps.folder"]
    # NÃO indexar por nome: duas pastas podem ter o MESMO nome (ex.: duas
    # 'TURBO_marketinge' iguais) e um dict por nome colapsaria as duas numa só.
    matched_names = set(_matching_folder_names(card_name, [f.name for f in folders]))
    matched = [f for f in folders if f.name in matched_names]
    return _resolve_folder_tie(
        matched,
        lambda f: classify_assets(list_folder(f.id))[0] != "empty",
    )


def _resolve_folder_tie(matched: list, has_assets) -> "DriveFile | None":
    """Núcleo PURO do desempate (testável sem Drive). `has_assets(folder)->bool`.

    Nenhuma casa → None. Uma → ela. Múltiplas pastas casam (nomes IGUAIS ou
    chaves empatadas): antes o código desistia (fail-safe), mas o caso comum é
    UMA vazia + UMA com os ativos — sem ambiguidade real. Fica só com as que têm
    ativo publicável; um único não-vazio → é ele. Zero (todas vazias) ou 2+ com
    conteúdo → aí sim é ambíguo → None (fail-safe, não publica errado)."""
    if not matched:
        return None
    if len(matched) == 1:
        return matched[0]
    with_assets = [f for f in matched if has_assets(f)]
    return with_assets[0] if len(with_assets) == 1 else None


_LEADING_NUM_RE = re.compile(r"(\d+)")
_TRAILING_NUM_RE = re.compile(r"(\d+)\s*\.[^.]+$")  # número logo antes da extensão


def _slide_sort_key(f: DriveFile) -> tuple[int, int, str]:
    """
    Chave de ordenação numérica natural para slides de carrossel.

    Convenção do time: arquivos nomeados `1.png`, `2.png`, ..., `10.png`
    (ou `1.mp4`, `2.mp4`, ...), com prefixo opcional (`ritual 3.png`,
    `CAPA 00.png`). O número do slide é o que vem IMEDIATAMENTE ANTES da
    extensão — priorizamos ele para não deixar um número no MEIO do nome
    sequestrar a ordenação: em `Você vai perder de 7x1 1.png`, o `7` do tema
    "7x1" era pego como se fosse o índice, todos os slides empatavam no `7`
    e caíam em ordem alfabética (1, 10, 2, 3, ...). Só se não houver número
    antes da extensão é que caímos no primeiro número do nome.

    Fallback (sem número no nome) → vai pro fim, ordem alfabética.
    """
    m = _TRAILING_NUM_RE.search(f.name) or _LEADING_NUM_RE.search(f.name)
    if m:
        return (0, int(m.group(1)), f.name.lower())
    return (1, 0, f.name.lower())


_STORY_RE = re.compile(r"\bstor(y|ys|ies)\b", re.IGNORECASE)


def _is_story_asset(name: str) -> bool:
    """True se o arquivo é a versão STORIES do post (9x16). O time sobe stories
    MANUALMENTE no Instagram Stories, então o publicador de FEED deve ignorá-los
    — senão eles entram no carrossel do feed (caso real 09/jul/2026: a pasta
    'TURBO_asolucao' tinha 7 slides de feed + 7 de 'A SOLUÇÃO - stories N.png',
    dando 14 assets intercalados, acima do limite de 10 do IG).

    Match por PALAVRA (`\\bstor(y|ys|ies)\\b`) pra pegar 'stories'/'story' como
    tag no nome ('... - stories 3.png') sem falso-positivo em 'história' /
    'storytelling' (onde 'stor' está no meio de outra palavra).
    """
    return bool(_STORY_RE.search(name))


def classify_assets(files: list[DriveFile]) -> tuple[str, list[DriveFile]]:
    """
    Retorna (tipo_post, assets_ordenados).
    tipo_post ∈ {'reels', 'carousel', 'single', 'empty'}

    Regras (validadas com Raquel em 2026-05-18):
      - 1 vídeo isolado          → reels
      - 1 imagem isolada         → single
      - 2+ arquivos (qualquer    → carousel, ordenado pelo número no nome
        mix de imagem e vídeo)     (Meta Graph aceita carousel misto)

    Arquivos de STORIES (ver _is_story_asset) são IGNORADOS — o feed só leva a
    versão de feed; stories vão manualmente pro Instagram Stories.
    """
    media = [
        f for f in files
        if (f.mime_type.startswith("image/") or f.mime_type.startswith("video/"))
        and not _is_story_asset(f.name)
    ]
    media.sort(key=_slide_sort_key)

    if len(media) >= 2:
        return "carousel", media
    if len(media) == 1:
        only = media[0]
        if only.mime_type.startswith("video/"):
            return "reels", [only]
        return "single", [only]
    return "empty", []


# Label do dropdown "Formato do post" do ClickUp → tipo_post do publicador.
# Só mapeamos os formatos de post de feed do IG; YT/CORTE/LINKEDIN/THUMB/ADS
# não são publicados por este agente e caem em None (usa a inferência do Drive).
_FORMATO_LABEL_TO_TIPO = {
    "reels": "reels",
    "carrossel": "carousel",
    "carousel": "carousel",
    "img única": "single",
    "img unica": "single",
    "imagem única": "single",
    "imagem unica": "single",
    "single": "single",
}


def declared_tipo_from_label(label: str | None) -> str | None:
    """Converte o label do campo 'Formato do post' (REELS/CARROSSEL/IMG ÚNICA)
    no tipo_post do publicador (reels/carousel/single). None quando ausente ou
    for um formato fora do escopo do agente (YT, ADS, etc.)."""
    if not label:
        return None
    return _FORMATO_LABEL_TO_TIPO.get(label.strip().lower())


def reconcile_format(declared: str | None, tipo: str,
                     assets: list[DriveFile]) -> tuple[str, list[DriveFile], str | None]:
    """Faz o formato DECLARADO no card prevalecer sobre a inferência por
    contagem de arquivos (classify_assets).

    Motivo: uma pasta com vídeo + capa/frame tem 2 arquivos e classify_assets
    devolve 'carousel', publicando um REELS errado como carrossel (bug de
    02/07/2026). Quando o card declara o formato, ele manda — e a gente
    seleciona os assets coerentes (ex.: REELS → só o vídeo principal).

    Retorna (tipo_final, assets_finais, nota). `nota` != None quando houve
    override, ou quando o formato declarado NÃO bate com os assets (nesse caso
    mantém a inferência e a nota vira só um aviso). `classify_assets` continua
    sendo o fallback quando `declared` é None.
    """
    if not declared or declared == tipo:
        return tipo, assets, None

    videos = [a for a in assets if a.mime_type.startswith("video/")]
    images = [a for a in assets if a.mime_type.startswith("image/")]

    if declared == "reels":
        if videos:
            extras = len(assets) - 1
            nota = (f"card=REELS sobrepõe inferência '{tipo}': publica o vídeo "
                    f"'{videos[0].name}'" + (f" e ignora {extras} arquivo(s) extra(s)"
                    if extras > 0 else ""))
            return "reels", [videos[0]], nota
        return tipo, assets, f"card=REELS mas não há vídeo na pasta — mantém '{tipo}'"

    if declared == "single":
        pick = images[0] if images else assets[0]
        return "single", [pick], f"card=IMG ÚNICA sobrepõe inferência '{tipo}'"

    if declared == "carousel":
        if len(assets) >= 2:
            return "carousel", assets, f"card=CARROSSEL sobrepõe inferência '{tipo}'"
        return tipo, assets, f"card=CARROSSEL mas só há {len(assets)} arquivo — mantém '{tipo}'"

    return tipo, assets, None
