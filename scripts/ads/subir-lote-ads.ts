/**
 * TEMPLATE config-driven pra subir um LOTE de ads de vídeo pareados (9x16+4x5) quando os
 * vídeos já estão no Gerenciador (upload manual). Substitui os scripts soltos
 * (subir-*-ads.ts) usando os helpers testados em `server/services/adsCreation/lotUploader.ts`:
 * descoberta ESTRITA por nome + early-exit, criação em BATCH, thumbnail pré-buscada, retry
 * transitório + fallback de IG. Tudo PAUSED. Agrupa 1 conjunto por persona (≤5 ads/conjunto).
 *
 * Pra subir um lote novo: edite só o CONFIG abaixo (faixa de TP + campanha + tema).
 *
 *   npx tsx scripts/ads/subir-lote-ads.ts        # DRY (descobre + mostra plano, não escreve)
 *   npx tsx scripts/ads/subir-lote-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, metaPostForm } from "../../server/services/adsCreation/metaApi";
import {
  findPairedVideosByExactName,
  createPairedVideoAdsBatched,
  withBackoff,
  type PairTarget,
  type PairedAdSpec,
  type ReusedCopy,
} from "../../server/services/adsCreation/lotUploader";

// ======================= CONFIG (edite por lote) =======================
const CONFIG = {
  tpStart: 1740, // faixa de TP na Biblioteca (inclusive)
  tpEnd: 1744,
  campaign: "120249141209100450", // CBO Creators teste
  cloneAdset: "120251810662370450", // 142 Processo Bready — config + copy de referência (placeholder)
  tema: "Estratégia Peculiar React V2",
  nnFloor: 172, // não reusar NN até esse piso
};
// =======================================================================

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";
const go = process.argv.includes("--go");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
const hookOf = (base: string) => { const m = /h\s*([1-9][0-9]?)/i.exec(base); return m ? +m[1] : 0; };

(async () => {
  // 1) Biblioteca (faixa de TP) → alvos por persona
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, CONFIG.tpStart),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, CONFIG.tpEnd),
  ));
  if (!rows.length) throw new Error(`Nenhuma linha na Biblioteca em TP${CONFIG.tpStart}–TP${CONFIG.tpEnd}`);

  const targets: PairTarget[] = rows.map((r) => ({ key: r.tpId, base: r.nomeDrive ?? "" }));
  const meta = new Map(rows.map((r) => [r.tpId, { nomeFinal: r.nomeFinal, persona: r.personagem ?? "?", base: r.nomeDrive ?? "" }]));

  // 2) descobre video_id no Gerenciador (estrito + early-exit)
  const { pairs, pagesRead, foundAll } = await findPairedVideosByExactName(ACC, targets);
  console.log(`Descoberta: ${pagesRead} página(s) de advideos lidas · achou todos: ${foundAll ? "sim" : "NÃO"}`);

  // 3) monta ads prontos + agrupa por persona
  type Ad = PairedAdSpec & { persona: string; hook: number };
  const ready: Ad[] = [];
  const warns: string[] = [];
  for (const t of targets) {
    const p = pairs.get(t.key)!;
    const m = meta.get(t.key)!;
    if (!p.v9 || !p.v4) { warns.push(`${t.key} (${t.base}): falta ${!p.v9 ? "9x16" : "4x5"} no Gerenciador`); continue; }
    if (p.dup9 > 1 || p.dup4 > 1) warns.push(`${t.key}: duplicata 9x16x${p.dup9} 4x5x${p.dup4} (peguei id determinístico)`);
    ready.push({ tpId: t.key, finalName: m.nomeFinal, v9: p.v9, v45: p.v4, persona: m.persona, hook: hookOf(m.base) });
  }
  const byPersona = new Map<string, Ad[]>();
  for (const a of ready) (byPersona.get(a.persona) ?? byPersona.set(a.persona, []).get(a.persona)!).push(a);
  for (const arr of byPersona.values()) arr.sort((x, y) => x.hook - y.hook);

  // 4) copy/link/UTM + config do conjunto de referência
  const refAds = await withBackoff("GET ref creative", () => metaGet(`${CONFIG.cloneAdset}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }));
  const refCre = refAds.data?.[0]?.creative ?? {};
  const afs = refCre.asset_feed_spec ?? {}, oss = refCre.object_story_spec ?? {}, vd = oss.video_data ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");
  const copy: ReusedCopy = {
    message: afs.bodies?.[0]?.text || vd.message || "",
    title: afs.titles?.[0]?.text || vd.title,
    link: afs.link_urls?.[0]?.website_url || vd.call_to_action?.value?.link || vd.link_description || "",
    cta: afs.call_to_action_types?.[0] || vd.call_to_action?.type || "LEARN_MORE",
    urlTags,
    pageId: oss.page_id ?? DEFAULT_PAGE,
    ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };

  // 5) resolve conjuntos (idempotente por sufixo de nome)
  const existing = await withBackoff("GET adsets camp", () => metaGet(`${CONFIG.campaign}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let nn = Math.max(CONFIG.nnFloor, ...existingSets.map((s) => nnOf(s.name)));
  const personas = [...byPersona.keys()];
  const plan: { persona: string; name: string; existingId: string | null; ads: Ad[] }[] = [];
  for (const persona of personas) {
    const ads = byPersona.get(persona)!;
    if (ads.length > 5) warns.push(`${persona}: ${ads.length} ads (>5) num conjunto — revisar split`);
    const sufixo = `[${persona}] - ${CONFIG.tema}`;
    const found = existingSets.find((s) => (s.name ?? "").includes(sufixo));
    const name = found?.name ?? `${++nn} - [IG] [Aberto] [Stories & Feed & Reels] ${sufixo}`;
    plan.push({ persona, name, existingId: found?.id ?? null, ads });
  }

  // ---- relatório ----
  console.log(`\nCampanha ${CONFIG.campaign} · ${CONFIG.tema} · ${plan.length} conjunto(s)`);
  console.log(`Copy placeholder (${copy.message.length} chars): "${copy.message.slice(0, 80).replace(/\n/g, " ")}…" · link ${copy.link} · cta ${copy.cta}`);
  for (const c of plan) {
    console.log(`\n• ${c.existingId ? "↩︎ existe " + c.existingId : "novo"} — ${c.name} (${c.ads.length} ads)`);
    for (const a of c.ads) console.log(`    ${a.finalName}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR (batch)" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }
  if (!ready.length) throw new Error("nada pronto pra subir");
  if (!copy.message || !copy.link) throw new Error(`copy/link do conjunto de ref vieram vazios`);

  // config de clone
  const cfg = await withBackoff("GET config ref", () => metaGet(CONFIG.cloneAdset, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }));

  let totalAds = 0;
  const allErrors: string[] = [];
  for (const c of plan) {
    let adsetId = c.existingId;
    if (!adsetId) {
      const created = await withBackoff(`create conj ${c.persona}`, () => metaPostForm(`${ACC}/adsets`, {
        name: c.name, campaign_id: CONFIG.campaign,
        optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
        promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: cfg.targeting,
        ...(cfg.destination_type ? { destination_type: cfg.destination_type } : {}),
        status: "PAUSED",
      }));
      if (!created.id) throw new Error(`conjunto "${c.name}" sem id`);
      adsetId = created.id;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${c.name}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${c.name}`);
    }

    // idempotência: pula ads cujo TP já existe no conjunto
    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);
    const toCreate = c.ads.filter((a) => !names.some((n) => n.startsWith(`${a.tpId} `) || n === a.finalName));
    const skipped = c.ads.length - toCreate.length;
    if (skipped) console.log(`  ↩︎ ${skipped} ad(s) já existiam — pulados`);
    if (!toCreate.length) continue;

    const { adIds, errors } = await createPairedVideoAdsBatched(ACC, adsetId, toCreate, copy);
    adIds.forEach((id, i) => console.log(`  ✅ ${toCreate[i]?.tpId ?? "?"} → ad ${id} (PAUSED, 9x16+4x5)`));
    errors.forEach((e) => console.log(`  ⛔ ${e}`));
    totalAds += adIds.length;
    allErrors.push(...errors);
  }

  console.log(`\nResumo: ${plan.length} conjunto(s) · ${totalAds} ad(s) criado(s)${allErrors.length ? ` · ${allErrors.length} erro(s)` : ""}.`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CONFIG.campaign}`);
  process.exit(allErrors.length ? 1 : 0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
