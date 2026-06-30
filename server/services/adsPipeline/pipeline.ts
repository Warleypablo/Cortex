/**
 * Orquestrador do pipeline ClickUp → Biblioteca → Conjuntos Meta (PAUSED) → WhatsApp.
 *
 * Para cada lote `aprovado` na lista "Anúncios":
 *   1. lê os campos (Funil → campanha alvo, Público, Verba, Range dos TPs) + pasta do Drive (descrição);
 *   2. lê os criativos do lote na Biblioteca (pelo Range dos TPs) p/ derivar personagem/hooks e os nome_final;
 *   3. cria o(s) conjunto(s) PAUSED no Meta clonando o conjunto-template (sem subir vídeo);
 *   4. avisa por WhatsApp pedindo o upload manual dos criativos no Gerenciador;
 *   5. comenta na task (marcador de idempotência) e, opcional, move o status.
 *
 * dry-run (padrão) = calcula e imprime o plano, NÃO escreve em lugar nenhum.
 */
import "dotenv/config";
import * as cu from "./clickupClient";
import { metaGet, metaPostForm } from "../adsCreation/metaApi";
import * as cfg from "./config";

export interface PlanWarning {
  msg: string;
}

export interface LotePlan {
  taskId: string;
  taskName: string;
  taskUrl: string;
  /** Subtask "Subir ad" que disparou o lote (p/ mover status). Ausente no fluxo CLI antigo. */
  triggerTaskId?: string;
  triggerTaskUrl?: string;
  status: string;
  isCreative: boolean;
  skipReason?: string;
  funil: string | null;
  target: cfg.FunilTarget | null;
  publico: string;
  verbaCents: number;
  driveFolderUrl: string | null;
  tpIds: string[];
  nomeFinais: string[];
  personagem: string;
  conjuntoNome: string;
  nn: number | null;
  conjuntoJaExiste: boolean;
  alreadyProcessed: boolean;
  whatsappText: string;
  warnings: string[];
  /** Preenchido só quando executado de verdade (--live). */
  result?: { adsetId?: string; whatsappSent?: boolean; commented?: boolean; statusMoved?: boolean };
}

// ============== helpers de parsing ==============

function extractDriveFolder(desc: string | null | undefined): string | null {
  if (!desc) return null;
  const all = [...desc.matchAll(/https:\/\/drive\.google\.com\/[^\s)\]]+/g)].map((m) => m[0]);
  if (!all.length) return null;
  // prefere link de PASTA (/folders/) ao link de arquivo único (/file/d/, ex.: roteiro)
  return all.find((u) => /\/folders\//.test(u)) ?? all[0];
}

function parseVerbaCents(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = parseFloat(String(raw).replace(/[^\d.,]/g, "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return fallback;
  return Math.round(n * 100);
}

/** "TP1616-TP1618" / "1616 a 1618" / "TP1616, TP1617" → ["TP1616","TP1617","TP1618"]. */
export function parseTpRange(raw: string | null): string[] {
  if (!raw) return [];
  const nums = new Set<number>();
  const rangeRe = /TP?\s*(\d+)\s*(?:-|a|–|—|até|to)\s*TP?\s*(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(raw))) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) nums.add(i);
  }
  const singleRe = /TP\s*(\d+)/gi;
  while ((m = singleRe.exec(raw))) nums.add(parseInt(m[1], 10));
  return [...nums].sort((x, y) => x - y).map((n) => `TP${String(n).padStart(2, "0")}`);
}

/** Heurística: o nome começa com o tipo de criativo da convenção do time? */
export const CREATIVE_NAME_RE = /^(vv|img|car)[-_ ]/i;

