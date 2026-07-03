"""
Wrapper read-only do ClickUp.

IMPORTANTE: Este módulo NÃO tem funções de escrita (update, create, delete).
Qualquer operação que mude estado no ClickUp precisa ser adicionada
explicitamente em outro módulo (escrita_clickup.py) e ativada só após
permissão da usuária.
"""
from __future__ import annotations
import json
import re
import urllib.parse
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Iterator

from agente.config import CONFIG

try:
    from zoneinfo import ZoneInfo
    # A "Data de Postagem" do ClickUp é escolhida no fuso do workspace (Turbo =
    # São Paulo). O epoch é tz-agnóstico; pra recuperar a data-calendário que a
    # pessoa marcou, renderizamos em America/Sao_Paulo. Ler em UTC empurra posts
    # da noite (>21h BRT) pro dia seguinte — bug que escondia posts do dia.
    _TZ_POSTAGEM: Any = ZoneInfo("America/Sao_Paulo")
except Exception:  # noqa: BLE001 — fallback pro fuso local da máquina
    _TZ_POSTAGEM = None

API_BASE = "https://api.clickup.com/api/v2"


# Aceita os formatos que a cardista digita num campo de TEXTO: "14:00", "14h",
# "14h30", "14", "9:5" (→09:05), "14h00", "18:30 às ..." (pega o primeiro).
# O separador é OBRIGATÓRIO pra ter minutos, senão "830" viraria (8,30) por engano.
_HHMM_RE = re.compile(r"(\d{1,2})(?:\s*[:hH.]\s*(\d{1,2}))?")


def parse_hhmm(s: str) -> tuple[int, int] | None:
    """'14h30' → (14, 30). None se não der pra ler uma hora válida (0–23h, 0–59m)."""
    if not s:
        return None
    m = _HHMM_RE.search(s.strip())
    if not m:
        return None
    h = int(m.group(1))
    mm = int(m.group(2)) if m.group(2) else 0
    if 0 <= h <= 23 and 0 <= mm <= 59:
        return h, mm
    return None


def _get(path: str, params: dict | None = None) -> dict:
    CONFIG.require_clickup()
    url = f"{API_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": CONFIG.clickup_api_token,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:500]
        raise RuntimeError(f"ClickUp {e.code} em GET {path}: {body}") from e


