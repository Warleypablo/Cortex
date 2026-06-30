/**
 * Agente semanal de subida de ads (ClickUp "Subir ad" → Meta).
 *
 * Toda segunda (≥ TRIGGER_HOUR), para cada subtask-gatilho em `to do`:
 *   1. planeja o lote a partir da task MÃE (Funil/Público/Verba/Range TPs/Drive) — `planAutomationLotes`;
 *   2. cria o CONJUNTO (PAUSED) clonando o template, com a nomenclatura certa — `executeLote`;
 *   3. HÍBRIDO: descobre os vídeos já no Gerenciador (por nome) e cria os ANÚNCIOS pareados
 *      (PAUSED); se algum vídeo não está lá / cota estourou → marca `awaiting_manual_upload`
 *      (o vídeo sobe manual e o próximo run completa);
 *   4. atualiza o ClickUp (status → "upado" no sucesso; comentário no aguardando/erro).
 *
 * Cada execução vira 1 linha em `ads_automation_runs` (1/semana) e cada lote 1 `ads_automation_steps`
 * — é isso que o painel read-only no Cortex mostra (agora / vai fazer / já fez).
 *
 * In-process (igual aos snapshots inadimplência/saldo): guarda horária + recoverOnStartup.
 * dry-run (ADS_PIPELINE_DRY_RUN != 0, padrão) = planeja e persiste os steps, NÃO escreve no Meta/ClickUp.
 *
 * ⚠️ Render roda em UTC — setar TZ=America/Sao_Paulo p/ o horário bater (getDay/getHours usam TZ do processo).
 */
import { db } from "../db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { adsAutomationRuns, adsAutomationSteps, creativesLibrary } from "@shared/schema";
import * as cfg from "./adsPipeline/config";
import * as cu from "./adsPipeline/clickupClient";
import { planAutomationLotes, executeLote, type LotePlan } from "./adsPipeline/pipeline";
import { metaGet } from "./adsCreation/metaApi";
import {
  findPairedVideosByExactName,
  createPairedVideoAdsBatched,
  withBackoff,
  isRateLimit,
  type PairTarget,
  type PairedAdSpec,
  type ReusedCopy,
} from "./adsCreation/lotUploader";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1h
const TRIGGER_DOW = 1; // 0=domingo, 1=segunda
const TRIGGER_HOUR = parseInt(process.env.ADS_AUTOMATION_HOUR || "8", 10);
const LOG = "[ads-automation]";

// ===================== helpers de data =====================

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Segunda-feira (YYYY-MM-DD) da semana de `d`, na TZ do processo. */
export function mondayOf(d: Date): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay();
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow));
  return formatDate(date);
}

/** Próxima segunda às TRIGGER_HOUR (ISO) — só p/ exibição no painel (/next). */
export function nextRunAt(from: Date): string {
  const d = new Date(from);
  d.setHours(TRIGGER_HOUR, 0, 0, 0);
  // avança até cair numa segunda no futuro
  while (d.getDay() !== TRIGGER_DOW || d.getTime() <= from.getTime()) {
    d.setDate(d.getDate() + 1);
    d.setHours(TRIGGER_HOUR, 0, 0, 0);
  }
  return d.toISOString();
}

// ===================== acesso ao banco =====================

async function runExistsForWeek(weekOf: string): Promise<boolean> {
  const rows = await db
    .select({ id: adsAutomationRuns.id })
    .from(adsAutomationRuns)
    .where(eq(adsAutomationRuns.weekOf, weekOf))
    .limit(1);
  return rows.length > 0;
}

/** Cria o run da semana. Retorna o id, ou null se já existe (idempotência via unique week_of). */
async function createRun(weekOf: string, triggeredBy: string, dryRun: boolean): Promise<number | null> {
  const inserted = await db
    .insert(adsAutomationRuns)
    .values({ weekOf, triggeredBy, dryRun, status: "running" })
    .onConflictDoNothing({ target: adsAutomationRuns.weekOf })
    .returning({ id: adsAutomationRuns.id });
  return inserted[0]?.id ?? null;
}

