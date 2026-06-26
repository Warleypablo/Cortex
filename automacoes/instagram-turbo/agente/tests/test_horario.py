"""Horário-por-card: parser de hora + combinação data+hora da Task.

Trava (1) o parser tolerante do campo de texto "Horário", (2) a leitura do
campo de data com o nome REAL ("Data de postagem", p minúsculo) e tolerância
de caixa, e (3) a combinação data+hora em America/Sao_Paulo, com horário padrão
quando o card não preenche a hora.

Roda standalone (sem pytest):  python3 -m agente.tests.test_horario
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from agente.clickup import Task, parse_hhmm

_SP = ZoneInfo("America/Sao_Paulo")
# 25/06/2026 00:00 SP em epoch ms — como o ClickUp guarda data sem hora.
_MS_25JUN = int(datetime(2026, 6, 25, 0, 0, tzinfo=_SP).timestamp() * 1000)


def _mk(cf: dict) -> Task:
    return Task(id="x", name="n", status="aprovado", parent_id="p",
                description="", custom_fields=cf, subtasks=[], raw={})


def test_parse_hhmm_formatos_validos():
    assert parse_hhmm("14:00") == (14, 0)
    assert parse_hhmm("14h") == (14, 0)
    assert parse_hhmm("14h30") == (14, 30)
    assert parse_hhmm("14") == (14, 0)
    assert parse_hhmm("9:5") == (9, 5)        # minuto de 1 dígito
    assert parse_hhmm("  18:30 ") == (18, 30)  # trim
    assert parse_hhmm("14:00 às 18:00") == (14, 0)  # pega o primeiro
    assert parse_hhmm("23:59") == (23, 59)


def test_parse_hhmm_invalidos_viram_none():
    assert parse_hhmm("") is None
    assert parse_hhmm("abc") is None
    assert parse_hhmm("24:00") is None   # hora fora de 0–23
    assert parse_hhmm("12:99") is None   # minuto fora de 0–59
    assert parse_hhmm("99") is None
    assert parse_hhmm("830") is None     # sem separador → ambíguo, não chuta


def test_posting_date_le_campo_real_minusculo():
    # nome real do campo é "Data de postagem" (p minúsculo)
    assert _mk({"Data de postagem": _MS_25JUN}).posting_date().isoformat() == "2026-06-25"


def test_posting_date_tolera_caixa_trocada():
    # mesmo escrito "Data de Postagem" (P maiúsculo) tem que casar
    assert _mk({"Data de Postagem": _MS_25JUN}).posting_date().isoformat() == "2026-06-25"


def test_posting_time_explicito_e_vazio():
    assert _mk({"Horário": "15h30"}).posting_time() == "15:30"
    assert _mk({"horário": "8"}).posting_time() == "08:00"   # caixa + normaliza
    assert _mk({}).posting_time() is None                    # sem campo → None


def test_scheduled_datetime_combina_data_e_hora():
    t = _mk({"Data de postagem": _MS_25JUN, "Horário": "15:30"})
    dt = t.scheduled_datetime()
    assert dt == datetime(2026, 6, 25, 15, 30, tzinfo=_SP)


def test_scheduled_datetime_usa_padrao_quando_sem_hora():
    # sem Horário → horário padrão (CONFIG.horario_padrao, default 12:00)
    t = _mk({"Data de postagem": _MS_25JUN})
    assert t.scheduled_datetime() == datetime(2026, 6, 25, 12, 0, tzinfo=_SP)


def test_scheduled_datetime_none_sem_data():
    # sem data não há agendamento, mesmo com hora preenchida
    assert _mk({"Horário": "09:00"}).scheduled_datetime() is None


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
    if falhas:
        print(f"\n💥 {falhas} teste(s) falharam.")
        sys.exit(1)
    print("\n🎉 Todos os testes passaram.")
