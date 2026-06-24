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

    def posting_date(self) -> date | None:
        """
        Lê o custom field 'Data de Postagem' (epoch ms) e retorna a data-calendário
        no fuso de São Paulo (o fuso em que a pessoa marca a data no ClickUp).
        None se ausente/inválido. Comparar com `date.today()` pra decidir se a
        task é do dia atual em diante.

        ATENÇÃO: usar UTC aqui empurra posts agendados à noite (>21h BRT) pro dia
        seguinte — bug corrigido em 2026-06-08. Usa America/Sao_Paulo (ou fuso
        local da máquina como fallback).
        """
        val = self.custom_fields.get("Data de Postagem")
        if val in (None, ""):
            return None
        try:
            ms = int(val)
        except (TypeError, ValueError):
            return None
        if _TZ_POSTAGEM is not None:
            return datetime.fromtimestamp(ms / 1000, tz=_TZ_POSTAGEM).date()
        return datetime.fromtimestamp(ms / 1000).date()  # fallback: fuso local


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
