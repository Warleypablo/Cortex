"""
Publicação no Instagram via Meta Graph API (Instagram Business).

Suporta os 3 tipos do MVP: single (imagem), reel (vídeo), carousel.
Lida com o ciclo container → publish, e com o polling de status que reels
exigem antes de publicar.

Pré-requisitos:
  - META_LONG_LIVED_TOKEN no .env (token de página, com permissões
    instagram_basic + instagram_content_publish)
  - IG_BUSINESS_ACCOUNT_ID no .env (id da conta IG Business/Creator)
  - URLs dos assets precisam ser PÚBLICAS e acessíveis pela Meta.
    O Drive direto (uc?id=...) costuma servir pra imagem; reels grandes
    podem precisar de S3/Blob.

Uso como biblioteca (chamado pelo main.py em Bloco D/E):
    from agente import instagram
    media_id = instagram.publish_single(image_url, caption)
    media_id = instagram.publish_reel(video_url, caption)
    media_id = instagram.publish_carousel([url1, url2, ...], caption,
                                          item_types=['image','image',...])

CLI (pra testar isolado antes de plugar no agente):
    python3 -m agente.instagram --verify
    python3 -m agente.instagram --publish-single --url URL --caption "..."
    python3 -m agente.instagram --publish-reel   --url URL --caption "..."
    python3 -m agente.instagram --publish-carousel --urls URL1,URL2 --caption "..."

Toda chamada que publica de fato verifica DRY_RUN — se =1, faz só os
containers (READ-side) mas não chama media_publish. Pra publicação real
você precisa DRY_RUN=0 explícito.
"""
from __future__ import annotations
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from dataclasses import dataclass

from agente.config import CONFIG

GRAPH_VERSION = "v21.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"

# Limites Meta
CAROUSEL_MIN = 2
CAROUSEL_MAX = 10
REEL_STATUS_POLL_SECONDS = 5
REEL_STATUS_MAX_WAIT_SECONDS = 600  # 10 min — reels grandes demoram a processar


class MetaError(RuntimeError):
    """Erro vindo da Graph API (com status e payload)."""

    def __init__(self, status: int, payload: dict | str, op: str):
        self.status = status
        self.payload = payload
        self.op = op
        msg = f"Meta {status} em {op}: {payload}"
        super().__init__(msg)


def _graph(method: str, path: str, params: dict | None = None) -> dict:
    """
    Chama Graph API. Token vai sempre como query param 'access_token'.
    GET → params na query. POST → params no body x-www-form-urlencoded.
    """
    CONFIG.require_meta()
    p = dict(params or {})
    p["access_token"] = CONFIG.meta_long_lived_token

    url = f"{GRAPH_BASE}{path}"
    if method == "GET":
        url += "?" + urllib.parse.urlencode(p)
        req = urllib.request.Request(url, method="GET")
    else:
        body = urllib.parse.urlencode(p).encode()
        req = urllib.request.Request(url, data=body, method=method)

    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:600]
        try:
            payload = json.loads(body)
        except Exception:  # noqa: BLE001
            payload = body
        raise MetaError(e.code, payload, f"{method} {path}") from e


# ── Account / token health ────────────────────────────────────────────────

@dataclass
class IgAccount:
    id: str
    username: str
    name: str | None
    followers_count: int | None
    media_count: int | None


def verify_token() -> IgAccount:
    """
    Confirma token + IG_BUSINESS_ACCOUNT_ID. Retorna info da conta pra
    você ter certeza de que está apontando pra conta CERTA (test vs prod).
    """
    ig_id = CONFIG.ig_business_account_id
    r = _graph(
        "GET",
        f"/{ig_id}",
        {"fields": "id,username,name,followers_count,media_count"},
    )
    return IgAccount(
        id=r.get("id", ""),
        username=r.get("username", ""),
        name=r.get("name"),
        followers_count=r.get("followers_count"),
        media_count=r.get("media_count"),
    )


# ── Container creation ─────────────────────────────────────────────────────

# WORD JOINER (U+2060): invisível, largura zero. O Instagram COLAPSA linhas em
# branco (\n\n) das legendas na EXIBIÇÃO — os parágrafos saem grudados, mesmo o
# caption tendo as quebras (confirmado via API: as \n\n estão lá, o IG que achata).
# Prepender um WORD JOINER a cada \n deixa toda linha (inclusive as em branco) com
# um caractere não-branco, e aí o IG preserva TODAS as quebras. Padrão confirmado
# num post manual da Turbo (17/jul) que exibe certo: "...2026?⁠\n⁠\n...".
_IG_LINE_BREAK_GUARD = "\u2060"
_IG_PARA_SEP = _IG_LINE_BREAK_GUARD + "\n" + _IG_LINE_BREAK_GUARD + "\n"