@dataclass
class Task:
    id: str
    name: str
    status: str
    parent_id: str | None
    description: str
    custom_fields: dict[str, Any]
    subtasks: list[dict]
    raw: dict = field(repr=False)

    @classmethod
    def from_api(cls, t: dict) -> "Task":
        cf = {}
        for f in t.get("custom_fields", []):
            val = f.get("value")
            if val not in (None, "", [], {}):
                cf[f.get("name", "")] = val
        return cls(
            id=t["id"],
            name=t.get("name", ""),
            status=(t.get("status") or {}).get("status", ""),
            parent_id=t.get("parent"),
            description=t.get("description") or "",
            custom_fields=cf,
            subtasks=t.get("subtasks") or [],
            raw=t,
        )

    def _cf(self, name: str) -> Any:
        """Lê um custom field por nome, tolerando diferença de caixa/espaços.

        O dict do ClickUp é keyed pelo nome EXATO do campo, e o nome real diverge
        do esperado (ex.: "Data de postagem" com p minúsculo). Match exato primeiro,
        depois case-insensitive.
        """
        if name in self.custom_fields:
            return self.custom_fields[name]
        low = name.strip().lower()
        for k, v in self.custom_fields.items():
            if k.strip().lower() == low:
                return v
        return None

    def _dropdown_label(self, name: str) -> str | None:
        """Label ('name') da opção selecionada de um custom field drop_down.

        Resolve via `type_config.options` do raw (não do dict simplificado
        `custom_fields`, que só guarda o valor). O `value` do ClickUp para
        drop_down vem como o orderindex (int) ou, em algumas versões da API,
        como o id (str) da opção — toleramos os dois pra não depender de um
        índice hardcoded que quebraria se reordenarem o dropdown. None se o
        campo não existe, está vazio, ou a opção não é encontrada.
        """
        low = name.strip().lower()
        for f in self.raw.get("custom_fields", []):
            if (f.get("name") or "").strip().lower() != low:
                continue
            val = f.get("value")
            if val in (None, ""):
                return None
            opts = (f.get("type_config") or {}).get("options") or []
            for o in opts:                                  # match por id (str)
                if str(o.get("id")) == str(val):
                    return o.get("name")
            try:                                            # match por orderindex (int)
                idx = int(val)
            except (TypeError, ValueError):
                return None
            for o in opts:
                if o.get("orderindex") == idx:
                    return o.get("name")
            if 0 <= idx < len(opts):                        # fallback: posição na lista
                return opts[idx].get("name")
            return None
        return None

    def formato_post_label(self) -> str | None:
        """Label do dropdown 'Formato do post' do card (ex.: 'REELS',
        'CARROSSEL', 'IMG ÚNICA'), ou None se não preenchido.

        É o formato QUE A CARDISTA declarou — fonte da verdade pra decidir
        reels/carrossel/single, acima da inferência por contagem de arquivos
        no Drive (drive.classify_assets). Ver drive.declared_tipo_from_label.
        """
        return self._dropdown_label(CONFIG.formato_field)

    def posting_date(self) -> date | None:
        """
        Lê o custom field de data (CONFIG.posting_date_field, default 'Data de
        postagem') — epoch ms — e retorna a data-calendário no fuso de São Paulo
        (o fuso em que a pessoa marca a data no ClickUp). None se ausente/inválido.

        ATENÇÃO: usar UTC aqui empurra posts agendados à noite (>21h BRT) pro dia
        seguinte — bug corrigido em 2026-06-08. Usa America/Sao_Paulo (ou fuso
        local da máquina como fallback).
        """
        val = self._cf(CONFIG.posting_date_field)
        if val in (None, ""):
            return None
        try:
            ms = int(val)
        except (TypeError, ValueError):
            return None
        if _TZ_POSTAGEM is not None:
            return datetime.fromtimestamp(ms / 1000, tz=_TZ_POSTAGEM).date()
        return datetime.fromtimestamp(ms / 1000).date()  # fallback: fuso local

    def posting_time(self) -> str | None:
        """Horário EXPLÍCITO do card, 'HH:MM'. Duas fontes, nesta ordem:

        1) a HORA embutida no próprio campo 'Data de postagem' — é o novo padrão do
           time, que usa o time picker do ClickUp (a data já vem com hora, ex.:
           2026-06-29 11:00). Lida no MESMO fuso de posting_date (São Paulo).
           00:00 conta como "sem hora" (date picker puro, sem time) → cai no fallback.
        2) [legado] um campo de TEXTO separado 'Horário' (CONFIG.horario_field), se
           existir e estiver preenchido.

        None quando nenhuma traz hora — aí scheduled_datetime() NÃO agenda (o card
        fica em 'aprovado' esperando alguém definir a hora).
        """
        # (1) hora dentro do 'Data de postagem' (mesmo timestamp/fuso de posting_date)
        dtv = self._cf(CONFIG.posting_date_field)
        if dtv not in (None, ""):
            try:
                ms = int(dtv)
            except (TypeError, ValueError):
                ms = None
            if ms is not None:
                dt = (datetime.fromtimestamp(ms / 1000, tz=_TZ_POSTAGEM)
                      if _TZ_POSTAGEM is not None else datetime.fromtimestamp(ms / 1000))
                if (dt.hour, dt.minute) != (0, 0):  # 00:00 = data sem hora (date picker puro)
                    return f"{dt.hour:02d}:{dt.minute:02d}"
        # (2) legado: campo de texto separado 'Horário'
        val = self._cf(CONFIG.horario_field)
        if val not in (None, ""):
            hm = parse_hhmm(str(val))
            if hm:
                return f"{hm[0]:02d}:{hm[1]:02d}"
        return None

    def scheduled_datetime(self) -> datetime | None:
        """Data + horário do card combinados, tz-aware (America/Sao_Paulo), ou None.

        EXIGE Horário explícito no card. Sem Horário (ou sem Data) NÃO agenda
        (retorna None) — de propósito: um horário padrão faria todo post sem hora
        cair no mesmo minuto e colidir. Posts sem horário ficam em 'aprovado'
        esperando alguém definir a hora (no card ou via "Agendar").
        """
        d = self.posting_date()
        if d is None:
            return None
        t = self.posting_time()
        if not t:
            return None
        hm = parse_hhmm(t)
        if not hm:
            return None
        if _TZ_POSTAGEM is not None:
            return datetime(d.year, d.month, d.day, hm[0], hm[1], tzinfo=_TZ_POSTAGEM)
        return datetime(d.year, d.month, d.day, hm[0], hm[1])  # naive: fuso local


@dataclass
class Comment:
    id: str
    text: str
    user: str


def list_approved_tasks(list_id: str | None = None) -> list[Task]:
    """
    Retorna tasks filhas (posts) com status=aprovado na lista informada.
    Default = lista Instagram 📷 (comportamento original, intocado). O TikTok
    passa sua própria lista via `list_id` — ver agente/main_tiktok.py.
    Ignora tasks pai ('Social Media - <MÊS>') e tasks sem parent.
    """
    lid = list_id or CONFIG.clickup_list_id_instagram
    tasks: list[Task] = []
    page = 0
    while True:
        r = _get(
            f"/list/{lid}/task",
            {"subtasks": "true", "include_closed": "false", "page": page},
        )
        batch = r.get("tasks", [])
        if not batch:
            break
        tasks.extend(Task.from_api(t) for t in batch)
        if len(batch) < 100:
            break
        page += 1
        if page > 30:
            break  # sanity
    # Filtro: status=aprovado E tem parent (é subtask de Social Media - MÊS)
    return [t for t in tasks if t.status.lower() == "aprovado" and t.parent_id]