async function insertStep(runId: number, ordem: number, plan: LotePlan): Promise<void> {
  await db
    .insert(adsAutomationSteps)
    .values({
      runId,
      ordem,
      clickupTaskId: plan.triggerTaskId ?? plan.taskId,
      clickupParentId: plan.triggerTaskId ? plan.taskId : null,
      loteNome: plan.conjuntoNome || plan.taskName,
      clickupUrl: plan.triggerTaskUrl ?? plan.taskUrl,
      status: "pending",
      warnings: plan.warnings,
      planSnapshot: plan as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: [adsAutomationSteps.runId, adsAutomationSteps.clickupTaskId] });
}

async function patchStep(stepId: number, patch: Partial<typeof adsAutomationSteps.$inferInsert>): Promise<void> {
  await db.update(adsAutomationSteps).set(patch).where(eq(adsAutomationSteps.id, stepId));
}

/** Recalcula os totais do run a partir dos steps e fecha (success/partial/error). */
async function finalizeRun(runId: number, fatalError?: string): Promise<void> {
  const steps = await db
    .select()
    .from(adsAutomationSteps)
    .where(eq(adsAutomationSteps.runId, runId));

  const done = steps.filter((s) => s.status === "done").length;
  const awaiting = steps.filter((s) => s.status === "awaiting_manual_upload").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const conjuntos = steps.filter((s) => s.conjuntoId).length;
  const ads = steps.reduce((acc, s) => acc + (Array.isArray(s.adIds) ? s.adIds.length : 0), 0);
  const total = steps.filter((s) => s.status !== "skipped").length;

  const status = fatalError ? "error" : failed || awaiting ? "partial" : "success";

  await db
    .update(adsAutomationRuns)
    .set({
      status,
      lotesTotal: total,
      lotesDone: done,
      lotesAwaitingUpload: awaiting,
      lotesFailed: failed,
      conjuntosCriados: conjuntos,
      adsCriados: ads,
      errorMessage: fatalError ?? null,
      finishedAt: new Date(),
    })
    .where(eq(adsAutomationRuns.id, runId));
}

// ===================== Meta: copy + adset lookup =====================