/** Fallback quando não há Range dos TPs: tira o que dá do nome da task. */
export function parseCreativeName(name: string): {
  tipo: string | null;
  personagem: string;
  hooksLabel: string;
  bodyLabel: string;
  ctaLabel: string;
} {
  const tipoM = name.match(/^(vv|img|car)\b/i);
  const hooks = [...name.matchAll(/\bh\s*(\d+)/gi)].map((m) => parseInt(m[1], 10)).sort((a, b) => a - b);
  const bodies = [...name.matchAll(/\bb\s*(\d+)/gi)].map((m) => parseInt(m[1], 10)).sort((a, b) => a - b);
  const ctas = [...name.matchAll(/\b(?:cta|c)\s*(\d+)/gi)].map((m) => parseInt(m[1], 10)).sort((a, b) => a - b);
  const hooksLabel =
    hooks.length > 1
      ? `h${String(hooks[0]).padStart(2, "0")} a h${String(hooks[hooks.length - 1]).padStart(2, "0")}`
      : hooks.length === 1
        ? `h${String(hooks[0]).padStart(2, "0")}`
        : "";
  // personagem: último token "limpo" (sem tokens técnicos vv/h1/b1/cta1/9x16/v01)
  const tokens = name
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .filter(
      (t) =>
        !/^(vv|img|car)$/i.test(t) &&
        !/^h\d+$/i.test(t) &&
        !/^b\d+$/i.test(t) &&
        !/^(cta|c)\d+$/i.test(t) &&
        !/^(9x16|4x5|1x1|16x9)$/i.test(t) &&
        !/^v\d+$/i.test(t),
    );
  return {
    tipo: tipoM ? tipoM[1].toLowerCase() : null,
    personagem: tokens.length ? tokens[tokens.length - 1] : "",
    hooksLabel,
    bodyLabel: bodies.length ? `b${bodies.join("/")}` : "",
    ctaLabel: ctas.length ? `c${ctas.join("/")}` : "",
  };
}

/** Próximo [NN] da campanha (lê os conjuntos e pega o maior prefixo "[NN]" ou "NN -"). */
async function nextSequence(campaignId: string): Promise<number> {
  try {
    const data = await metaGet(`${campaignId}/adsets`, { fields: "name", limit: "400" });
    const names: string[] = (data?.data ?? []).map((a: { name: string }) => a.name).filter(Boolean);
    let max = 0;
    for (const name of names) {
      const m = /^\s*\[?(\d{1,3})\]?\s*-/.exec(name);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return max + 1;
  } catch {
    return 1;
  }
}

async function adsetNameExists(campaignId: string, name: string): Promise<boolean> {
  try {
    const data = await metaGet(`${campaignId}/adsets`, { fields: "name", limit: "400" });
    return (data?.data ?? []).some((s: { name: string }) => s.name === name);
  } catch {
    return false;
  }
}

/** Lê linhas da Biblioteca pelos TP ids (lazy import — não acopla DB no dry-run sem TPs). */
async function readBibliotecaByTps(tpIds: string[]): Promise<Record<string, unknown>[]> {
  if (!tpIds.length) return [];
  const { db } = await import("../../db");
  const { creativesLibrary } = await import("@shared/schema");
  const { inArray } = await import("drizzle-orm");
  return (await db
    .select()
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.tpId, tpIds))) as Record<string, unknown>[];
}

interface DerivedCreatives {
  personagem: string;
  hooksLabel: string;
  bodyLabel: string;
  ctaLabel: string;
  tema: string;
  nomeFinais: string[];
}

