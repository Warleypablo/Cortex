"""
Orquestrador.

Pipeline por execução:
  1. argparse (--task-id, --force-now, --dry-run, --list)
  2. adquire lockfile (.cache/.lock)
  3. lista tasks aprovadas no ClickUp (ou só uma se --task-id)
  4. pra cada task:
     a. parse descrição (TURBO_slug, Formato, Criativo)
     b. detecta mês pelo parent task (ex.: "Social Media - ABRIL")
     c. lê comentários → pula se já postado / em aprovação / skip
     d. resolve Doc do mês + legenda por task.name
     e. resolve pasta TURBO_<slug> + classifica assets (single/reel/carousel)
     f. monta PlannedAction
  5. em DRY_RUN=1: imprime plano e sai
     em DRY_RUN=0: chama execute_plan → instagram.publish_* + clickup_write.mark_posted

Modos:
  DRY_RUN=1 python3 -m agente.main                       # dry-run completo
  DRY_RUN=1 python3 -m agente.main --task-id <id>        # debug 1 task
  DRY_RUN=0 python3 -m agente.main --task-id <id> --force-now
      # publica essa task agora, ignorando slot/data. Usado pra teste em
      # conta IG de teste.
"""
from __future__ import annotations
import argparse
import sys
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime

from agente import clickup, docs_parser
from agente.config import CONFIG
from agente.idempotency import Lock, LockHeld, inspect_comments, should_process


# Cache in-process: mes → (drive_folder_id, doc_id, doc_text)
_mes_cache: dict[str, dict] = {}


# ── Slots fixos (modo atual) ───────────────────────────────────────────────
SLOT_HOURS = (12, 18)
SLOT_TOLERANCE_HOURS = 1


def current_slot(now: datetime | None = None) -> str | None:
    now = now or datetime.now()
    for h in SLOT_HOURS:
        if h <= now.hour < h + SLOT_TOLERANCE_HOURS:
            return f"{h}h"
    return None


def slot_status_human(now: datetime | None = None) -> str:
    now = now or datetime.now()
    h = now.hour
    slot = current_slot(now)
    if slot:
        return f"no slot {slot} (até {SLOT_HOURS[0] + SLOT_TOLERANCE_HOURS if slot=='12h' else SLOT_HOURS[1] + SLOT_TOLERANCE_HOURS}h)"
    if h < SLOT_HOURS[0]:
        return f"antes do 1º slot — abre {SLOT_HOURS[0]}h"
    if SLOT_HOURS[0] + SLOT_TOLERANCE_HOURS <= h < SLOT_HOURS[1]:
        return f"entre slots — slot {SLOT_HOURS[0]}h fechou, {SLOT_HOURS[1]}h abre depois"
    return f"depois do último slot — slot {SLOT_HOURS[1]}h fechou às {SLOT_HOURS[1] + SLOT_TOLERANCE_HOURS}h"


@dataclass
class PlannedAction:
    task_id: str
    task_name: str
    parent_id: str | None
    mes: str | None
    turbo_slug: str | None
    formato_card: str | None
    criativo: str | None
    is_placeholder: bool
    posting_date: str | None = None
    slot_now: str | None = None
    slot_status: str = ""
    already_posted: bool = False
    pending_approval: bool = False
    skip_reason: str | None = None
    matched_header: str | None = None
    legenda_text: str = ""
    legenda_len: int = 0
    legenda_empty: bool = False
    legenda_source: str = "none"
    drive_folder_found: bool = False
    tipo_post: str | None = None
    asset_count: int = 0
    asset_names: list[str] = field(default_factory=list)
    asset_ids: list[str] = field(default_factory=list)
    asset_mimes: list[str] = field(default_factory=list)
    oauth_pending: bool = False
    error: str | None = None

    @property
    def is_ready_to_publish(self) -> bool:
        """Tem tudo que precisa pra chamar instagram.publish_*."""
        return (
            self.skip_reason is None
            and self.error is None
            and not self.oauth_pending
            and self.tipo_post in ("reels", "carousel", "single")
            and not self.legenda_empty
            and self.legenda_source == "doc"
            and self.asset_count > 0
        )


