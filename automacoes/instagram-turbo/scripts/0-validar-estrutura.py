#!/usr/bin/env python3
"""
Validador de estrutura da lista Instagram 📷 no ClickUp.

SOMENTE LEITURA — este script NÃO modifica nada no ClickUp.
Faz só chamadas GET para entender como as tarefas reais estão
estruturadas antes de construir a automação em cima delas.

O que ele faz:
  1. Lista as N tasks mais recentes da lista Instagram 📷
  2. Filtra apenas subtasks de "Social Media - <MÊS>" (os posts reais)
  3. Roda o MESMO parser regex que o n8n vai usar em cada descrição
  4. Confere se a subtask "copy" existe e qual o status dela
  5. Imprime relatório por task + resumo final

Uso:
  ./scripts/0-validar-estrutura.py                # padrão: 15 tasks
  ./scripts/0-validar-estrutura.py --limit 30
  ./scripts/0-validar-estrutura.py --include-closed

Requisitos:
  - Python 3.8+
  - .env com CLICKUP_API_TOKEN preenchido
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# ---------- constantes ----------

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"
LIST_ID = "901300920768"  # Instagram 📷
API = "https://api.clickup.com/api/v2"

# Heurística: posts reais são subtasks cujo parent tem nome começando com isso.
PARENT_PREFIX = "social media"

# ---------- cores terminal (ANSI) ----------

class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    CYAN = "\033[36m"
    GRAY = "\033[90m"


# ---------- carregamento do .env ----------

def load_env() -> None:
    if not ENV_FILE.exists():
        print(f"{C.RED}❌ .env não encontrado em {ENV_FILE}{C.RESET}", file=sys.stderr)
        print("Copie .env.example → .env e preencha CLICKUP_API_TOKEN.", file=sys.stderr)
        sys.exit(1)
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip()
        # Remove aspas se tiver
        if v and v[0] == v[-1] and v[0] in ('"', "'"):
            v = v[1:-1]
        os.environ.setdefault(k, v)


# ---------- HTTP ----------

def http_get(path: str, token: str, params: dict | None = None) -> Any:
    qs = ("?" + urllib.parse.urlencode(params)) if params else ""
    url = f"{API}{path}{qs}"
    req = urllib.request.Request(url, headers={"Authorization": token})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"{C.RED}HTTP {e.code} em {url}{C.RESET}\n{body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"{C.RED}Falha de rede: {e.reason}{C.RESET}", file=sys.stderr)
        sys.exit(1)


# ---------- parser (espelha o node do n8n) ----------

def pick(desc: str, label: str) -> str:
    """Extrai o valor após 'Label:' ou 'Label -' até fim da linha."""
    pat = rf"{re.escape(label)}\s*[:\-]\s*(.+?)(?:\n|$)"
    m = re.search(pat, desc, re.IGNORECASE)
    return m.group(1).strip() if m else ""


@dataclass
class ParsedTask:
    id: str
    name: str
    status: str
    url: str
    parent_id: str | None
    parent_name: str
    description_excerpt: str
    # Campos extraídos
    criativo: str
    formato: str
    copy_line: str
    doc_id: str
    referencia: str
    drive_id: str
    pasta_line: str
    drive_folder_id: str
    # Subtask copy
    copy_subtask_present: bool
    copy_subtask_status: str
    # Validação
    missing: list[str] = field(default_factory=list)


def parse_task(task: dict, parent_name: str) -> ParsedTask:
    desc = task.get("description") or task.get("text_content") or ""

    criativo = pick(desc, "Criativo")
    formato = pick(desc, "Formato")
    copy_line = pick(desc, "Copy")
    referencia = pick(desc, "Referência")
    drive_id = pick(desc, "ID (Suba no Drive com este nome)")
    pasta_line = pick(desc, "Quando finalizar, colocar nessa pasta")

    doc_match = re.search(r"/document/d/([a-zA-Z0-9_-]+)", copy_line)
    folder_match = re.search(r"/folders/([a-zA-Z0-9_-]+)", pasta_line)

    # Subtask "copy"
    subtasks = task.get("subtasks") or []
    copy_st = next(
        (s for s in subtasks if (s.get("name") or "").strip().lower() == "copy"),
        None,
    )
    copy_present = copy_st is not None
    copy_status = ""
    if copy_st:
        copy_status = (copy_st.get("status") or {}).get("status", "") or ""

    # Campos considerados críticos — se faltar, o workflow não roda
    missing: list[str] = []
    if not criativo:
        missing.append("Criativo")
    if not formato:
        missing.append("Formato")
    if not doc_match:
        missing.append("Copy URL (Docs)")
    if not folder_match:
        missing.append("Pasta destino (Drive)")
    if not copy_present:
        missing.append('Subtask "copy"')

    excerpt = "\n    ".join(desc.strip().splitlines()[:8])

    return ParsedTask(
        id=task["id"],
        name=task.get("name", ""),
        status=(task.get("status") or {}).get("status", "") or "",
        url=task.get("url", ""),
        parent_id=task.get("parent"),
        parent_name=parent_name,
        description_excerpt=excerpt,
        criativo=criativo,
        formato=formato,
        copy_line=copy_line,
        doc_id=doc_match.group(1) if doc_match else "",
        referencia=referencia,
        drive_id=drive_id,
        pasta_line=pasta_line,
        drive_folder_id=folder_match.group(1) if folder_match else "",
        copy_subtask_present=copy_present,
        copy_subtask_status=copy_status,
        missing=missing,
    )


# ---------- coleta ----------

def fetch_all_tasks(token: str, include_closed: bool, max_pages: int = 3) -> list[dict]:
    """Busca tasks da lista, paginando. Inclui subtasks na resposta."""
    all_tasks: list[dict] = []
    for page in range(max_pages):
        params = {
            "subtasks": "true",
            "include_closed": "true" if include_closed else "false",
            "page": str(page),
            "order_by": "updated",
            "reverse": "true",
        }
        data = http_get(f"/list/{LIST_ID}/task", token, params)
        tasks = data.get("tasks", [])
        if not tasks:
            break
        all_tasks.extend(tasks)
        if len(tasks) < 100:  # ClickUp page size
            break
    return all_tasks


def fetch_task_detail(task_id: str, token: str) -> dict:
    """Busca uma task com include_subtasks=true pra ter subtasks completas."""
    return http_get(
        f"/task/{task_id}",
        token,
        {"include_subtasks": "true"},
    )


# ---------- relatório ----------

def render_task(i: int, t: ParsedTask) -> None:
    # Cor do status template
    if not t.missing:
        tpl_label = f"{C.GREEN}✅ completo{C.RESET}"
    else:
        tpl_label = f"{C.YELLOW}⚠️  faltando: {', '.join(t.missing)}{C.RESET}"

    # Cor da subtask copy
    if t.copy_subtask_present:
        if t.copy_subtask_status.lower() == "aprovado":
            copy_label = f"{C.GREEN}✅ presente, status=aprovado (→ workflow lerá Docs){C.RESET}"
        else:
            copy_label = f"{C.CYAN}✅ presente, status={t.copy_subtask_status} (→ workflow chamará Claude){C.RESET}"
    else:
        copy_label = f"{C.RED}❌ ausente{C.RESET}"

    print(f"\n{C.DIM}{'─' * 72}{C.RESET}")
    print(f"{C.BOLD}[{i}] {t.name}{C.RESET}  {C.GRAY}({t.id}){C.RESET}")
    print(f"    Parent: {t.parent_name or C.DIM + '(sem parent)' + C.RESET}")
    print(f"    Status: {t.status}")
    print(f"    URL:    {C.DIM}{t.url}{C.RESET}")
    print(f"    Template: {tpl_label}")
    print(f"      Criativo:  {t.criativo or C.RED + '(vazio)' + C.RESET}")
    print(f"      Formato:   {t.formato or C.RED + '(vazio)' + C.RESET}")
    print(f"      Copy URL:  {t.copy_line[:70] + ('…' if len(t.copy_line) > 70 else '') if t.copy_line else C.RED + '(vazio)' + C.RESET}")
    print(f"        → docId: {t.doc_id or C.RED + '(não extraído)' + C.RESET}")
    print(f"      Drive ID:  {t.drive_id or C.DIM + '(vazio)' + C.RESET}")
    print(f"      Pasta:     {t.pasta_line[:70] + ('…' if len(t.pasta_line) > 70 else '') if t.pasta_line else C.RED + '(vazio)' + C.RESET}")
    print(f"        → folderId: {t.drive_folder_id or C.RED + '(não extraído)' + C.RESET}")
    print(f"      Referência: {t.referencia or C.DIM + '(vazio)' + C.RESET}")
    print(f"    Subtask \"copy\": {copy_label}")


def render_summary(results: list[ParsedTask], ignored: int) -> None:
    total = len(results)
    ok = sum(1 for t in results if not t.missing)
    has_copy = sum(1 for t in results if t.copy_subtask_present)
    copy_aprovada = sum(
        1 for t in results if t.copy_subtask_present and t.copy_subtask_status.lower() == "aprovado"
    )

    # Campos mais faltantes
    missing_counter: dict[str, int] = {}
    for t in results:
        for m in t.missing:
            missing_counter[m] = missing_counter.get(m, 0) + 1

    print(f"\n{C.BOLD}{'═' * 72}{C.RESET}")
    print(f"{C.BOLD} RESUMO{C.RESET}")
    print(f"{C.BOLD}{'═' * 72}{C.RESET}")
    print(f"  Tasks lidas da lista:         {total + ignored}")
    print(f"  Ignoradas (não são posts):    {ignored}")
    print(f"  Posts analisados:             {total}")
    print(f"  Template {C.GREEN}completo{C.RESET}:            {ok} / {total}")
    print(f"  Template {C.YELLOW}incompleto{C.RESET}:          {total - ok} / {total}")
    print(f"  Com subtask \"copy\":           {has_copy} / {total}")
    print(f"     → status=aprovado:         {copy_aprovada}")
    print(f"     → outros status:           {has_copy - copy_aprovada}")

    if missing_counter:
        print(f"\n  {C.YELLOW}Campos mais faltantes:{C.RESET}")
        for field_name, count in sorted(missing_counter.items(), key=lambda x: -x[1]):
            pct = 100 * count // total if total else 0
            print(f"    • {field_name:30s} {count}/{total} ({pct}%)")

    print()
    if ok == total and total > 0:
        print(f"  {C.GREEN}✅ Template consistente. Parser do n8n vai funcionar sem ajuste.{C.RESET}")
    elif ok >= total * 0.8 and total > 0:
        print(f"  {C.YELLOW}⚠️  Maioria segue o template, mas há variações. Considere ajustar o parser para tolerância.{C.RESET}")
    elif total == 0:
        print(f"  {C.RED}❌ Nenhum post encontrado — confira se a heurística de parent (prefixo \"Social Media\") está certa.{C.RESET}")
    else:
        print(f"  {C.RED}❌ Template inconsistente. Ajustar o parser ou combinar com o time o padrão da descrição.{C.RESET}")
    print()


# ---------- main ----------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=15, help="Quantidade máxima de posts a analisar (padrão: 15).")
    ap.add_argument("--include-closed", action="store_true", help="Inclui tarefas com status 'closed' (ex.: CONCLUÍDO).")
    ap.add_argument("--show-description", action="store_true", help="Imprime as primeiras linhas da descrição crua de cada task.")
    args = ap.parse_args()

    load_env()
    token = os.environ.get("CLICKUP_API_TOKEN", "").strip()
    if not token or token == "pk_":
        print(f"{C.RED}❌ CLICKUP_API_TOKEN não preenchido no .env.{C.RESET}", file=sys.stderr)
        print("Gere em: ClickUp → Settings → Apps → Generate API Token", file=sys.stderr)
        sys.exit(1)

    print(f"{C.CYAN}→ Buscando tasks da lista Instagram 📷({LIST_ID})…{C.RESET}")
    tasks = fetch_all_tasks(token, args.include_closed)
    print(f"  {len(tasks)} tasks retornadas pela API (incluindo parents e subtasks).")

    # Indexa nomes por id pra mostrar o nome do parent
    name_by_id = {t["id"]: t.get("name", "") for t in tasks}

    # Filtra apenas subtasks cujo parent começa com "Social Media"
    posts: list[tuple[dict, str]] = []
    ignored = 0
    for t in tasks:
        parent_id = t.get("parent")
        if not parent_id:
            ignored += 1
            continue
        parent_name = name_by_id.get(parent_id, "")
        if not parent_name.lower().startswith(PARENT_PREFIX):
            # Subtask de outra coisa (pode ser copy de outro post, etc.) — ignorar
            ignored += 1
            continue
        posts.append((t, parent_name))

    # Limita e processa — para cada post, re-busca com include_subtasks=true
    # (o list endpoint às vezes não traz subtasks dos próprios posts)
    posts = posts[: args.limit]
    print(f"  {len(posts)} posts reais (subtasks de 'Social Media - …') pra analisar.\n")

    results: list[ParsedTask] = []
    for (t, parent_name) in posts:
        detail = fetch_task_detail(t["id"], token)
        results.append(parse_task(detail, parent_name))

    for i, r in enumerate(results, 1):
        render_task(i, r)
        if args.show_description:
            print(f"    {C.DIM}Descrição (8 primeiras linhas):{C.RESET}")
            print(f"    {C.DIM}{r.description_excerpt}{C.RESET}")

    render_summary(results, ignored)

    # Código de saída útil pra CI futuro
    if results and all(not r.missing for r in results):
        sys.exit(0)
    sys.exit(2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{C.DIM}interrompido{C.RESET}", file=sys.stderr)
        sys.exit(130)
