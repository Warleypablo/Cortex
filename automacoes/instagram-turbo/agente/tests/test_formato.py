"""Formato do post: o campo 'Formato do post' do ClickUp manda sobre a
inferência por contagem de arquivos.

Trava o bug de 02/07/2026 — uma pasta com vídeo + capa (2 arquivos) fazia
classify_assets devolver 'carousel' e publicava um REELS como carrossel.
Agora o formato declarado no card prevalece.

Roda standalone (sem pytest):  python3 -m agente.tests.test_formato
"""
from agente.clickup import Task
from agente.drive import (
    DriveFile,
    classify_assets,
    declared_tipo_from_label,
    reconcile_format,
)

# opções reais do dropdown "Formato do post" (orderindex + id como o ClickUp devolve)
_OPTS = [
    {"id": "opt-reels", "name": "REELS", "orderindex": 0},
    {"id": "opt-carrossel", "name": "CARROSSEL", "orderindex": 1},
    {"id": "opt-img", "name": "IMG ÚNICA", "orderindex": 2},
    {"id": "opt-yt", "name": "YT LONGO", "orderindex": 3},
]


def _task_formato(value) -> Task:
    raw = {"custom_fields": [
        {"name": "Formato do post", "value": value, "type_config": {"options": _OPTS}},
    ]}
    return Task(id="x", name="n", status="aprovado", parent_id="p",
                description="", custom_fields={}, subtasks=[], raw=raw)


def _vid(name="video.mp4"):
    return DriveFile(id=f"id-{name}", name=name, mime_type="video/mp4", parent_id="p", size=1000)


def _img(name="capa.png"):
    return DriveFile(id=f"id-{name}", name=name, mime_type="image/png", parent_id="p", size=100)


# ── formato_post_label: resolve o label real via type_config ──────────────

def test_formato_label_por_orderindex_int():
    assert _task_formato(0).formato_post_label() == "REELS"
    assert _task_formato(1).formato_post_label() == "CARROSSEL"
    assert _task_formato(2).formato_post_label() == "IMG ÚNICA"


def test_formato_label_por_id_str():
    # algumas versões da API devolvem o id da opção em vez do orderindex
    assert _task_formato("opt-reels").formato_post_label() == "REELS"


def test_formato_label_vazio_ou_ausente_vira_none():
    assert _task_formato(None).formato_post_label() is None
    t = Task(id="x", name="n", status="aprovado", parent_id="p",
             description="", custom_fields={}, subtasks=[], raw={})
    assert t.formato_post_label() is None


# ── declared_tipo_from_label: label → tipo_post ───────────────────────────

def test_declared_tipo_mapeia_formatos_de_feed():
    assert declared_tipo_from_label("REELS") == "reels"
    assert declared_tipo_from_label("carrossel") == "carousel"   # case-insensitive
    assert declared_tipo_from_label("IMG ÚNICA") == "single"


def test_declared_tipo_fora_de_escopo_vira_none():
    assert declared_tipo_from_label("YT LONGO") is None
    assert declared_tipo_from_label(None) is None
    assert declared_tipo_from_label("") is None


# ── reconcile_format: o card manda, classify_assets é fallback ────────────

def test_reels_declarado_vence_carrossel_inferido():
    # O BUG: pasta com vídeo + capa → classify diz 'carousel'. Card diz REELS.
    assets = [_vid("victoremeg.mp4"), _img("CAPA.png")]
    tipo, chosen = classify_assets(assets)
    assert tipo == "carousel"                       # inferência crua (o bug)
    tipo2, chosen2, nota = reconcile_format("reels", tipo, chosen)
    assert tipo2 == "reels"                          # card corrige
    assert [a.name for a in chosen2] == ["victoremeg.mp4"]   # só o vídeo, ignora a capa
    assert nota and "ignora" in nota


def test_sem_declarado_mantem_inferencia():
    assets = [_vid(), _img()]
    _, chosen = classify_assets(assets)
    tipo, out, nota = reconcile_format(None, "carousel", chosen)
    assert (tipo, len(out), nota) == ("carousel", 2, None)   # fallback intacto


def test_declarado_igual_inferido_nao_mexe():
    assets = [_vid()]
    tipo, chosen = classify_assets(assets)          # 1 vídeo → reels
    tipo2, out, nota = reconcile_format("reels", tipo, chosen)
    assert (tipo2, nota) == ("reels", None)
    assert out == chosen


def test_reels_declarado_sem_video_mantem_e_avisa():
    assets = [_img("1.png"), _img("2.png")]         # nenhum vídeo
    tipo, chosen = classify_assets(assets)          # carousel
    tipo2, out, nota = reconcile_format("reels", tipo, chosen)
    assert tipo2 == "carousel"                       # não força reels sem vídeo
    assert nota and "não há vídeo" in nota


def test_single_declarado_pega_imagem():
    assets = [_img("a.png"), _img("b.png")]
    tipo, chosen = classify_assets(assets)          # carousel
    tipo2, out, nota = reconcile_format("single", tipo, chosen)
    assert tipo2 == "single" and len(out) == 1


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
