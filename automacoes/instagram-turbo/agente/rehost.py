"""
Re-host de mídia: Drive (privado) → GCS (privado) → V4 signed URL.

Por quê: a Meta baixa image_url/video_url ANONIMAMENTE, mas a mídia no Drive
é restrita ao domínio (uc?export=download cai na tela de login do Google). Aqui
a service account baixa os bytes do Drive e sobe num bucket GCS privado; o que
entregamos pra Meta é uma V4 signed URL (válida ~1h). O bucket NUNCA fica
público e a URL expira sozinha — a Meta só precisa de acesso no instante em
que cria o container.

Zero dependência externa: HTTP via urllib, assinatura RSA-SHA256 via openssl
(reaproveita _sign_rs256 / _load_service_account / _get_access_token do
drive.py). A assinatura V4 do GCS é GOOG4-RSA-SHA256 — ou seja RSA-SHA256,
exatamente o que o drive.py já faz pra montar o JWT da service account.

Pré-requisitos (uma vez, feito por um admin do projeto GCP):
  - bucket GCS privado criado            → GCS_REHOST_BUCKET no .env
  - SA com roles/storage.objectAdmin NESSE bucket (não no projeto)

A SA precisa do papel pra (a) subir objetos e (b) assinar signed URLs de
leitura válidas (a signed URL herda a permissão de quem assina).

CLI pra teste isolado (antes de plugar no agente):
    python3 -m agente.rehost verify
        # sobe um healthcheck, gera signed URL, baixa anônimo — prova a cadeia
    python3 -m agente.rehost rehost --file-id <DRIVE_ID> [--mime image/jpeg]
        # re-hospeda 1 arquivo do Drive e imprime a signed URL
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from agente import drive
from agente.config import CONFIG

_GCS_HOST = "storage.googleapis.com"
_GCS_BASE = f"https://{_GCS_HOST}"
_UPLOAD_BASE = f"{_GCS_BASE}/upload/storage/v1/b"
_STORAGE_BASE = f"{_GCS_BASE}/storage/v1/b"

# Extensão por mime — Meta infere o tipo pela URL/Content-Type.
_MIME_EXT = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4", "video/quicktime": ".mov", "video/x-m4v": ".m4v",
}


def _ext_for(mime: str, filename: str = "") -> str:
    """Extensão pro objeto: prioriza a do nome original, senão deriva do mime."""
    if filename and "." in filename:
        return filename[filename.rfind("."):].lower()
    return _MIME_EXT.get((mime or "").lower(), "")


def _quote(s: str) -> str:
    """Percent-encode RFC3986 (mantém -_.~, encoda '/')."""
    return urllib.parse.quote(s, safe="")


def _encode_object(object_name: str) -> str:
    """Encoda cada segmento do objeto preservando as '/' (pro canonical URI)."""
    return "/".join(_quote(seg) for seg in object_name.split("/"))


def _bucket(bucket: str | None = None) -> str:
    if bucket:
        return bucket
    CONFIG.require_rehost()
    return CONFIG.gcs_rehost_bucket


# ── GCS: stat / upload ─────────────────────────────────────────────────────

def object_exists(object_name: str, bucket: str | None = None) -> bool:
    """True se o objeto já existe no bucket (usado pra idempotência)."""
    bucket = _bucket(bucket)
    token = drive._get_access_token()
    url = f"{_STORAGE_BASE}/{_quote(bucket)}/o/{_quote(object_name)}?fields=name"
    req = urllib.request.Request(
        url, method="GET", headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        body = e.read().decode(errors="replace")[:300]
        raise RuntimeError(f"GCS stat {e.code} em {object_name}: {body}") from e


def upload_object(object_name: str, data: bytes, content_type: str,
                  bucket: str | None = None) -> dict:
    """Sobe bytes pro bucket (upload simples). Retorna a metadata do objeto."""
    bucket = _bucket(bucket)
    token = drive._get_access_token()
    qs = urllib.parse.urlencode({"uploadType": "media", "name": object_name})
    url = f"{_UPLOAD_BASE}/{_quote(bucket)}/o?{qs}"
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type or "application/octet-stream",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:400]
        raise RuntimeError(f"GCS upload {e.code} de {object_name}: {body}") from e


# ── V4 signed URL (offline, só com a chave privada da SA) ──────────────────

def v4_signed_url(object_name: str, expires: int = 3600, method: str = "GET",
                  bucket: str | None = None) -> str:
    """
    Gera uma V4 signed URL (GOOG4-RSA-SHA256) pra `object_name`.

    100% offline: não chama a API, só assina com a chave privada da SA via
    openssl. A URL dá acesso anônimo por `expires` segundos (máx. 7 dias).
    """
    bucket = _bucket(bucket)
    if not (1 <= expires <= 604800):
        raise ValueError("expires deve estar entre 1 e 604800s (7 dias)")

    creds = drive._load_service_account()
    client_email = creds["client_email"]
    private_key = creds["private_key"]

    now = time.gmtime()
    request_ts = time.strftime("%Y%m%dT%H%M%SZ", now)
    datestamp = time.strftime("%Y%m%d", now)
    credential_scope = f"{datestamp}/auto/storage/goog4_request"
    credential = f"{client_email}/{credential_scope}"

    canonical_uri = f"/{_quote(bucket)}/{_encode_object(object_name)}"
    signed_headers = "host"
    canonical_headers = f"host:{_GCS_HOST}\n"

    query = {
        "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
        "X-Goog-Credential": credential,
        "X-Goog-Date": request_ts,
        "X-Goog-Expires": str(expires),
        "X-Goog-SignedHeaders": signed_headers,
    }
    canonical_query = "&".join(
        f"{_quote(k)}={_quote(query[k])}" for k in sorted(query)
    )

    canonical_request = "\n".join([
        method,
        canonical_uri,
        canonical_query,
        canonical_headers,   # já termina em \n → o join cria a linha em branco
        signed_headers,
        "UNSIGNED-PAYLOAD",
    ])
    hashed_request = hashlib.sha256(canonical_request.encode()).hexdigest()
    string_to_sign = "\n".join([
        "GOOG4-RSA-SHA256",
        request_ts,
        credential_scope,
        hashed_request,
    ])
    signature = drive._sign_rs256(private_key, string_to_sign.encode()).hex()
    return f"{_GCS_BASE}{canonical_uri}?{canonical_query}&X-Goog-Signature={signature}"


# ── API pública ────────────────────────────────────────────────────────────

def rehost_file_id(file_id: str, *, mime: str = "", filename: str = "",
                   expires: int = 3600, bucket: str | None = None) -> str:
    """
    Re-hospeda 1 arquivo do Drive e devolve uma signed URL que a Meta baixa.

    Idempotente: o objeto tem nome estável (`ig/<file_id><ext>`); se já existe
    no bucket, pula download+upload e só re-assina (re-rodar não duplica nem
    re-baixa). Objetos são transientes — a lifecycle do bucket os apaga.
    """
    bucket = _bucket(bucket)
    object_name = f"ig/{file_id}{_ext_for(mime, filename)}"
    if not object_exists(object_name, bucket):
        data = drive.download_bytes(file_id)
        upload_object(object_name, data, mime or "application/octet-stream", bucket)
    return v4_signed_url(object_name, expires=expires, bucket=bucket)


# ── CLI ────────────────────────────────────────────────────────────────────

def _cli() -> int:
    ap = argparse.ArgumentParser(description="Re-host Drive→GCS com V4 signed URL")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("verify", help="sobe healthcheck + signed URL + download anônimo")

    pr = sub.add_parser("rehost", help="re-hospeda 1 arquivo do Drive")
    pr.add_argument("--file-id", required=True)
    pr.add_argument("--mime", default="")
    pr.add_argument("--filename", default="")
    pr.add_argument("--expires", type=int, default=3600)

    args = ap.parse_args()

    try:
        bucket = _bucket()
    except RuntimeError as e:
        print(f"❌ {e}")
        return 2
    print(f"bucket: {bucket}   SA: {drive._load_service_account().get('client_email','?')}")

    if args.cmd == "verify":
        obj = "__rehost_healthcheck__.txt"
        try:
            upload_object(obj, b"ok-rehost", "text/plain", bucket)
            url = v4_signed_url(obj, expires=300, bucket=bucket)
            with urllib.request.urlopen(url, timeout=30) as r:
                body = r.read()
        except (RuntimeError, urllib.error.HTTPError, urllib.error.URLError) as e:
            print(f"❌ falhou: {e}")
            print("   (checa se o bucket existe e se a SA tem roles/storage.objectAdmin nele)")
            return 1
        if body == b"ok-rehost":
            print("✅ end-to-end OK: upload + signed URL + download anônimo funcionam")
            print("   → a Meta conseguiria baixar a mídia por esse caminho")
            return 0
        print(f"⚠️  baixou, mas conteúdo inesperado: {body[:50]!r}")
        return 1

    if args.cmd == "rehost":
        try:
            url = rehost_file_id(
                args.file_id, mime=args.mime, filename=args.filename,
                expires=args.expires, bucket=bucket,
            )
        except RuntimeError as e:
            print(f"❌ {e}")
            return 1
        print("✅ signed URL (válida por", args.expires, "s):")
        print(url)
        return 0

    ap.error("comando desconhecido")
    return 2


if __name__ == "__main__":
    sys.exit(_cli())