function deriveFromBiblioteca(rows: Record<string, unknown>[], fallbackTema: string): DerivedCreatives {
  const str = (v: unknown) => (v == null ? "" : String(v));
  const nomeFinais = rows.map((r) => str(r.nomeFinal)).filter(Boolean);
  const personagens = rows.map((r) => str(r.personagem)).filter(Boolean);
  const personagem = personagens[0] || "";

  const hooks = new Set<number>();
  const bodies = new Set<number>();
  const ctas = new Set<number>();
  for (const r of rows) {
    const hay = `${str(r.nomeDrive)} ${str(r.hook)} ${str(r.corpo)} ${str(r.cta)}`;
    for (const m of hay.matchAll(/\bh\s*(\d+)/gi)) hooks.add(parseInt(m[1], 10));
    for (const m of hay.matchAll(/\bb\s*(\d+)/gi)) bodies.add(parseInt(m[1], 10));
    for (const m of hay.matchAll(/\b(?:c|cta)\s*(\d+)/gi)) ctas.add(parseInt(m[1], 10));
  }
  const hooksArr = [...hooks].sort((a, b) => a - b);
  const hooksLabel =
    hooksArr.length > 1
      ? `h${String(hooksArr[0]).padStart(2, "0")} a h${String(hooksArr[hooksArr.length - 1]).padStart(2, "0")}`
      : hooksArr.length === 1
        ? `h${String(hooksArr[0]).padStart(2, "0")}`
        : "";
  const bodyLabel = bodies.size ? `b${[...bodies].sort((a, b) => a - b).join("/")}` : "";
  const ctaLabel = ctas.size ? `c${[...ctas].sort((a, b) => a - b).join("/")}` : "";

  // tema = prefixo do nomeDrive antes do personagem, senão nome da task
  let tema = fallbackTema;
  const firstDrive = str(rows[0]?.nomeDrive);
  if (firstDrive && personagem) {
    const idx = firstDrive.toLowerCase().indexOf(personagem.toLowerCase());
    if (idx > 0) tema = firstDrive.slice(0, idx).replace(/[_\-.\s]+$/g, "").replace(/[_]+/g, " ").trim() || fallbackTema;
  }
  return { personagem, hooksLabel, bodyLabel, ctaLabel, tema, nomeFinais };
}

function buildConjuntoNome(p: {
  nn: number;
  publico: string;
  personagem: string;
  tema: string;
  hooksLabel: string;
  bodyLabel: string;
  ctaLabel: string;
}): string {
  // Formato real da Turbo (ref: subir-ana-bastidores.ts):
  // "{NN} - [IG] [{Público}] [Stories & Feed & Reels] [{Personagem}] - {Tema} - {hooks} | {body} | {cta}"
  const right = [p.hooksLabel, p.bodyLabel, p.ctaLabel].filter(Boolean).join(" | ");
  const personagem = p.personagem || "?";
  const tema = p.tema || "?";
  return `${p.nn} - [IG] [${p.publico}] [Stories & Feed & Reels] [${personagem}] - ${tema}${right ? " - " + right : ""}`;
}

// ============== planejamento ==============

/** LotePlan "vazio" para um lote pulado (não-criativo, YouTube, etc.). */
export function buildSkipPlan(
  task: cu.ClickUpTask,
  reason: string,
  trigger?: cu.ClickUpTask,
): LotePlan {
  return {
    taskId: task.id, taskName: task.name, taskUrl: task.url,
    triggerTaskId: trigger?.id, triggerTaskUrl: trigger?.url,
    status: cu.statusName(task), isCreative: false, skipReason: reason,
    funil: null, target: null, publico: "", verbaCents: 0, driveFolderUrl: null,
    tpIds: [], nomeFinais: [], personagem: "", conjuntoNome: "", nn: null,
    conjuntoJaExiste: false, alreadyProcessed: false, whatsappText: "", warnings: [],
  };
}

