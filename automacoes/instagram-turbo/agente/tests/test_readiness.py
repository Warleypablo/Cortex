"""Prontidão por card (Fase 1): trava panel_readiness — o veredito AUTORITATIVO do worker.

Garante que 'ready' só sai quando o post realmente vai (conteúdo + horário), que os
block_reasons batem com o que falta, e que dry-run (estado global) NÃO entra como bloqueio
do card. Roda standalone: python3 -m agente.tests.test_readiness
"""
from types import SimpleNamespace as NS

from agente.state_sink import panel_readiness

_BASE = dict(
    already_posted=False, legenda_empty=False, legenda_source="doc",
    asset_count=1, tipo_post="reels", oauth_pending=False, error=None,
    skip_reason=None, scheduled_at="2026-06-28T14:00:00-03:00",
)


def _p(**k):
    return NS(**{**_BASE, **k})


def test_ready_quando_tudo_ok():
    assert panel_readiness(_p()) == ("ready", [])


def test_published_quando_ja_postado():
    assert panel_readiness(_p(already_posted=True)) == ("published", [])


def test_blocked_legenda():
    assert panel_readiness(_p(legenda_empty=True)) == ("blocked", ["legenda"])
    assert panel_readiness(_p(legenda_source="ia")) == ("blocked", ["legenda"])


def test_blocked_midia():
    assert panel_readiness(_p(asset_count=0)) == ("blocked", ["midia"])
    assert panel_readiness(_p(tipo_post="empty")) == ("blocked", ["midia"])


def test_blocked_horario():
    assert panel_readiness(_p(scheduled_at=None)) == ("blocked", ["horario"])


def test_blocked_acumula_motivos():
    r, reasons = panel_readiness(_p(legenda_empty=True, asset_count=0, scheduled_at=None))
    assert r == "blocked"
    assert reasons == ["legenda", "midia", "horario"]


def test_dry_run_nao_e_bloqueio_por_card():
    # dry-run é estado GLOBAL (vem no run/settings) → NÃO entra no readiness do card. Mesmo
    # com o agente em dry-run (CONFIG.dry_run=True, default do .env), conteúdo+horário ok = 'ready'.
    assert panel_readiness(_p()) == ("ready", [])


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