def _load_mes_context(mes_upper: str) -> dict:
    if mes_upper in _mes_cache:
        return _mes_cache[mes_upper]

    ctx = {"drive_folder": None, "doc_file": None, "doc_text": "", "error": None}
    try:
        CONFIG.require_google()
    except RuntimeError as e:
        ctx["error"] = str(e)
        _mes_cache[mes_upper] = ctx
        return ctx

    from agente import drive
    try:
        ctx["drive_folder"] = drive.resolve_mes_drive_folder(mes_upper)
        ctx["doc_file"] = drive.resolve_mes_doc(mes_upper)
        if ctx["doc_file"]:
            ctx["doc_text"] = drive.get_doc_text(ctx["doc_file"].id)
    except Exception as e:  # noqa: BLE001
        ctx["error"] = f"{type(e).__name__}: {e}"

    _mes_cache[mes_upper] = ctx
    return ctx


def plan_task(t: clickup.Task, *, force_now: bool = False) -> PlannedAction:
    pd = clickup.parse_description(t.description)
    mes = None
    if t.parent_id:
        try:
            parent = clickup.get_task(t.parent_id)
            mes = clickup.extract_month_from_parent_name(
                parent.name, fallback_date=t.posting_date() or date.today(),
            )
        except Exception as e:  # noqa: BLE001
            return PlannedAction(
                task_id=t.id, task_name=t.name, parent_id=t.parent_id, mes=None,
                turbo_slug=pd.turbo_slug, formato_card=pd.formato, criativo=pd.criativo,
                is_placeholder=pd.is_template_placeholder,
                error=f"erro buscando parent: {e}",
            )

    plan = PlannedAction(
        task_id=t.id,
        task_name=t.name,
        parent_id=t.parent_id,
        mes=mes,
        turbo_slug=pd.turbo_slug,
        formato_card=pd.formato,
        criativo=pd.criativo,
        is_placeholder=pd.is_template_placeholder,
    )
    pdate = t.posting_date()
    plan.posting_date = pdate.isoformat() if pdate else None
    plan.slot_now = current_slot()
    plan.slot_status = slot_status_human()

    # idempotência via comentários
    try:
        comments = clickup.get_comments(t.id)
        st = inspect_comments(comments)
        plan.already_posted = st.posted
        plan.pending_approval = st.pending_approval
        ok, reason = should_process(st)
        if not ok:
            plan.skip_reason = reason
            return plan
    except Exception as e:  # noqa: BLE001
        plan.error = f"erro lendo comentários: {e}"
        return plan

    # filtro de data — pulável via --force-now
    if not force_now:
        today = date.today()
        if pdate is None:
            plan.skip_reason = "sem 'Data de Postagem' preenchida — agente não posta sem data planejada"
            return plan
        if pdate < today:
            plan.skip_reason = (
                f"data de postagem {pdate.isoformat()} já passou (hoje={today.isoformat()}) "
                "— provavelmente postada manualmente"
            )
            return plan
        if pdate > today:
            plan.skip_reason = (
                f"data de postagem {pdate.isoformat()} é futura (hoje={today.isoformat()}) "
                "— agente só posta no dia, não antecipa"
            )
            return plan

    if pd.is_template_placeholder:
        plan.skip_reason = "TURBO_xpto é placeholder do template — cardista esqueceu de renomear"
        return plan
    if not pd.turbo_slug:
        plan.skip_reason = "descrição não contém TURBO_<slug>"
        return plan
    if not mes:
        plan.skip_reason = "não consegui extrair mês do parent task"
        return plan

    ctx = _load_mes_context(mes)
    if ctx["error"]:
        if "Google OAuth não configurado" in ctx["error"]:
            plan.oauth_pending = True
        else:
            plan.error = f"Google: {ctx['error']}"
        return plan

    # Legenda: prioriza o Doc linkado no campo "Copy:" do próprio card
    # (caption_doc_id lê o markdown_description). O Doc mensal "SOCIAL MEDIA
    # TURBO [MÊS]" vira só fallback — cada card aponta seu Doc de copy, que
    # pode ter abas por mês, então a busca por header (find_legenda_for_task)
    # roda sobre o texto de todas as abas concatenadas.
    doc_text = ctx["doc_text"]
    try:
        cap_doc_id = clickup.caption_doc_id(t.id)
        if cap_doc_id:
            from agente import drive
            doc_text = drive.get_doc_text(cap_doc_id)
    except Exception:  # noqa: BLE001
        pass  # 403/ausente → cai pro Doc mensal (ctx["doc_text"])

    if doc_text:
        leg, hdr = docs_parser.find_legenda_for_task(doc_text, t.name)
        plan.matched_header = hdr
        plan.legenda_text = leg
        plan.legenda_len = len(leg)
        plan.legenda_empty = (len(leg) == 0)
        plan.legenda_source = "doc" if leg else "claude-precisa"
    else:
        plan.legenda_source = "claude-precisa"

    if ctx["drive_folder"]:
        from agente import drive
        try:
            post_folder = drive.find_post_folder(ctx["drive_folder"].id, pd.turbo_slug)
            if post_folder:
                plan.drive_folder_found = True
                files = drive.list_folder(post_folder.id)
                tipo, assets = drive.classify_assets(files)
                plan.tipo_post = tipo
                plan.asset_count = len(assets)
                plan.asset_names = [a.name for a in assets][:10]
                plan.asset_ids = [a.id for a in assets][:10]
                plan.asset_mimes = [a.mime_type for a in assets][:10]
        except Exception as e:  # noqa: BLE001
            plan.error = f"erro Drive: {e}"

    return plan