def get_task(task_id: str) -> Task:
    r = _get(f"/task/{task_id}", {"include_subtasks": "true"})
    return Task.from_api(r)


def get_comments(task_id: str) -> list[Comment]:
    r = _get(f"/task/{task_id}/comment")
    return [
        Comment(
            id=c.get("id", ""),
            text=c.get("comment_text") or "",
            user=(c.get("user") or {}).get("username", ""),
        )
        for c in r.get("comments", [])
    ]


# --- parser de descrição ---

_TURBO_RE = re.compile(
    r"ID\s*\(Suba no Drive com este nome\)\s*[:\-]\s*(TURBO_[A-Za-z0-9_]+)",
    re.IGNORECASE,
)
_FORMATO_RE = re.compile(r"Formato\s*[:\-]\s*([^\n]+)", re.IGNORECASE)
_CRIATIVO_RE = re.compile(r"Criativo\s*[:\-]\s*([^\n]+)", re.IGNORECASE)

# Link do Google Doc da legenda, dentro do campo "Copy:" da descrição.
# A legenda NÃO vem do Doc mensal "SOCIAL MEDIA TURBO [MÊS]" (esse padrão
# não é usado em todos os meses) — cada card aponta o próprio Doc de copy
# via hyperlink. As URLs só aparecem no markdown_description (a `description`
# plana descarta os links), por isso `caption_doc_id` busca o markdown.
_COPY_DOC_RE = re.compile(
    # A barra invertida no char class tolera o escape de markdown do ClickUp:
    # underscores em URLs vêm como `\_` no markdown_description, o que truncava
    # o ID. Capturamos com a barra e removemos depois (Doc IDs só usam [A-Za-z0-9_-]).
    r"Copy[^\n]*?https://docs\.google\.com/document/d/([A-Za-z0-9_\\-]+)",
    re.IGNORECASE,
)


def caption_doc_id(task_id: str) -> str | None:
    """doc_id do Google Doc linkado no campo 'Copy:' do card, ou None.

    Faz uma chamada extra pedindo `include_markdown_description` porque a
    descrição padrão não preserva URLs de hyperlink. O ClickUp escapa `_`
    como `\\_` no markdown, então removemos as barras invertidas do ID.
    """
    r = _get(f"/task/{task_id}", {"include_markdown_description": "true"})
    md = r.get("markdown_description") or ""
    m = _COPY_DOC_RE.search(md.replace("\xa0", " "))
    return m.group(1).replace("\\", "") if m else None


@dataclass
class ParsedDescription:
    turbo_slug: str | None
    formato: str | None
    criativo: str | None
    is_template_placeholder: bool

    @property
    def turbo_folder_name(self) -> str | None:
        return self.turbo_slug


def parse_description(desc: str) -> ParsedDescription:
    desc = desc.replace("\xa0", " ")  # nbsp → space
    turbo = _TURBO_RE.search(desc)
    formato = _FORMATO_RE.search(desc)
    criativo = _CRIATIVO_RE.search(desc)
    turbo_val = turbo.group(1) if turbo else None
    return ParsedDescription(
        turbo_slug=turbo_val,
        formato=formato.group(1).strip() if formato else None,
        criativo=criativo.group(1).strip() if criativo else None,
        is_template_placeholder=turbo_val == "TURBO_xpto",
    )


_NUM_TO_MES = [
    "", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
]


def extract_month_from_parent_name(parent_name: str, fallback_date=None) -> str | None:
    """
    'Social Media - ABRIL' → 'ABRIL'
    'Social Media Turbo - MAIO' → 'MAIO'

    Parents de evento ('Social Media - CREATOR SUMMIT', etc.) não batem no
    regex — nesse caso usa o mês de `fallback_date` (data de postagem), já
    que a convenção é guardar a pasta TURBO_<slug> dentro do mês corrente.
    """
    m = re.match(r"Social Media.*?-\s*([A-ZÇÃÕÁÉÍÓÚÂÊÔ]+)\s*$", parent_name.strip(), re.IGNORECASE)
    if m:
        cand = m.group(1).upper()
        if cand in _MES_TO_NUM:
            return cand
    if fallback_date is not None:
        return _NUM_TO_MES[fallback_date.month]
    return None


_MES_TO_NUM = {
    "JANEIRO": "01", "FEVEREIRO": "02", "MARÇO": "03", "MARCO": "03",
    "ABRIL": "04", "MAIO": "05", "JUNHO": "06", "JULHO": "07",
    "AGOSTO": "08", "SETEMBRO": "09", "OUTUBRO": "10",
    "NOVEMBRO": "11", "DEZEMBRO": "12",
}


def mes_to_num(mes: str) -> str | None:
    return _MES_TO_NUM.get(mes.upper())


def mes_titled(mes: str) -> str:
    """'ABRIL' → 'Abril', 'MARÇO' → 'Março'"""
    return mes.capitalize()