def _ig_safe_caption(caption: str) -> str:
    """
    Separa os par\u00e1grafos da legenda com LINHA EM BRANCO GUARDADA \u2014 o formato que o
    IG exibe certo. Dois motivos: (1) o IG COLAPSA \\n\\n cru na exibi\u00e7\u00e3o; (2) o Doc
    costuma vir com \\n SIMPLES entre par\u00e1grafos (o time d\u00e1 1 Enter s\u00f3), ent\u00e3o nem
    linha em branco existe. Cada quebra do Doc vira "<para>WJ\\nWJ\\n<para>" (o WORD
    JOINER em cada linha, inclusive a em branco, impede o colapso do IG).
    """
    if not caption:
        return caption
    paras = [p.strip() for p in caption.split("\n") if p.strip()]
    return _IG_PARA_SEP.join(paras)


def _create_image_container(image_url: str, caption: str,
                            is_carousel_item: bool = False) -> str:
    params: dict = {"image_url": image_url}
    if caption:
        params["caption"] = _ig_safe_caption(caption)
    if is_carousel_item:
        params["is_carousel_item"] = "true"
    r = _graph("POST", f"/{CONFIG.ig_business_account_id}/media", params)
    return r["id"]


def _create_video_container(video_url: str, caption: str, media_type: str,
                            is_carousel_item: bool = False) -> str:
    """
    media_type ∈ {'REELS', 'VIDEO'}.
    - REELS → publica como reel no feed/aba reels (uso fora de carousel).
    - VIDEO + is_carousel_item=true → item de vídeo dentro de carousel.
    """
    params: dict = {"video_url": video_url, "media_type": media_type}
    if caption:
        params["caption"] = _ig_safe_caption(caption)
    if is_carousel_item:
        params["is_carousel_item"] = "true"
    r = _graph("POST", f"/{CONFIG.ig_business_account_id}/media", params)
    return r["id"]


def _create_carousel_container(children_ids: list[str], caption: str) -> str:
    params = {
        "media_type": "CAROUSEL",
        "children": ",".join(children_ids),
    }
    if caption:
        params["caption"] = _ig_safe_caption(caption)
    r = _graph("POST", f"/{CONFIG.ig_business_account_id}/media", params)
    return r["id"]


def _container_status(container_id: str) -> dict:
    return _graph(
        "GET",
        f"/{container_id}",
        {"fields": "status_code,status"},
    )


def _wait_for_finished(container_id: str, label: str = "container",
                      max_wait: int = REEL_STATUS_MAX_WAIT_SECONDS) -> None:
    """
    Bloqueia até container ficar com status FINISHED (pronto pra publicar).
    Lança MetaError se ERROR/EXPIRED ou se estourar timeout.
    Reels exigem isso; image containers normalmente já saem FINISHED.
    """
    deadline = time.time() + max_wait
    last = ""
    while time.time() < deadline:
        st = _container_status(container_id)
        code = st.get("status_code", "")
        if code == "FINISHED":
            return
        if code in ("ERROR", "EXPIRED"):
            raise MetaError(
                200, st,
                f"{label} {container_id} terminou com status {code}",
            )
        last = code
        time.sleep(REEL_STATUS_POLL_SECONDS)
    raise MetaError(
        408, {"last_status": last},
        f"{label} {container_id} não ficou FINISHED em {max_wait}s",
    )


def _publish(container_id: str) -> str:
    """Chama /media_publish e retorna o ig_media_id permanente."""
    if CONFIG.dry_run:
        return f"DRYRUN_NOT_PUBLISHED:{container_id}"
    r = _graph(
        "POST",
        f"/{CONFIG.ig_business_account_id}/media_publish",
        {"creation_id": container_id},
    )
    return r["id"]


def get_permalink(ig_media_id: str) -> str | None:
    """URL pública do post no Instagram (pra colar no comment do ClickUp)."""
    if ig_media_id.startswith("DRYRUN_"):
        return None
    try:
        r = _graph("GET", f"/{ig_media_id}", {"fields": "permalink"})
        return r.get("permalink")
    except MetaError:
        return None


# ── API pública: 3 tipos de publicação ────────────────────────────────────

@dataclass
class PublishResult:
    ig_media_id: str          # id permanente OU "DRYRUN_NOT_PUBLISHED:..."
    container_id: str         # id do container intermediário (rastreio)
    permalink: str | None     # https://instagram.com/p/... (None em dry-run)
    dry_run: bool


def publish_single(image_url: str, caption: str) -> PublishResult:
    container = _create_image_container(image_url, caption)
    # Imagem normalmente sai FINISHED na hora, mas damos uma checada rápida.
    _wait_for_finished(container, label="single", max_wait=60)
    media_id = _publish(container)
    return PublishResult(
        ig_media_id=media_id,
        container_id=container,
        permalink=get_permalink(media_id) if not CONFIG.dry_run else None,
        dry_run=CONFIG.dry_run,
    )