# ── Execução (DRY_RUN=0) ──────────────────────────────────────────────────

@dataclass
class ExecResult:
    task_id: str
    ig_media_id: str | None
    permalink: str | None
    error: str | None = None


def execute_plan(plan: PlannedAction, *, run_id: str, force_now: bool = False) -> ExecResult:
    """
    Publica no IG e marca a task como postada no ClickUp. Só é chamado
    quando DRY_RUN=0 E plan.is_ready_to_publish.

    Refuse-soft se estamos fora de slot, exceto quando --force-now.
    """
    from agente import instagram, clickup_write, rehost

    if plan.slot_now is None and not force_now:
        return ExecResult(
            task_id=plan.task_id, ig_media_id=None, permalink=None,
            error=f"fora de slot ({plan.slot_status}) — use --force-now pra publicar agora",
        )

    # Re-host: a Meta baixa a URL anonimamente; o Drive cai em login. Cada
    # asset vira uma signed URL de um bucket GCS privado (ver agente/rehost.py).
    urls = [
        rehost.rehost_file_id(fid, mime=m)
        for fid, m in zip(plan.asset_ids, plan.asset_mimes)
    ]
    types = ["video" if m.startswith("video/") else "image" for m in plan.asset_mimes]

    try:
        if plan.tipo_post == "single":
            res = instagram.publish_single(urls[0], plan.legenda_text)
        elif plan.tipo_post == "reels":
            res = instagram.publish_reel(urls[0], plan.legenda_text)
        elif plan.tipo_post == "carousel":
            res = instagram.publish_carousel(urls, plan.legenda_text, item_types=types)
        else:
            return ExecResult(
                task_id=plan.task_id, ig_media_id=None, permalink=None,
                error=f"tipo_post inválido: {plan.tipo_post}",
            )
    except Exception as e:  # noqa: BLE001
        # Registra falha como comment com [agente:erro]
        try:
            clickup_write.mark_error(plan.task_id, f"{type(e).__name__}: {e}")
        except Exception:  # noqa: BLE001
            pass
        return ExecResult(
            task_id=plan.task_id, ig_media_id=None, permalink=None,
            error=f"falha publicando: {type(e).__name__}: {e}",
        )

    # Sucesso no IG — marca no ClickUp
    try:
        clickup_write.mark_posted(
            plan.task_id, res.ig_media_id, res.permalink, plan.tipo_post, run_id=run_id,
        )
    except Exception as e:  # noqa: BLE001
        # Pior cenário: postou no IG mas falhou marcar no ClickUp. Loga claramente —
        # o operador precisa marcar manualmente pra evitar repostagem no próximo ciclo.
        return ExecResult(
            task_id=plan.task_id, ig_media_id=res.ig_media_id, permalink=res.permalink,
            error=f"⚠️  POSTOU NO IG mas falhou marcar ClickUp: {e}. Marcar manualmente!",
        )

    return ExecResult(
        task_id=plan.task_id, ig_media_id=res.ig_media_id, permalink=res.permalink,
    )


def render_skip_compact(p: PlannedAction) -> str:
    reason_short = p.skip_reason or "?"
    if "sem 'Data de Postagem'" in reason_short:
        reason_short = "sem data"
    elif "já passou" in reason_short:
        reason_short = f"data {p.posting_date} já passou"
    elif "é futura" in reason_short:
        reason_short = f"data {p.posting_date} é futura (espera o dia)"
    elif "TURBO_xpto" in reason_short:
        reason_short = "TURBO_xpto (template não renomeado)"
    elif "TURBO_<slug>" in reason_short:
        reason_short = "sem TURBO_<slug>"
    return f"⏭  {p.task_id} «{p.task_name}» — {reason_short}"