/** Clona a copy (texto/link/cta/UTM) do 1º ad de um conjunto de referência (= template do funil). */
async function cloneCopyFromAdset(refAdsetId: string): Promise<ReusedCopy> {
  const refAds = await withBackoff("GET ref creative", () =>
    metaGet(`${refAdsetId}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }),
  );
  const refCre = refAds.data?.[0]?.creative ?? {};
  const afs = refCre.asset_feed_spec ?? {};
  const oss = refCre.object_story_spec ?? {};
  const vd = oss.video_data ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");
  return {
    message: afs.bodies?.[0]?.text || vd.message || "",
    title: afs.titles?.[0]?.text || vd.title,
    link: afs.link_urls?.[0]?.website_url || vd.call_to_action?.value?.link || vd.link_description || "",
    cta: afs.call_to_action_types?.[0] || vd.call_to_action?.type || "LEARN_MORE",
    urlTags,
    pageId: oss.page_id ?? cfg.META_PAGE_ID,
    ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? cfg.META_IG_USER_ID,
  };
}

/** Resolve o id do conjunto pelo nome dentro da campanha (quando já existe / executeLote não retornou). */
async function findAdsetIdByName(campaignId: string, name: string): Promise<string | null> {
  const data = await withBackoff("GET adsets", () => metaGet(`${campaignId}/adsets`, { fields: "id,name", limit: "400" }));
  const found = (data?.data ?? []).find((s: { id: string; name: string }) => s.name === name);
  return found?.id ?? null;
}

// ===================== HÍBRIDO: descoberta + criação dos ads =====================

interface UploadResult {
  status: "done" | "awaiting_manual_upload" | "failed";
  adIds: string[];
  detalhe: string;
}

/**
 * Cria os anúncios pareados (9x16+4x5) PAUSED no conjunto, descobrindo os vídeos JÁ no Gerenciador
 * pelo nome (nomeDrive da Biblioteca). Quem não tem vídeo lá vira `awaiting_manual_upload`.
 * Idempotente: pula TPs que já viraram ad no conjunto.
 */
async function tryHybridUpload(plan: LotePlan, adsetId: string, refAdsetId: string): Promise<UploadResult> {
  if (!plan.tpIds.length) {
    return { status: "awaiting_manual_upload", adIds: [], detalhe: "Sem Range dos TPs — não dá p/ descobrir os vídeos. Subir manualmente." };
  }

  const rows = (await db
    .select({
      tpId: creativesLibrary.tpId,
      nomeDrive: creativesLibrary.nomeDrive,
      nomeFinal: creativesLibrary.nomeFinal,
      personagem: creativesLibrary.personagem,
    })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.tpId, plan.tpIds))) as Array<{
    tpId: string;
    nomeDrive: string | null;
    nomeFinal: string | null;
    personagem: string | null;
  }>;

  if (!rows.length) {
    return { status: "awaiting_manual_upload", adIds: [], detalhe: `Nenhum dos TPs (${plan.tpIds.join(", ")}) na Biblioteca.` };
  }

  const targets: PairTarget[] = rows.map((r) => ({ key: r.tpId, base: r.nomeDrive ?? "" }));
  const metaByTp = new Map(rows.map((r) => [r.tpId, r]));

  const { pairs } = await findPairedVideosByExactName(cfg.META_ACC, targets, { log: (m) => console.log(`${LOG} ${m}`) });

  const ready: PairedAdSpec[] = [];
  const missing: string[] = [];
  for (const t of targets) {
    const p = pairs.get(t.key);
    const m = metaByTp.get(t.key)!;
    if (!p?.v9 || !p?.v4) {
      missing.push(`${t.key}${!p?.v9 ? " (falta 9x16)" : " (falta 4x5)"}`);
      continue;
    }
    ready.push({ tpId: t.key, finalName: m.nomeFinal || `${t.key} ${t.base}`, v9: p.v9, v45: p.v4 });
  }

  if (!ready.length) {
    return {
      status: "awaiting_manual_upload",
      adIds: [],
      detalhe: `Vídeos ainda não estão no Gerenciador. Subir manualmente: ${missing.join(", ")}.`,
    };
  }

  // copy do conjunto de referência (template do funil)
  const copy = await cloneCopyFromAdset(refAdsetId);
  if (!copy.message || !copy.link) {
    return { status: "failed", adIds: [], detalhe: "Copy/link do template vieram vazios — revisar conjunto de referência." };
  }

  // idempotência: pula TPs que já viraram ad no conjunto
  const adsNow = await withBackoff("GET ads conjunto", () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
  const existingNames: string[] = (adsNow?.data ?? []).map((a: { name: string }) => a.name);
  const toCreate = ready.filter((a) => !existingNames.some((n) => n.startsWith(`${a.tpId} `) || n === a.finalName));

  let adIds: string[] = [];
  let errors: string[] = [];
  if (toCreate.length) {
    const res = await createPairedVideoAdsBatched(cfg.META_ACC, adsetId, toCreate, copy, { log: (m) => console.log(`${LOG} ${m}`) });
    adIds = res.adIds;
    errors = res.errors;
  }

  const skippedExisting = ready.length - toCreate.length;
  if (missing.length) {
    return {
      status: "awaiting_manual_upload",
      adIds,
      detalhe: `${adIds.length} ad(s) criado(s)${skippedExisting ? `, ${skippedExisting} já existia(m)` : ""}. Faltam vídeos no Gerenciador: ${missing.join(", ")}.`,
    };
  }
  if (errors.length) {
    return { status: "failed", adIds, detalhe: `${adIds.length} ad(s) criado(s), ${errors.length} erro(s): ${errors.slice(0, 3).join(" | ")}` };
  }
  return {
    status: "done",
    adIds,
    detalhe: `${adIds.length} ad(s) criado(s) (PAUSED)${skippedExisting ? `, ${skippedExisting} já existia(m)` : ""}. Conjunto pronto p/ revisão.`,
  };
}

// ===================== processamento de 1 step =====================

async function processStep(step: typeof adsAutomationSteps.$inferSelect): Promise<void> {
  const plan = step.planSnapshot as unknown as LotePlan | null;
  if (!plan) {
    await patchStep(step.id, { status: "failed", detalhe: "planSnapshot ausente", finishedAt: new Date() });
    return;
  }

  // pula não-criativo / já processado
  if (!plan.isCreative) {
    await patchStep(step.id, { status: "skipped", detalhe: plan.skipReason ?? "não é criativo", finishedAt: new Date() });
    return;
  }
  if (plan.alreadyProcessed) {
    await patchStep(step.id, { status: "skipped", detalhe: "já processado em run anterior (marcador no ClickUp)", finishedAt: new Date() });
    return;
  }
  if (!plan.target) {
    await patchStep(step.id, {
      status: "failed",
      detalhe: `Funil "${plan.funil ?? "?"}" sem campanha mapeada (FUNIL_TARGETS). Mapear antes de subir.`,
      finishedAt: new Date(),
    });
    return;
  }

  await patchStep(step.id, { status: "running", startedAt: new Date(), attempts: (step.attempts ?? 0) + 1 });

  try {
    // 1. conjunto (PAUSED, clone do template) — a automação controla o ClickUp ela mesma
    await executeLote(plan, { sendWhatsapp: false, comment: false, moveStatus: false });
    const adsetId = plan.result?.adsetId ?? (await findAdsetIdByName(plan.target.campaignId, plan.conjuntoNome));
    if (!adsetId) {
      await patchStep(step.id, { status: "failed", detalhe: "Não consegui criar/encontrar o conjunto no Meta.", finishedAt: new Date() });
      return;
    }

    // 2. HÍBRIDO: descobre vídeos + cria ads pareados
    const up = await tryHybridUpload(plan, adsetId, plan.target.templateAdsetId);

    await patchStep(step.id, {
      status: up.status,
      conjuntoId: adsetId,
      adIds: up.adIds,
      detalhe: up.detalhe,
      finishedAt: new Date(),
    });

    // 3. ClickUp
    await syncClickUp(plan, up, adsetId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isRateLimit(e)) {
      await patchStep(step.id, {
        status: "awaiting_manual_upload",
        detalhe: `Cota/limite da Meta — retoma no próximo run. (${msg})`,
        finishedAt: new Date(),
      });
    } else {
      await patchStep(step.id, { status: "failed", detalhe: msg, finishedAt: new Date() });
    }
  }
}

/** Atualiza o ClickUp conforme o resultado do lote (gated por dry-run). */
async function syncClickUp(plan: LotePlan, up: UploadResult, adsetId: string): Promise<void> {
  if (cfg.runtime.dryRun) return;
  const target = plan.triggerTaskId ?? plan.taskId;
  try {
    if (up.status === "done") {
      await cu.addComment(target, `${cfg.PROCESSED_MARKER} Conjunto ${adsetId} (PAUSED) + ${up.adIds.length} ad(s). ${up.detalhe}`);
      if (cfg.DONE_STATUS) await cu.setStatus(target, cfg.DONE_STATUS);
    } else if (up.status === "awaiting_manual_upload") {
      await cu.addComment(target, `${cfg.AWAITING_UPLOAD_MARKER} Conjunto ${adsetId} (PAUSED) criado. ${up.detalhe}`);
    } else {
      await cu.addComment(target, `⛔ Falha ao subir o lote. ${up.detalhe}`);
    }
  } catch (e) {
    console.error(`${LOG} ClickUp update falhou (${target}):`, e instanceof Error ? e.message : e);
  }
}

async function processPendingSteps(runId: number): Promise<void> {
  const steps = await db
    .select()
    .from(adsAutomationSteps)
    .where(and(eq(adsAutomationSteps.runId, runId), inArray(adsAutomationSteps.status, ["pending", "awaiting_manual_upload", "running"])))
    .orderBy(adsAutomationSteps.ordem);

  for (const step of steps) {
    await processStep(step);
  }
}

// ===================== execução de alto nível =====================

/** Roda a semana inteira: planeja → persiste steps → (se live) executa → finaliza. */
export async function runWeekly(triggeredBy: string): Promise<{ runId: number | null; skipped?: string }> {
  const now = new Date();
  const weekOf = mondayOf(now);
  const dryRun = cfg.runtime.dryRun;

  const runId = await createRun(weekOf, triggeredBy, dryRun);
  if (runId == null) {
    console.log(`${LOG} run da semana ${weekOf} já existe — pulando (idempotência).`);
    return { runId: null, skipped: "run da semana já existe" };
  }
  console.log(`${LOG} run #${runId} (${weekOf}, ${triggeredBy}, ${dryRun ? "DRY" : "LIVE"}) — planejando...`);

  try {
    const plans = await planAutomationLotes();
    let ordem = 0;
    for (const plan of plans) await insertStep(runId, ordem++, plan);

    if (dryRun) {
      // dry-run: steps ficam "pending" (= o que FARIA); não escreve no Meta/ClickUp.
      await finalizeRun(runId);
      console.log(`${LOG} run #${runId} DRY — ${plans.length} lote(s) planejado(s) (não executados).`);
      return { runId };
    }

    await processPendingSteps(runId);
    await finalizeRun(runId);
    console.log(`${LOG} run #${runId} concluído.`);
    return { runId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${LOG} run #${runId} falhou:`, msg);
    await finalizeRun(runId, msg);
    return { runId };
  }
}

/** Retoma um run deixado `running` (restart no meio) reaproveitando os steps persistidos. */
async function resumeRun(runId: number): Promise<void> {
  console.log(`${LOG} retomando run #${runId} (recoverOnStartup)...`);
  if (cfg.runtime.dryRun) {
    await finalizeRun(runId);
    return;
  }
  try {
    await processPendingSteps(runId);
    await finalizeRun(runId);
  } catch (e) {
    await finalizeRun(runId, e instanceof Error ? e.message : String(e));
  }
}

/** Disparo manual (endpoint admin / CLI). Respeita a idempotência semanal. */
export async function runAdsAutomationNow(triggeredBy = "manual"): Promise<{ runId: number | null; skipped?: string }> {
  return runWeekly(triggeredBy);
}

/** Info para o painel: próxima execução + lotes pendentes do run mais recente. */
export async function getNextRunInfo(): Promise<{
  nextRunAt: string;
  currentWeekOf: string;
  runExistsThisWeek: boolean;
  planned: Array<{ loteNome: string | null; clickupTaskId: string; status: string }>;
}> {
  const now = new Date();
  const currentWeekOf = mondayOf(now);
  const runExistsThisWeek = await runExistsForWeek(currentWeekOf);

  const latest = await db
    .select({ id: adsAutomationRuns.id })
    .from(adsAutomationRuns)
    .orderBy(desc(adsAutomationRuns.startedAt))
    .limit(1);

  let planned: Array<{ loteNome: string | null; clickupTaskId: string; status: string }> = [];
  if (latest[0]) {
    planned = await db
      .select({ loteNome: adsAutomationSteps.loteNome, clickupTaskId: adsAutomationSteps.clickupTaskId, status: adsAutomationSteps.status })
      .from(adsAutomationSteps)
      .where(and(eq(adsAutomationSteps.runId, latest[0].id), inArray(adsAutomationSteps.status, ["pending", "running", "awaiting_manual_upload"])))
      .orderBy(adsAutomationSteps.ordem);
  }

  return { nextRunAt: nextRunAt(now), currentWeekOf, runExistsThisWeek, planned };
}

// ===================== agendamento (in-process) =====================

async function tick(): Promise<void> {
  const now = new Date();
  if (now.getDay() !== TRIGGER_DOW || now.getHours() < TRIGGER_HOUR) return;
  if (await runExistsForWeek(mondayOf(now))) return;
  console.log(`${LOG} janela de segunda detectada (${now.toISOString()}) — executando...`);
  await runWeekly("schedule");
}

async function recoverOnStartup(): Promise<void> {
  // 1. retoma runs órfãos (deixados `running` por restart no meio)
  const orphans = await db
    .select({ id: adsAutomationRuns.id })
    .from(adsAutomationRuns)
    .where(eq(adsAutomationRuns.status, "running"))
    .orderBy(desc(adsAutomationRuns.startedAt));
  for (const o of orphans) await resumeRun(o.id);

  // 2. janela de segunda perdida (server estava off no horário)
  const now = new Date();
  if (now.getDay() === TRIGGER_DOW && now.getHours() >= TRIGGER_HOUR && !(await runExistsForWeek(mondayOf(now)))) {
    console.log(`${LOG} recovery: janela de segunda perdida — disparando...`);
    await runWeekly("recovery");
  }
}

export function setupAdsAutomationJob(): void {
  setTimeout(() => {
    recoverOnStartup().catch((err) => console.error(`${LOG} recoverOnStartup erro:`, err));
  }, 45_000);

  setInterval(() => {
    tick().catch((err) => console.error(`${LOG} tick erro:`, err));
  }, CHECK_INTERVAL_MS);

  console.log(`${LOG} agendado — checagem horária, dispara segunda às ${TRIGGER_HOUR}:00 (TZ do processo).`);
}
