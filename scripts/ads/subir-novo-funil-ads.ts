/**
 * Bootstrap de FUNIL NOVO — cria a CAMPANHA (CBO) + conjunto(s) + ads PAREADOS de um lote (--data)
 * quando ainda NÃO existe campanha nem conjunto-irmão pra clonar.
 *
 * Diferente do subir-pareado-ads.ts (que exige CAMPAIGN + CLONE_ADSET existentes e clona a copy
 * do irmão), aqui:
 *   - a CAMPANHA é criada (idempotente por nome exato) a partir de CAMPAIGN_NAME/OBJECTIVE/DAILY_BUDGET;
 *   - a CONFIG técnica (segmentação/otimização/atribuição/promoted_object/url_tags/page/ig) é clonada
 *     de um conjunto ANÁLOGO (CONFIG_ADSET) de outro funil;
 *   - a COPY (texto/título/cta) vem EXPLÍCITA do data file (COPY), com link = PLACEHOLDER_LINK
 *     (funil sem LP pronta → reaponta depois). Tudo nasce PAUSED.
 *
 *   npx tsx scripts/ads/subir-novo-funil-ads.ts --data ./scripts/ads/comunidade-bastidores.data.ts        # DRY
 *   npx tsx scripts/ads/subir-novo-funil-ads.ts --data ./scripts/ads/comunidade-bastidores.data.ts --go     # cria
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, inArray } from "drizzle-orm";
import { metaGet, metaPostForm } from "../../server/services/adsCreation/metaApi";
import { findPairedVideosByExactName, createPairedVideoAdsBatched, withBackoff, type PairTarget, type PairedAdSpec, type ReusedCopy } from "../../server/services/adsCreation/lotUploader";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";
const go = process.argv.includes("--go");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
function dataArg(): string { const i = process.argv.indexOf("--data"); if (i < 0 || !process.argv[i + 1]) throw new Error("passe --data <caminho do .data.ts>"); return process.argv[i + 1]; }

// Meta exige `explore` junto de `explore_home` no targeting clonado (senão POST /adsets 400 code=100).
function fixTargeting(t: any) {
  if (!t) return t;
  const ig: string[] | undefined = Array.isArray(t.instagram_positions) ? [...t.instagram_positions] : undefined;
  if (ig && ig.includes("explore_home") && !ig.includes("explore")) ig.push("explore");
  return { ...t, ...(ig ? { instagram_positions: ig } : {}) };
}

type Ad = PairedAdSpec & { body: number; hook: number };

async function findCampaignByName(name: string): Promise<string | null> {
  let url: string | null = `${ACC}/campaigns`;
  let params: any = { fields: "id,name", limit: "200" };
  for (let p = 0; url && p < 20; p++) {
    const res: any = await withBackoff("GET campaigns", () => metaGet(url!, params));
    const hit = (res.data ?? []).find((c: any) => (c.name ?? "") === name);
    if (hit) return hit.id;
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { ...params, after }; else url = null;
  }
  return null;
}

(async () => {
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");
  const D: any = await import(pathToFileURL(resolve(dataArg())).href);
  const { PAIRS, CAMPAIGN_NAME, CAMPAIGN_OBJECTIVE, CAMPAIGN_DAILY_BUDGET, CONFIG_ADSET, NN_FLOOR, GROUPS, conjName, COPY, PLACEHOLDER_LINK } = D;
  if (!CAMPAIGN_NAME || !CONFIG_ADSET || !COPY?.message) throw new Error("data file precisa de CAMPAIGN_NAME, CONFIG_ADSET e COPY.message");

  // 1) casa vídeos (por nome) com a Biblioteca (por driveFileId → tpId/nomeFinal)
  const rows = await db.select().from(creativesLibrary).where(and(isNull(creativesLibrary.deletedAt), inArray(creativesLibrary.driveFileId, PAIRS.map((p: any) => p.drive9x16))));
  const byDrive = new Map(rows.map((r) => [r.driveFileId!, r]));
  const targets: PairTarget[] = [];
  const pairByTp = new Map<string, { body: number; hook: number; finalName: string }>();
  const preWarns: string[] = [];
  for (const p of PAIRS) {
    const r = byDrive.get(p.drive9x16);
    if (!r) { preWarns.push(`b${p.body}h${p.hook} (${p.base}): sem linha na Biblioteca`); continue; }
    targets.push({ key: r.tpId, base: r.nomeDrive ?? p.base });
    pairByTp.set(r.tpId, { body: p.body, hook: p.hook, finalName: r.nomeFinal });
  }
  const { pairs, pagesRead, foundAll } = await findPairedVideosByExactName(ACC, targets);
  console.log(`Descoberta de vídeos: ${pagesRead} página(s) · achou todos: ${foundAll ? "sim" : "NÃO"}`);

  const ready: Ad[] = [];
  const warns = [...preWarns];
  for (const t of targets) {
    const p = pairs.get(t.key)!;
    const m = pairByTp.get(t.key)!;
    if (!p?.v9 || !p?.v4) { warns.push(`${t.key} (${t.base}): falta ${!p?.v9 ? "9x16" : "4x5"} no Gerenciador`); continue; }
    if (p.dup9 > 1 || p.dup4 > 1) warns.push(`${t.key}: duplicata 9x16x${p.dup9} 4x5x${p.dup4}`);
    ready.push({ tpId: t.key, finalName: m.finalName, v9: p.v9, v45: p.v4, body: m.body, hook: m.hook });
  }

  // 2) config técnica clonada do CONFIG_ADSET (adset) + url_tags/page/ig do ad dele
  const cfg = await withBackoff("GET config ref", () => metaGet(CONFIG_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }));
  const refAds = await withBackoff("GET ref creative", () => metaGet(`${CONFIG_ADSET}/ads`, { fields: "creative{url_tags,object_story_spec}", limit: "1" }));
  const refCre = refAds.data?.[0]?.creative ?? {};
  const oss = refCre.object_story_spec ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");

  const copy: ReusedCopy = {
    message: COPY.message,
    title: COPY.title,
    link: COPY.link || PLACEHOLDER_LINK,
    cta: COPY.cta || "LEARN_MORE",
    urlTags,
    pageId: oss.page_id ?? DEFAULT_PAGE,
    ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };
  const usingPlaceholder = !COPY.link;

  // 3) planeja conjuntos (split por GROUPS)
  let campaignId = await findCampaignByName(CAMPAIGN_NAME);
  const existingSets: { id: string; name: string }[] = campaignId
    ? ((await withBackoff("GET adsets camp", () => metaGet(`${campaignId}/adsets`, { fields: "id,name", limit: "400" }))).data ?? [])
    : [];
  let nn = Math.max(NN_FLOOR, 0, ...existingSets.map((s) => nnOf(s.name)));
  const plan: { g: any; name: string; existingId: string | null; ads: Ad[] }[] = [];
  for (const g of GROUPS) {
    const ads = ready.filter((a) => a.body === g.body && a.hook >= g.hookMin && a.hook <= g.hookMax).sort((x, y) => x.hook - y.hook);
    if (ads.length > 6) warns.push(`${g.key}: ${ads.length} ads (>6) — revisar split`);
    const found = existingSets.find((s) => (s.name ?? "").includes(g.matchToken));
    plan.push({ g, name: found?.name ?? conjName(++nn, g), existingId: found?.id ?? null, ads });
  }

  console.log(`\nCampanha: ${campaignId ? `↩︎ já existe ${campaignId}` : "NOVA (será criada)"} — ${CAMPAIGN_NAME}`);
  console.log(`  objetivo=${CAMPAIGN_OBJECTIVE} · CBO daily=R$${(CAMPAIGN_DAILY_BUDGET / 100).toFixed(2)} (placeholder) · config clonada de ${CONFIG_ADSET}`);
  console.log(`Copy (${copy.message.length} chars): "${copy.message.slice(0, 80).replace(/\n/g, " ")}…"`);
  console.log(`  título="${copy.title}" · cta=${copy.cta} · link=${copy.link}${usingPlaceholder ? "  ⚠️ PLACEHOLDER (sem LP)" : ""}`);
  console.log(`  page=${copy.pageId} · ig=${copy.ig} · url_tags=${urlTags ? "sim" : "não"}`);
  for (const c of plan) {
    console.log(`\n• ${c.existingId ? "↩︎ existe " + c.existingId : "NOVO"} — ${c.name} (${c.ads.length} ads)`);
    for (const a of c.ads) console.log(`    ${a.finalName}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  const totalAds = plan.reduce((s, c) => s + c.ads.length, 0);
  console.log(`\nTotal: ${plan.length} conjunto(s) · ${totalAds} ads pareados · modo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }

  if (totalAds !== PAIRS.length) throw new Error(`esperava ${PAIRS.length} ads, montei ${totalAds} — rode upload/planilha antes (${warns.join(" | ")})`);

  // 4) cria a campanha (se não existe)
  if (!campaignId) {
    const created = await withBackoff("create campaign", () => metaPostForm(`${ACC}/campaigns`, {
      name: CAMPAIGN_NAME, objective: CAMPAIGN_OBJECTIVE, status: "PAUSED",
      special_ad_categories: [], buying_type: "AUCTION",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP", daily_budget: CAMPAIGN_DAILY_BUDGET,
    }));
    if (!created.id) throw new Error(`campanha "${CAMPAIGN_NAME}" sem id`);
    campaignId = created.id;
    console.log(`\n✅ campanha criada: ${campaignId} — ${CAMPAIGN_NAME} (PAUSED, CBO daily R$${(CAMPAIGN_DAILY_BUDGET / 100).toFixed(2)})`);
  }

  // 5) cria conjuntos + ads (tudo PAUSED)
  let totalCreated = 0;
  const allErrors: string[] = [];
  for (const c of plan) {
    let adsetId = c.existingId;
    if (!adsetId) {
      const createdSet = await withBackoff(`create conj ${c.g.key}`, () => metaPostForm(`${ACC}/adsets`, {
        name: c.name, campaign_id: campaignId,
        optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
        promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: fixTargeting(cfg.targeting),
        ...(cfg.destination_type && cfg.destination_type !== "UNDEFINED" ? { destination_type: cfg.destination_type } : {}),
        status: "PAUSED",
      }));
      if (!createdSet.id) throw new Error(`conjunto "${c.name}" sem id`);
      adsetId = createdSet.id; totalCreated++;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${c.name}`);
    } else console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${c.name}`);

    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);
    const toCreate = c.ads.filter((a) => !names.some((n) => n.startsWith(`${a.tpId} `) || n === a.finalName));
    const skipped = c.ads.length - toCreate.length;
    if (skipped) console.log(`  ↩︎ ${skipped} ad(s) já existiam — pulados`);
    if (!toCreate.length) continue;

    const { adIds, errors } = await createPairedVideoAdsBatched(ACC, adsetId, toCreate, copy);
    adIds.forEach((id, i) => console.log(`  ✅ ${toCreate[i]?.tpId ?? "?"} → ad ${id} (PAUSED, 9x16+4x5)`));
    errors.forEach((e) => console.log(`  ⛔ ${e}`));
    allErrors.push(...errors);
  }

  console.log(`\nResumo: campanha ${campaignId} · ${plan.length} conjunto(s) · ${totalAds} ads no plano${allErrors.length ? ` · ${allErrors.length} erro(s)` : ""} (tudo PAUSED).`);
  if (usingPlaceholder) console.log(`⚠️ LINK PLACEHOLDER (${copy.link}) — trocar pela LP e reapontar os ads no ativar.`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${campaignId}`);
  process.exit(allErrors.length ? 1 : 0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