def render_plan(p: PlannedAction) -> str:
    lines = [f"\n── Task {p.task_id}  «{p.task_name}»"]
    lines.append(f"   mês: {p.mes or '?'}   turbo: {p.turbo_slug or '—'}   data: {p.posting_date or '—'}")
    if p.slot_now:
        lines.append(f"   ⏱  slot agora: {p.slot_now} (publicaria nesta execução em produção)")
    else:
        lines.append(f"   ⏱  slot agora: — ({p.slot_status})")
    if p.formato_card or p.criativo:
        lines.append(f"   card: formato={p.formato_card or '—'}  criativo={p.criativo or '—'}")
    if p.is_placeholder:
        lines.append("   ⚠️  TURBO_xpto (template não preenchido)")
    if p.skip_reason:
        lines.append(f"   ⏭  SKIP: {p.skip_reason}")
        return "\n".join(lines)
    if p.error:
        lines.append(f"   ❌ ERRO: {p.error}")
        return "\n".join(lines)
    if p.oauth_pending:
        lines.append("   ⏳ aguardando OAuth — FARIA: buscar legenda no Doc + assets em "
                     f"{p.turbo_slug} dentro da pasta de {p.mes}")
        return "\n".join(lines)

    if p.matched_header:
        if p.legenda_empty:
            lines.append(f"   📄 Doc: header «{p.matched_header}» encontrado, LEGENDA vazia → Claude geraria")
        else:
            lines.append(f"   📄 Doc: «{p.matched_header}» ({p.legenda_len} chars de legenda)")
    elif p.legenda_source == "claude-precisa":
        lines.append("   📄 Doc: sem match de header (Claude precisaria gerar + aprovação)")

    if p.drive_folder_found:
        preview = ", ".join(p.asset_names[:3])
        if len(p.asset_names) > 3:
            preview += f", … (+{len(p.asset_names)-3})"
        lines.append(f"   📁 Drive: pasta OK → tipo={p.tipo_post}  assets={p.asset_count}  [{preview}]")
    else:
        lines.append(f"   📁 Drive: pasta {p.turbo_slug} NÃO encontrada no mês")

    if p.is_ready_to_publish:
        verb = "publicaria" if CONFIG.dry_run else "vai publicar"
        lines.append(f"   ▶️  AÇÃO: {verb} como {p.tipo_post} no IG e marcaria POSTADO")
    elif p.legenda_empty:
        lines.append("   ▶️  AÇÃO: pediria aprovação da legenda gerada (sem postar) — Bloco F")
    elif p.tipo_post == "empty":
        lines.append("   ▶️  AÇÃO: alertaria 'pasta sem assets' (sem postar)")
    else:
        lines.append("   ▶️  AÇÃO: bloqueado — info incompleta (sem postar)")
    return "\n".join(lines)


