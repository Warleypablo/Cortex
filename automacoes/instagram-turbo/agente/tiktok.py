"""
Publicação no TikTok via Content Posting API (TikTok for Developers).

Espelha o instagram.py, mas o modelo do TikTok é diferente:

  - OAuth 2.0 (Login Kit): a conta-alvo autoriza o app uma vez → access_token
    (~24h) + refresh_token (~365d). Tokens ficam em .cache/tiktok_tokens.json e
    são renovados sozinhos (refresh) quando perto de expirar.
  - Vídeo enviado por FILE_UPLOAD (bytes em PUT chunked) — não precisa de URL
    pública nem de verificação de domínio. Reaproveita drive.download_bytes.
  - Dois fluxos:
      • INBOX/rascunho  (scope video.upload)  → vídeo cai nos rascunhos da conta;
        a pessoa abre o app e publica com 1 toque. NÃO exige auditoria do app.
      • DIRECT POST     (scope video.publish) → publica direto. App NÃO auditado
        só posta SELF_ONLY (privado); público exige passar pela auditoria do TikTok.

Tudo que publica respeita DRY_RUN: em DRY_RUN=1, faz a parte READ (whoami) mas
não envia/publica.

Pré-requisitos (.env): TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI.

CLI (setup + teste manual):
    python3 -m agente.tiktok auth-url                 # link de autorização OAuth
    python3 -m agente.tiktok exchange --code CODE     # troca o code por tokens
    python3 -m agente.tiktok whoami                   # confirma token + conta
    python3 -m agente.tiktok refresh                  # renova o access_token
    python3 -m agente.tiktok upload --file v.mp4 [--direct] [--title "..."]
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from agente.config import CONFIG, PROJECT_ROOT

# Endpoints
_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
_API_BASE = "https://open.tiktokapis.com/v2"

# Scopes: video.upload = rascunho/inbox; video.publish = direct post.
SCOPES = "user.info.basic,video.upload,video.publish"

_TOKEN_STORE = PROJECT_ROOT / ".cache" / "tiktok_tokens.json"

# Limites de upload (Content Posting API)
_CHUNK_MAX = 64 * 1024 * 1024          # 64 MB por chunk
_SINGLE_CHUNK_MAX = 64 * 1024 * 1024   # vídeo <= 64MB vai em 1 chunk só
_POLL_SECONDS = 4
_POLL_MAX_WAIT = 600


class TikTokError(RuntimeError):
    def __init__(self, status: int, payload: dict | str, op: str):
        self.status = status
        self.payload = payload
        self.op = op
        super().__init__(f"TikTok {status} em {op}: {payload}")


# ── HTTP ───────────────────────────────────────────────────────────────────

def _http(method: str, url: str, *, headers: dict | None = None,
          data: bytes | None = None, op: str = "") -> tuple[int, dict | bytes]:
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            ct = r.headers.get("Content-Type", "")
            if "application/json" in ct:
                return r.status, json.loads(raw) if raw else {}
            return r.status, raw
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:600]
        try:
            payload = json.loads(body)
        except Exception:  # noqa: BLE001
            payload = body
        raise TikTokError(e.code, payload, op or f"{method} {url}") from e


def _post_json(path: str, body: dict, *, token: str, op: str) -> dict:
    url = f"{_API_BASE}{path}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=UTF-8",
    }
    status, payload = _http("POST", url, headers=headers,
                            data=json.dumps(body).encode(), op=op)
    if isinstance(payload, dict):
        err = (payload.get("error") or {})
        if err and err.get("code") not in (None, "", "ok"):
            raise TikTokError(status, payload, op)
    return payload if isinstance(payload, dict) else {}


# ── OAuth / tokens ───────────────────────────────────────────────────────────

def authorize_url(state: str = "") -> str:
    """Monta o link que a conta TikTok abre pra autorizar o app."""
    CONFIG.require_tiktok()
    if not CONFIG.tiktok_redirect_uri:
        raise RuntimeError("TIKTOK_REDIRECT_URI ausente no .env")
    state = state or os.urandom(8).hex()
    q = urllib.parse.urlencode({
        "client_key": CONFIG.tiktok_client_key,
        "scope": SCOPES,
        "response_type": "code",
        "redirect_uri": CONFIG.tiktok_redirect_uri,
        "state": state,
    })
    return f"{_AUTH_URL}?{q}"


def _save_tokens(tok: dict) -> None:
    tok = dict(tok)
    now = int(time.time())
    if "expires_in" in tok:
        tok["expires_at"] = now + int(tok["expires_in"]) - 60  # margem
    if "refresh_expires_in" in tok:
        tok["refresh_expires_at"] = now + int(tok["refresh_expires_in"]) - 60
    _TOKEN_STORE.parent.mkdir(parents=True, exist_ok=True)
    _TOKEN_STORE.write_text(json.dumps(tok, indent=2), encoding="utf-8")
    try:
        os.chmod(_TOKEN_STORE, 0o600)
    except OSError:
        pass


def _load_tokens() -> dict:
    if not _TOKEN_STORE.is_file():
        raise RuntimeError(
            f"tokens do TikTok ausentes ({_TOKEN_STORE}). Rode "
            "`python3 -m agente.tiktok exchange --code <CODE>` primeiro."
        )
    return json.loads(_TOKEN_STORE.read_text(encoding="utf-8"))


def exchange_code(code: str) -> dict:
    """Troca o `code` do OAuth por access/refresh tokens e salva no store."""
    CONFIG.require_tiktok()
    body = urllib.parse.urlencode({
        "client_key": CONFIG.tiktok_client_key,
        "client_secret": CONFIG.tiktok_client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": CONFIG.tiktok_redirect_uri,
    }).encode()
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    status, payload = _http("POST", _TOKEN_URL, headers=headers, data=body,
                            op="oauth/token (authorization_code)")
    if not isinstance(payload, dict) or "access_token" not in payload:
        raise TikTokError(status, payload, "exchange_code")
    _save_tokens(payload)
    return payload


def _refresh(refresh_token: str) -> dict:
    CONFIG.require_tiktok()
    body = urllib.parse.urlencode({
        "client_key": CONFIG.tiktok_client_key,
        "client_secret": CONFIG.tiktok_client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }).encode()
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    status, payload = _http("POST", _TOKEN_URL, headers=headers, data=body,
                            op="oauth/token (refresh_token)")
    if not isinstance(payload, dict) or "access_token" not in payload:
        raise TikTokError(status, payload, "refresh")
    # preserva o refresh_token antigo se a resposta não trouxer um novo
    merged = {**_load_tokens(), **payload}
    _save_tokens(merged)
    return merged


def _access_token() -> str:
    """Retorna um access_token válido, renovando via refresh se perto de expirar."""
    tok = _load_tokens()
    if int(tok.get("expires_at", 0)) <= int(time.time()):
        tok = _refresh(tok["refresh_token"])
    return tok["access_token"]


def whoami() -> dict:
    """Confirma o token e identifica a conta (display_name, open_id)."""
    token = _access_token()
    fields = "open_id,union_id,display_name,avatar_url"
    url = f"{_API_BASE}/user/info/?{urllib.parse.urlencode({'fields': fields})}"
    status, payload = _http("GET", url, headers={"Authorization": f"Bearer {token}"},
                            op="user/info")
    return (payload or {}).get("data", {}).get("user", {}) if isinstance(payload, dict) else {}


# ── Upload de vídeo ──────────────────────────────────────────────────────────

@dataclass
class TikTokResult:
    publish_id: str
    status: str
    mode: str            # 'inbox' | 'direct'
    dry_run: bool


def _plan_chunks(size: int) -> tuple[int, int]:
    """Define (chunk_size, total_chunk_count). Vídeo <=64MB vai em 1 chunk."""
    if size <= _SINGLE_CHUNK_MAX:
        return size, 1
    chunk = _CHUNK_MAX
    total = size // chunk  # último chunk leva o resto (pode ser maior que chunk)
    return chunk, max(total, 1)


def _upload_chunks(upload_url: str, data: bytes, chunk_size: int, total: int) -> None:
    size = len(data)
    for i in range(total):
        start = i * chunk_size
        # último chunk vai até o fim (absorve o resto)
        end = size - 1 if i == total - 1 else start + chunk_size - 1
        blob = data[start:end + 1]
        headers = {
            "Content-Type": "video/mp4",
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(len(blob)),
        }
        _http("PUT", upload_url, headers=headers, data=blob, op=f"upload chunk {i+1}/{total}")


def _status(publish_id: str) -> dict:
    token = _access_token()
    payload = _post_json("/post/publish/status/fetch/", {"publish_id": publish_id},
                         token=token, op="status/fetch")
    return payload.get("data", {})


def _wait_publish(publish_id: str, *, until: tuple[str, ...], max_wait: int = _POLL_MAX_WAIT) -> str:
    deadline = time.time() + max_wait
    last = ""
    while time.time() < deadline:
        st = _status(publish_id)
        code = st.get("status", "")
        last = code
        if code in until:
            return code
        if code in ("FAILED",):
            raise TikTokError(200, st, f"publish {publish_id} FAILED")
        time.sleep(_POLL_SECONDS)
    raise TikTokError(408, {"last_status": last}, f"publish {publish_id} não concluiu em {max_wait}s")


def post_video_bytes(data: bytes, *, draft: bool = True, title: str = "",
                     privacy_level: str = "SELF_ONLY") -> TikTokResult:
    """
    Publica um vídeo (bytes) no TikTok.

    draft=True  → vai pros rascunhos/inbox (scope video.upload, sem auditoria).
    draft=False → direct post (scope video.publish). App não auditado só posta
                  SELF_ONLY; pra público (PUBLIC_TO_EVERYONE) o app precisa ter
                  passado pela auditoria do TikTok.
    """
    CONFIG.require_tiktok()
    size = len(data)
    chunk_size, total = _plan_chunks(size)
    mode = "inbox" if draft else "direct"

    if CONFIG.dry_run:
        return TikTokResult(publish_id=f"DRYRUN:{mode}:{size}b", status="DRY_RUN",
                            mode=mode, dry_run=True)

    token = _access_token()
    source_info = {
        "source": "FILE_UPLOAD",
        "video_size": size,
        "chunk_size": chunk_size,
        "total_chunk_count": total,
    }
    if draft:
        init = _post_json("/post/publish/inbox/video/init/",
                          {"source_info": source_info}, token=token, op="inbox/init")
    else:
        post_info = {"title": title, "privacy_level": privacy_level}
        init = _post_json("/post/publish/video/init/",
                          {"post_info": post_info, "source_info": source_info},
                          token=token, op="direct/init")
    d = init.get("data", {})
    publish_id, upload_url = d.get("publish_id"), d.get("upload_url")
    if not publish_id or not upload_url:
        raise TikTokError(200, init, "init sem publish_id/upload_url")

    _upload_chunks(upload_url, data, chunk_size, total)

    # inbox: espera cair na caixa do usuário; direct: espera publicar
    until = ("SEND_TO_USER_INBOX",) if draft else ("PUBLISH_COMPLETE",)
    final = _wait_publish(publish_id, until=until)
    return TikTokResult(publish_id=publish_id, status=final, mode=mode, dry_run=False)


def post_video_file_id(file_id: str, *, draft: bool = True, title: str = "",
                       privacy_level: str = "SELF_ONLY") -> TikTokResult:
    """Baixa o vídeo do Drive (reaproveita drive.download_bytes) e posta no TikTok."""
    from agente import drive
    data = drive.download_bytes(file_id)
    return post_video_bytes(data, draft=draft, title=title, privacy_level=privacy_level)


# ── CLI ──────────────────────────────────────────────────────────────────────

def _cli() -> int:
    ap = argparse.ArgumentParser(description="TikTok Content Posting API")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("auth-url", help="imprime o link de autorização OAuth")
    pe = sub.add_parser("exchange", help="troca o code do OAuth por tokens")
    pe.add_argument("--code", required=True)
    sub.add_parser("refresh", help="renova o access_token via refresh_token")
    sub.add_parser("whoami", help="confirma token + identifica a conta")
    pu = sub.add_parser("upload", help="envia um vídeo local")
    pu.add_argument("--file", required=True)
    pu.add_argument("--direct", action="store_true", help="direct post (default: rascunho/inbox)")
    pu.add_argument("--title", default="")
    pu.add_argument("--privacy", default="SELF_ONLY",
                    help="só p/ --direct: SELF_ONLY | PUBLIC_TO_EVERYONE | ...")
    args = ap.parse_args()

    print(f"DRY_RUN={CONFIG.dry_run}")
    try:
        if args.cmd == "auth-url":
            print("Abra na conta TikTok da Turbo e autorize:\n")
            print(authorize_url())
            print("\nDepois pegue o ?code=... da URL de retorno e rode: "
                  "python3 -m agente.tiktok exchange --code <CODE>")
            return 0
        if args.cmd == "exchange":
            tok = exchange_code(args.code)
            print(f"✅ tokens salvos. open_id={tok.get('open_id')} scope={tok.get('scope')}")
            return 0
        if args.cmd == "refresh":
            tok = _refresh(_load_tokens()["refresh_token"])
            print(f"✅ access_token renovado (expira em ~{tok.get('expires_in')}s)")
            return 0
        if args.cmd == "whoami":
            u = whoami()
            print(f"✅ conta: {u.get('display_name','?')}  open_id={u.get('open_id','?')}")
            return 0
        if args.cmd == "upload":
            with open(args.file, "rb") as f:
                data = f.read()
            res = post_video_bytes(data, draft=not args.direct, title=args.title,
                                   privacy_level=args.privacy)
            print(f"✅ modo={res.mode} publish_id={res.publish_id} status={res.status}")
            if res.mode == "inbox" and not res.dry_run:
                print("   → abra o TikTok, toque na notificação do rascunho e publique.")
            return 0
    except (TikTokError, RuntimeError) as e:
        print(f"❌ {e}")
        return 1
    ap.error("comando desconhecido")
    return 2


if __name__ == "__main__":
    sys.exit(_cli())