export async function planLote(
  task: cu.ClickUpTask,
  opts: { checkProcessed?: boolean; triggerTaskId?: string; triggerTaskUrl?: string } = {},
): Promise<LotePlan> {
  const warnings: string[] = [];
  const status = cu.statusName(task);

  // Filtro: a fonte (task mãe) deve PARECER criativo. As subtasks de produção
  // (Edição, Design, "Editar criativos") não viram lote. A mãe casa "vv-/img-/car-".
  const tipoTask = cu.cfLabels(task, cfg.FIELD.tipoTask)[0] ?? "";
  const isCreative = CREATIVE_NAME_RE.test(task.name) || /criativo/i.test(tipoTask);
  if (!isCreative) {
    const skip = buildSkipPlan(
      task,
      "não parece criativo (provável etapa de produção: edição/design)",
    );
    skip.triggerTaskId = opts.triggerTaskId;
    skip.triggerTaskUrl = opts.triggerTaskUrl;
    return skip;
  }

  const funil = cu.cfLabels(task, cfg.FIELD.funil)[0] ?? null;
  const target = cfg.resolveFunilTarget(funil);
  if (!funil) warnings.push("Campo 'Funil' vazio — não sei qual campanha Meta usar.");
  else if (!target) warnings.push(`Funil "${funil}" não está mapeado em FUNIL_TARGETS (config.ts).`);

  const publico = cu.cfText(task, cfg.FIELD.publicoAlvo) ?? "Aberto";
  const verbaCents = parseVerbaCents(
    cu.cfText(task, cfg.FIELD.verba),
    target?.defaultDailyBudgetCents ?? 2000,
  );
  const driveFolderUrl = extractDriveFolder(task.description || task.text_content);
  if (!driveFolderUrl) warnings.push("Sem link de pasta do Drive na descrição da task.");

  const tpIds = parseTpRange(cu.cfText(task, cfg.FIELD.rangeTPs));
  let nomeFinais: string[] = [];
  let derived: DerivedCreatives = {
    personagem: "",
    hooksLabel: "",
    bodyLabel: "",
    ctaLabel: "",
    tema: task.name,
    nomeFinais: [],
  };
  if (tpIds.length) {
    try {
      const rows = await readBibliotecaByTps(tpIds);
      if (rows.length) {
        derived = deriveFromBiblioteca(rows, task.name);
        nomeFinais = derived.nomeFinais;
        if (rows.length < tpIds.length)
          warnings.push(`Range tem ${tpIds.length} TPs, mas só ${rows.length} achados na Biblioteca.`);
      } else {
        warnings.push(`Nenhum dos TPs (${tpIds.join(", ")}) encontrado na Biblioteca.`);
      }
    } catch (e) {
      warnings.push(`Não consegui ler a Biblioteca (DB): ${(e as Error).message}`);
    }
  } else {
    warnings.push("Campo 'Range dos TPs' vazio — derivei personagem/hooks do nome da task (confira).");
  }
  // Fallback: sem dados da Biblioteca, tira o que der do nome da task.
  if (!derived.personagem) {
    const fromName = parseCreativeName(task.name);
    derived = {
      ...derived,
      personagem: fromName.personagem,
      hooksLabel: derived.hooksLabel || fromName.hooksLabel,
      bodyLabel: derived.bodyLabel || fromName.bodyLabel,
      ctaLabel: derived.ctaLabel || fromName.ctaLabel,
    };
  }

  // sequência + nome do conjunto (Meta reads são read-only, ok em dry-run)
  let nn: number | null = null;
  let conjuntoJaExiste = false;
  let conjuntoNome = "";
  if (target) {
    nn = await nextSequence(target.campaignId);
    conjuntoNome = buildConjuntoNome({
      nn,
      publico,
      personagem: derived.personagem,
      tema: derived.tema,
      hooksLabel: derived.hooksLabel,
      bodyLabel: derived.bodyLabel,
      ctaLabel: derived.ctaLabel,
    });
    conjuntoJaExiste = await adsetNameExists(target.campaignId, conjuntoNome);
    if (conjuntoJaExiste) warnings.push(`Já existe conjunto com o nome "${conjuntoNome}".`);
  }

  let alreadyProcessed = false;
  if (opts.checkProcessed) {
    try {
      const comments = await cu.getComments(task.id);
      alreadyProcessed = comments.some((c) => (c.comment_text || "").includes(cfg.PROCESSED_MARKER));
    } catch {
      /* segue sem marcar */
    }
  }

  const plan: LotePlan = {
    taskId: task.id,
    taskName: task.name,
    taskUrl: task.url,
    triggerTaskId: opts.triggerTaskId,
    triggerTaskUrl: opts.triggerTaskUrl,
    status,
    isCreative: true,
    funil,
    target,
    publico,
    verbaCents,
    driveFolderUrl,
    tpIds,
    nomeFinais,
    personagem: derived.personagem,
    conjuntoNome,
    nn,
    conjuntoJaExiste,
    alreadyProcessed,
    whatsappText: "",
    warnings,
  };
  plan.whatsappText = buildMessage(plan);
  return plan;
}

function gerenciadorCampanha(campaignId: string): string {
  const acc = cfg.META_ACC.replace("act_", "");
  return `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${acc}&selected_campaign_ids=${campaignId}`;
}