# ── CLI ───────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Agente de publicação Instagram")
    ap.add_argument("--task-id", help="processa só essa task (debug / teste)")
    ap.add_argument(
        "--force-now", action="store_true",
        help="bypassa filtro de Data=hoje e de slot 12h/18h. Use em testes em "
             "conta IG de teste. NÃO use em produção.",
    )
    ap.add_argument(
        "--caption-override",
        help="usa esta legenda em vez da que está no Doc (útil pra testar publish "
             "antes do Bloco F estar pronto). Só funciona com --task-id.",
    )
    return ap.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    run_id = uuid.uuid4().hex[:8]

    print("═══════════════════════════════════════════════════════════")
    print(f"  Agente Instagram — DRY_RUN={CONFIG.dry_run}   run_id={run_id}")
    print(f"  Hoje: {date.today().isoformat()}   Agora: {datetime.now().strftime('%H:%M')}   Slot: {slot_status_human()}")
    if args.task_id:
        print(f"  Modo: --task-id {args.task_id}")
    if args.force_now:
        print(f"  ⚠️  --force-now: ignora filtros de data e slot")
    print("═══════════════════════════════════════════════════════════")

    try:
        CONFIG.require_clickup()
    except RuntimeError as e:
        print(f"❌ {e}")
        return 2

    if not CONFIG.dry_run:
        # safety check antes de qualquer operação destrutiva
        try:
            CONFIG.require_meta()
        except RuntimeError as e:
            print(f"❌ DRY_RUN=0 mas Meta não configurado: {e}")
            return 2
        # identifica conta IG ANTES de qualquer publish
        try:
            from agente import instagram
            acc = instagram.verify_token()
            print(f"📸 IG ativa: @{acc.username} ({acc.name or '—'}) "
                  f"id={acc.id} seguidores={acc.followers_count}")
        except Exception as e:  # noqa: BLE001
            print(f"❌ Não consegui verificar conta IG: {e}")
            return 2

    try:
        with Lock():
            # carrega tasks (uma só ou todas aprovadas)
            try:
                if args.task_id:
                    t = clickup.get_task(args.task_id)
                    tasks = [t]
                    print(f"\n📋 1 task carregada por --task-id: «{t.name}» status={t.status}")
                else:
                    tasks = clickup.list_approved_tasks()
                    print(f"\n📋 {len(tasks)} task(s) aprovada(s) na lista Instagram 📷")
            except Exception as e:  # noqa: BLE001
                print(f"❌ ClickUp falhou: {e}")
                return 1

            try:
                CONFIG.require_google()
                print("🔐 Google OAuth: configurado (vai resolver Doc + Drive)")
            except RuntimeError as e:
                print(f"🔐 Google OAuth: NÃO configurado — {e}")
                print("    → irá pular resolução de Doc/Drive; reporta só o que FARIA.\n")

            ok = empty_docs = missing_drive = skipped = errors = oauth_pending = 0
            published = publish_failed = 0
            skip_past = skip_no_date = skip_future = 0
            skipped_lines: list[str] = []

            for t in tasks:
                try:
                    plan = plan_task(t, force_now=args.force_now)
                    if args.caption_override and args.task_id:
                        plan.legenda_text = args.caption_override
                        plan.legenda_len = len(args.caption_override)
                        plan.legenda_empty = False
                        plan.legenda_source = "doc"  # finge que veio do doc pro is_ready_to_publish
                        print(f"   📝 caption sobrescrita via --caption-override ({len(args.caption_override)} chars)")
                except Exception as e:  # noqa: BLE001
                    print(f"\n── Task {t.id}  «{t.name}»")
                    print(f"   ❌ exceção: {e}")
                    traceback.print_exc()
                    errors += 1
                    continue
                if plan.skip_reason:
                    skipped_lines.append(render_skip_compact(plan))
                    if "já passou" in plan.skip_reason:
                        skip_past += 1
                    elif "é futura" in plan.skip_reason:
                        skip_future += 1
                    elif "sem 'Data de Postagem'" in plan.skip_reason:
                        skip_no_date += 1
                    else:
                        skipped += 1
                    continue
                print(render_plan(plan))
                if plan.error:
                    errors += 1
                    continue
                if plan.oauth_pending:
                    oauth_pending += 1
                    continue
                if plan.legenda_empty:
                    empty_docs += 1
                    continue
                if not plan.drive_folder_found:
                    missing_drive += 1
                    continue
                if not plan.is_ready_to_publish:
                    errors += 1
                    continue

                # Tudo certo. Em dry-run, apenas conta. Em produção, executa.
                ok += 1
                if CONFIG.dry_run:
                    continue

                exec_res = execute_plan(plan, run_id=run_id, force_now=args.force_now)
                if exec_res.error:
                    print(f"   ❌ {exec_res.error}")
                    publish_failed += 1
                else:
                    published += 1
                    print(f"   ✅ publicado: media_id={exec_res.ig_media_id}")
                    if exec_res.permalink:
                        print(f"      {exec_res.permalink}")

            if skipped_lines:
                print(f"\n── puladas ({len(skipped_lines)}):")
                for ln in skipped_lines:
                    print(f"   {ln}")

            print("\n───────────── resumo ─────────────")
            print(f"  prontas para postar:            {ok}")
            if not CONFIG.dry_run:
                print(f"  publicadas com sucesso:         {published}")
                print(f"  falhas de publicação:           {publish_failed}")
            print(f"  legenda vazia (precisa Claude): {empty_docs}")
            print(f"  sem pasta TURBO_ no Drive:      {missing_drive}")
            print(f"  aguardando OAuth Google:        {oauth_pending}")
            print(f"  data de postagem já passou:     {skip_past}")
            print(f"  data de postagem é futura:      {skip_future}")
            print(f"  sem 'Data de Postagem':         {skip_no_date}")
            print(f"  puladas (idempotência/outros):  {skipped}")
            print(f"  erros / info incompleta:        {errors}")
            print("──────────────────────────────────")
            return 0
    except LockHeld as e:
        print(f"⛔ {e}")
        return 3


if __name__ == "__main__":
    sys.exit(main())
