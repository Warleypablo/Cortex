"""Slots de publicação (hora:minuto). Trava o comportamento do slot 17h30."""
from datetime import datetime

from agente import main


def _at(h: int, m: int) -> datetime:
    return datetime(2026, 6, 24, h, m)


def test_slot_1200_abre_na_janela_cheia():
    assert main.current_slot(_at(12, 0)) == "12h"
    assert main.current_slot(_at(12, 59)) == "12h"
    assert main.current_slot(_at(13, 0)) is None


def test_slot_1730_abre_cravado_e_segura_a_tolerancia():
    # antes de 17:30 não abre — era exatamente o bug ("não saiu às 17h30")
    assert main.current_slot(_at(17, 29)) is None
    assert main.current_slot(_at(17, 30)) == "17h30"
    assert main.current_slot(_at(18, 29)) == "17h30"  # tolerância de 60min
    assert main.current_slot(_at(18, 30)) is None


def test_fora_de_slot_descreve_onde_estamos():
    assert "abre 12h" in main.slot_status_human(_at(11, 0))
    assert "12h fechou, 17h30 abre" in main.slot_status_human(_at(15, 0))
    assert "fechou às 18:30" in main.slot_status_human(_at(19, 0))


def test_label_so_mostra_minutos_quando_existem():
    assert main._slot_label(12, 0) == "12h"
    assert main._slot_label(17, 30) == "17h30"