export function buildMessage(plan: LotePlan): string {
  const verba = (plan.verbaCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const linhas: string[] = [];
  linhas.push(`🟢 *Lote pronto pra subir no Meta* — "${plan.taskName}"`);
  linhas.push("");
  if (plan.target) {
    linhas.push(`Criei o conjunto (PAUSED) na campanha, clonado do template, ${verba}/dia:`);
    linhas.push(`• *Conjunto:* ${plan.conjuntoNome}`);
  } else {
    linhas.push(`⚠️ Funil sem campanha mapeada — não criei conjunto. Resolve o Funil na task.`);
  }
  if (plan.driveFolderUrl) {
    linhas.push(`• *Criativos (Drive):* ${plan.driveFolderUrl}`);
  } else {
    linhas.push(`• *Criativos:* ⚠️ sem pasta do Drive na task`);
  }
  if (plan.nomeFinais.length) {
    linhas.push("");
    linhas.push(`*Nomeie cada anúncio assim (Biblioteca):*`);
    for (const nf of plan.nomeFinais) linhas.push(`   ‣ ${nf}`);
  }
  linhas.push("");
  linhas.push(`👉 *Faça o upload dos criativos no Gerenciador* (a API é dev-tier, não tenho quota pro upload).`);
  if (plan.target) linhas.push(gerenciadorCampanha(plan.target.campaignId));
  if (plan.warnings.length) {
    linhas.push("");
    linhas.push(`_Avisos: ${plan.warnings.join(" | ")}_`);
  }
  return linhas.join("\n");
}

// ============== execução (gated por dry-run) ==============

export async function executeLote(
  plan: LotePlan,
  opts: { sendWhatsapp?: boolean; comment?: boolean; moveStatus?: boolean } = {},
): Promise<LotePlan> {
  if (cfg.runtime.dryRun) return plan;
  // No fluxo CLI tudo liga por padrão; a automação semanal passa tudo false e
  // controla o ClickUp ela mesma (status só vai p/ "upado" quando o lote fecha).
  const sendWhatsapp = opts.sendWhatsapp ?? true;
  const doComment = opts.comment ?? true;
  const moveStatus = opts.moveStatus ?? true;
  /** Subtask "Subir ad" recebe o status/comentário; fallback p/ a própria task (CLI). */
  const statusTarget = plan.triggerTaskId ?? plan.taskId;
  plan.result = {};

  // 1. cria conjunto (clone, sem ads) — só se tem target e ainda não existe
  if (plan.target && plan.nn != null && !plan.conjuntoJaExiste) {
    const tpl = await metaGet(plan.target.templateAdsetId, {
      fields: "billing_event,optimization_goal,bid_strategy,promoted_object,attribution_spec,targeting",
    });
    const res = await metaPostForm(`${cfg.META_ACC}/adsets`, {
      name: plan.conjuntoNome,
      campaign_id: plan.target.campaignId,
      daily_budget: String(plan.verbaCents),
      billing_event: tpl.billing_event,
      optimization_goal: tpl.optimization_goal,
      bid_strategy: tpl.bid_strategy,
      promoted_object: tpl.promoted_object,
      attribution_spec: tpl.attribution_spec,
      targeting: tpl.targeting,
      status: "PAUSED",
    });
    plan.result.adsetId = res.id;
  }

  // 2. WhatsApp (Evolution/TurboZap)
  if (sendWhatsapp) {
    if (cfg.WPP_DEST) {
      const { enviarMensagemWhatsApp } = await import("../turbozap");
      const r = await enviarMensagemWhatsApp(cfg.WPP_DEST, plan.whatsappText, cfg.WPP_INSTANCE);
      plan.result.whatsappSent = r.success;
      if (!r.success) plan.warnings.push(`WhatsApp falhou: ${r.error}`);
    } else {
      plan.warnings.push("ADS_PIPELINE_WPP_DEST vazio — não enviei WhatsApp.");
    }
  }

  // 3. comenta na task (marcador de idempotência)
  if (doComment) {
    const adsetTxt = plan.result.adsetId ? ` Conjunto ${plan.result.adsetId} criado (PAUSED).` : "";
    await cu.addComment(
      statusTarget,
      `${cfg.PROCESSED_MARKER} Pipeline preparou o lote.${adsetTxt} Falta o upload manual dos criativos no Gerenciador.`,
    );
    plan.result.commented = true;
  }

  // 4. move status (opcional)
  if (moveStatus && cfg.DONE_STATUS) {
    await cu.setStatus(statusTarget, cfg.DONE_STATUS);
    plan.result.statusMoved = true;
  }
  return plan;
}

// ============== entradas de alto nível ==============

export async function runOverList(): Promise<LotePlan[]> {
  const tasks = await cu.listTasksByStatus(cfg.ANUNCIOS_LIST_ID, [cfg.TRIGGER_STATUS]);
  const plans: LotePlan[] = [];
  for (const t of tasks) {
    const plan = await planLote(t, { checkProcessed: true });
    if (!plan.isCreative || plan.alreadyProcessed) {
      plans.push(plan); // não-criativo ou já processado: lista, mas não executa
      continue;
    }
    await executeLote(plan);
    plans.push(plan);
  }
  return plans;
}

export async function runSingleTask(taskId: string): Promise<LotePlan> {
  const task = await cu.getTask(taskId);
  const plan = await planLote(task, { checkProcessed: true });
  await executeLote(plan);
  return plan;
}

// ============== automação semanal (gatilho "Subir ad") ==============

/**
 * Coleta os lotes da automação a partir das subtasks "Subir ad" em `to do`:
 *  - filtra as subtasks-gatilho (nome ~ /subir/i OU assignee Caio);
 *  - resolve a task MÃE (onde moram Funil/Público/Verba/Range/Drive) e a usa como fonte;
 *  - deduplica por mãe (várias "Subir ad" sob a mesma mãe = 1 lote);
 *  - pula lotes marcados Formato=YouTube.
 * Read-only — NÃO escreve em Meta/ClickUp. Respeita MAX_LOTES.
 * O `triggerTaskId` de cada plano aponta p/ a subtask (p/ mover status depois).
 */
export async function planAutomationLotes(): Promise<LotePlan[]> {
  const subtasks = await cu.listTasksByStatus(cfg.ANUNCIOS_LIST_ID, [cfg.TRIGGER_STATUS]);
  const triggers = subtasks.filter(
    (t) => cfg.TRIGGER_NAME_RE.test(t.name) || cu.hasAssignee(t, cfg.TRIGGER_ASSIGNEE_ID),
  );

  // dedup por mãe (ou pela própria task quando não há mãe / USE_PARENT desligado)
  const seen = new Set<string>();
  const lotes: { trigger: cu.ClickUpTask; sourceId: string }[] = [];
  for (const t of triggers) {
    const parentId = cfg.USE_PARENT_FIELDS ? t.parent || null : null;
    const sourceId = parentId || t.id;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    lotes.push({ trigger: t, sourceId });
  }
  const limited = cfg.MAX_LOTES > 0 ? lotes.slice(0, cfg.MAX_LOTES) : lotes;

  const plans: LotePlan[] = [];
  for (const { trigger, sourceId } of limited) {
    // fonte dos campos = mãe (quando há) — buscar a task completa com custom_fields
    let source = trigger;
    if (sourceId !== trigger.id) {
      try {
        source = await cu.getTask(sourceId);
      } catch {
        source = trigger; // sem a mãe, planeja com a própria subtask (gera warnings)
      }
    }
    // pula lotes marcados YouTube no campo Formato (plataforma), se configurado
    if (cfg.FIELD_FORMATO_PLATAFORMA) {
      const fmt = cu.cfLabels(source, cfg.FIELD_FORMATO_PLATAFORMA).map((s) => s.toLowerCase());
      if (fmt.some((f) => f.includes("youtube"))) {
        plans.push(buildSkipPlan(source, "Formato = YouTube (pula Meta Ads)", trigger));
        continue;
      }
    }
    const plan = await planLote(source, {
      checkProcessed: true,
      triggerTaskId: trigger.id,
      triggerTaskUrl: trigger.url,
    });
    plans.push(plan);
  }
  return plans;
}