def publish_reel(video_url: str, caption: str) -> PublishResult:
    container = _create_video_container(video_url, caption, media_type="REELS")
    _wait_for_finished(container, label="reel")
    media_id = _publish(container)
    return PublishResult(
        ig_media_id=media_id,
        container_id=container,
        permalink=get_permalink(media_id) if not CONFIG.dry_run else None,
        dry_run=CONFIG.dry_run,
    )


def publish_carousel(urls: list[str], caption: str,
                     item_types: list[str] | None = None) -> PublishResult:
    """
    urls: 2–10 URLs públicas.
    item_types: lista paralela em {'image','video'}. Se None, assume tudo image.
    """
    if not (CAROUSEL_MIN <= len(urls) <= CAROUSEL_MAX):
        raise ValueError(
            f"carousel precisa de {CAROUSEL_MIN}–{CAROUSEL_MAX} itens, recebi {len(urls)}"
        )
    types = item_types or ["image"] * len(urls)
    if len(types) != len(urls):
        raise ValueError("item_types deve ter mesmo tamanho que urls")

    child_ids: list[str] = []
    for url, t in zip(urls, types):
        if t == "image":
            cid = _create_image_container(url, caption="", is_carousel_item=True)
        elif t == "video":
            cid = _create_video_container(
                url, caption="", media_type="VIDEO", is_carousel_item=True,
            )
        else:
            raise ValueError(f"item_type inválido: {t}")
        # Itens de vídeo em carousel precisam ficar FINISHED também
        if t == "video":
            _wait_for_finished(cid, label=f"carousel-item({t})")
        child_ids.append(cid)

    parent = _create_carousel_container(child_ids, caption)
    _wait_for_finished(parent, label="carousel", max_wait=120)
    media_id = _publish(parent)
    return PublishResult(
        ig_media_id=media_id,
        container_id=parent,
        permalink=get_permalink(media_id) if not CONFIG.dry_run else None,
        dry_run=CONFIG.dry_run,
    )


# ── Drive helper: monta URL pública a partir de file_id ────────────────────

def drive_public_url(file_id: str) -> str:
    """
    URL no formato que a Meta consegue baixar. Requer que o arquivo (ou
    a pasta) esteja com 'Anyone with link' no Drive. Pra reels grandes,
    se isso falhar, partimos pro plano B (S3/Blob).
    """
    return f"https://drive.google.com/uc?export=download&id={file_id}"


# ── CLI pra teste manual ──────────────────────────────────────────────────

def _cli() -> int:
    ap = argparse.ArgumentParser(description="Publica no Instagram via Graph API")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("verify", help="confirma token + identifica a conta IG")

    p_single = sub.add_parser("publish-single", help="publica 1 imagem")
    p_single.add_argument("--url", required=True)
    p_single.add_argument("--caption", default="")

    p_reel = sub.add_parser("publish-reel", help="publica 1 reel")
    p_reel.add_argument("--url", required=True)
    p_reel.add_argument("--caption", default="")

    p_car = sub.add_parser("publish-carousel", help="publica carousel (2–10 itens)")
    p_car.add_argument("--urls", required=True,
                       help="URLs separadas por vírgula")
    p_car.add_argument("--types", default="",
                       help="types paralelos (image,video,image,...). default: tudo image")
    p_car.add_argument("--caption", default="")

    args = ap.parse_args()

    print(f"DRY_RUN={CONFIG.dry_run}   IG_ID={CONFIG.ig_business_account_id}")
    if args.cmd == "verify":
        acc = verify_token()
        print(f"✅ token OK")
        print(f"   conta IG: @{acc.username}  ({acc.name or '—'})")
        print(f"   id: {acc.id}")
        print(f"   seguidores: {acc.followers_count}   posts: {acc.media_count}")
        return 0

    if CONFIG.dry_run:
        print("⚠️  DRY_RUN=1 — vou CRIAR o container mas NÃO chamar media_publish.")
        print("    Pra publicar de verdade: DRY_RUN=0 python3 -m agente.instagram ...")

    try:
        if args.cmd == "publish-single":
            res = publish_single(args.url, args.caption)
        elif args.cmd == "publish-reel":
            res = publish_reel(args.url, args.caption)
        elif args.cmd == "publish-carousel":
            urls = [u.strip() for u in args.urls.split(",") if u.strip()]
            types = [t.strip() for t in args.types.split(",") if t.strip()] or None
            res = publish_carousel(urls, args.caption, item_types=types)
        else:
            ap.error("comando desconhecido")
            return 2
    except MetaError as e:
        print(f"❌ {e}")
        return 1
    except ValueError as e:
        print(f"❌ argumento inválido: {e}")
        return 2

    print(f"✅ container: {res.container_id}")
    print(f"   media_id:  {res.ig_media_id}")
    if res.permalink:
        print(f"   permalink: {res.permalink}")
    if res.dry_run:
        print("   (dry-run: media_publish NÃO foi chamado)")
    return 0


if __name__ == "__main__":
    sys.exit(_cli())
