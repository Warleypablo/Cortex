"""Retry das chamadas ao Cortex: trava http_retry.fetch — a cura dos beats perdidos.

Garante que timeout/5xx retenta (até ATTEMPTS), 4xx NÃO retenta, e a última
exceção propaga quando tudo falha (o fail-soft fica nos call-sites).
Roda standalone: python3 -m agente.tests.test_http_retry
"""
import io
import urllib.error
import urllib.request

from agente import http_retry

_REQ = urllib.request.Request("https://cortex.exemplo/api/x")


class _Resp:
    status = 200

    def read(self):
        return b'{"ok": true}'

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _http_error(code):
    return urllib.error.HTTPError("u", code, "err", {}, io.BytesIO(b""))


def _com_urlopen_fake(respostas, fn):
    """Roda fn com urlopen que devolve/levanta cada item de `respostas` em ordem.
    Retorna (resultado_ou_excecao, chamadas)."""
    chamadas = []
    orig_open, orig_sleep = urllib.request.urlopen, http_retry.time.sleep

    def fake_urlopen(req, timeout=None):
        chamadas.append(timeout)
        item = respostas[min(len(chamadas) - 1, len(respostas) - 1)]
        if isinstance(item, Exception):
            raise item
        return item

    urllib.request.urlopen = fake_urlopen
    http_retry.time.sleep = lambda s: None  # sem esperar de verdade no teste
    try:
        try:
            return fn(), chamadas
        except Exception as e:  # noqa: BLE001
            return e, chamadas
    finally:
        urllib.request.urlopen = orig_open
        http_retry.time.sleep = orig_sleep


def test_sucesso_na_primeira():
    out, chamadas = _com_urlopen_fake([_Resp()], lambda: http_retry.fetch(_REQ))
    assert out == (200, b'{"ok": true}')
    assert len(chamadas) == 1
    assert chamadas[0] == http_retry.TIMEOUT  # usa o timeout novo, não os 15s antigos


def test_timeout_retenta_e_passa():
    out, chamadas = _com_urlopen_fake(
        [TimeoutError("read timed out"), _Resp()], lambda: http_retry.fetch(_REQ)
    )
    assert out == (200, b'{"ok": true}')
    assert len(chamadas) == 2


def test_5xx_retenta_e_passa():
    out, chamadas = _com_urlopen_fake(
        [_http_error(503), _Resp()], lambda: http_retry.fetch(_REQ)
    )
    assert out[0] == 200
    assert len(chamadas) == 2


def test_4xx_nao_retenta():
    out, chamadas = _com_urlopen_fake([_http_error(401)], lambda: http_retry.fetch(_REQ))
    assert isinstance(out, urllib.error.HTTPError) and out.code == 401
    assert len(chamadas) == 1  # config/auth errada não melhora repetindo


def test_esgotou_tentativas_propaga_ultima_excecao():
    out, chamadas = _com_urlopen_fake(
        [TimeoutError("read timed out")], lambda: http_retry.fetch(_REQ)
    )
    assert isinstance(out, TimeoutError)
    assert len(chamadas) == http_retry.ATTEMPTS


def test_get_do_panel_client_usa_o_retry_e_segue_fail_soft():
    # ponta-a-ponta do call-site: com Cortex fora, _get devolve None (fail-soft)
    # depois de esgotar as tentativas — e com Cortex ok, parseia o JSON.
    import dataclasses

    from agente import panel_client
    orig_cfg = panel_client.CONFIG  # Config é frozen → troca a referência do módulo
    panel_client.CONFIG = dataclasses.replace(
        orig_cfg,
        cortex_ingest_url="https://cortex.exemplo/api/ingest",
        organico_ingest_token="tok",
    )
    try:
        out, chamadas = _com_urlopen_fake(
            [TimeoutError("read timed out")], lambda: panel_client._get("/posts/due")
        )
        assert out is None and len(chamadas) == http_retry.ATTEMPTS
        out, _ = _com_urlopen_fake([_Resp()], lambda: panel_client._get("/posts/due"))
        assert out == {"ok": True}
    finally:
        panel_client.CONFIG = orig_cfg


if __name__ == "__main__":
    import sys
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    falhas = 0
    for fn in fns:
        try:
            fn()
            print(f"  ✅ {fn.__name__}")
        except AssertionError as e:
            falhas += 1
            print(f"  ❌ {fn.__name__}: {e}")
    print("\n🎉 Todos os testes passaram." if not falhas else f"\n💥 {falhas} falharam.")
    sys.exit(1 if falhas else 0)
