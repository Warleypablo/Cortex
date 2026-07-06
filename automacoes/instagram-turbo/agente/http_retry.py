"""
Retry fino pras chamadas HTTP do worker ao Cortex (urllib puro, zero dependência).

Motivação (06/jul/2026, logs da Render): fora do horário comercial o Cortex de
prod às vezes demora >15s pra responder (pool do banco frio sem tráfego) e o
worker estourava o timeout de 15s nas TRÊS chamadas do ciclo (GET /posts/due,
GET /commands/pending e POST /ingest). Como tudo é fail-soft, o beat "passava em
branco": telemetria perdida e — em modo publish — post adiado pro beat seguinte.

A cura é boba: timeout maior + tentar de novo. A 1ª chamada "acorda" o Cortex,
a 2ª responde rápido.

USO RESTRITO a chamadas IDEMPOTENTES (GETs e o POST /ingest, que é upsert).
claim e ack ficam de fora DE PROPÓSITO: claim é fail-closed contra post duplicado
e um retry ali mascararia essa semântica.
"""
from __future__ import annotations
import time
import urllib.error
import urllib.request

TIMEOUT = 30.0          # segundos por tentativa (o inline antigo era 15)
ATTEMPTS = 3
BACKOFFS = (2.0, 5.0)   # espera antes da 2ª e da 3ª tentativa


def fetch(req: urllib.request.Request, *, what: str = "") -> tuple[int, bytes]:
    """urlopen + read com retry. Retorna (status, corpo).

    Retenta em timeout/erro de rede/HTTP 5xx (transientes). HTTP 4xx NÃO
    retenta (config/auth errada não melhora repetindo) — propaga na hora.
    Esgotadas as tentativas, levanta a última exceção: quem chama decide o
    fail-soft (os call-sites já têm try/except com log).
    """
    last: Exception | None = None
    for attempt in range(ATTEMPTS):
        if attempt:
            time.sleep(BACKOFFS[min(attempt - 1, len(BACKOFFS) - 1)])
            print(f"   🔁 painel: tentativa {attempt + 1}/{ATTEMPTS} {what}".rstrip())
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500:
                raise
            last = e
        except Exception as e:  # noqa: BLE001 — timeout, URLError, reset…
            last = e
    assert last is not None
    raise last
