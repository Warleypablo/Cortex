/**
 * Passo 3/3 — Cria os conjuntos + 12 ads single-video do lote "Areia Movediça"
 * (Victor Peixoto, Creators) na campanha de TESTE CBO Creators JÁ EXISTENTE.
 *   Campanha `120249141209100450` (CBO, PAUSED) — NÃO cria campanha, só adiciona conjuntos.
 *   3 conjuntos por faixa de hook. Config + COPY clonados do irmão CLONE_ADSET (funil Creators).
 *   Conjuntos SEM budget (CBO manda na campanha). Criativo single-video clássico. Tudo PAUSED.
 *
 *   npx tsx scripts/ads/subir-areia-movedica-ads.ts        # DRY
 *   npx tsx scripts/ads/subir-areia-movedica-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, inArray } from "drizzle-orm";
import { metaGet, metaPostForm, getVideoThumbnail } from "../../server/services/adsCreation/metaApi";
import { withBackoff } from "../../server/services/adsCreation/lotUploader";
import { ITEMS, CAMPAIGN, CLONE_ADSET, NN_FLOOR, GROUPS, conjName, metaTitle, type Group } from "./areia-movedica.data";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";
const go = process.argv.includes("--go");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\.[^.]+$/, "");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };

const ADVANTAGE_PLUS_OPT_OUT = {
  creative_features_spec: {
    image_touchups: { enroll_status: "OPT_OUT" }, image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
    image_uncrop: { enroll_status: "OPT_OUT" }, text_optimizations: { enroll_status: "OPT_OUT" },
    inline_comment: { enroll_status: "OPT_OUT" }, audio: { enroll_status: "OPT_OUT" }, image_animation: { enroll_status: "OPT_OUT" },
  },
};

// Meta exige `explore` junto de `explore_home` no targeting clonado (senão POST /adsets 400 code=100).
function fixTargeting(t: any) {
  if (!t) return t;
  const ig: string[] | undefined = Array.isArray(t.instagram_positions) ? [...t.instagram_positions] : undefined;
  if (ig && ig.includes("explore_home") && !ig.includes("explore")) ig.push("explore");
  return { ...t, ...(ig ? { instagram_positions: ig } : {}) };
}

interface Copy { message: string; title?: string; link: string; cta: string; urlTags?: string; pageId: string; ig: string; }
function singleVideoCreativeParams(nomeFinal: string, videoId: string, thumbUrl: string | null, copy: Copy) {
  const videoData: Record<string, any> = { video_id: videoId, message: copy.message, call_to_action: { type: copy.cta, value: { link: copy.link } } };
  if (copy.title) videoData.title = copy.title;
  if (thumbUrl) videoData.image_url = thumbUrl;
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: copy.pageId, instagram_user_id: copy.ig, video_data: videoData },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    ...(copy.urlTags ? { url_tags: copy.urlTags } : {}),
  };
}

type Ad = { hook: number; tpId: string; nomeFinal: string; videoId: string };

(async () => {
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");

  // 1) Biblioteca (por driveFileId)
  const rows = await db.select().from(creativesLibrary).where(and(isNull(creativesLibrary.deletedAt), inArray(creativesLibrary.driveFileId, ITEMS.map((i) => i.driveId))));
  const byDrive = new Map(rows.map((r) => [r.driveFileId!, r]));

  // 2) descobre vídeos no Gerenciador (nome exato `${base}_9x16`, early-exit)
  const want = new Map<string, { hook: number; tpId: string; nomeFinal: string }>();
  for (const it of ITEMS) { const r = byDrive.get(it.driveId); if (r) want.set(norm(metaTitle(it.base)), { hook: it.hook, tpId: r.tpId, nomeFinal: r.nomeFinal }); }
  const byName = new Map<string, string[]>();
  const foundTargets = new Set<string>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  let pages = 0;
  for (; url && pages < 40; pages++) {
    const res: any = await withBackoff("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) { const k = norm(v.title ?? ""); if (want.has(k)) { (byName.get(k) ?? byName.set(k, []).get(k)!).push(v.id); foundTargets.add(k); } }
    if (foundTargets.size >= want.size) { pages++; break; }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }
  const pick = (ids: string[]) => [...ids].sort()[0];
  console.log(`(advideos: ${pages} página(s) · alvos ${foundTargets.size}/${want.size})`);

  // 3) monta ads
  const ready: Ad[] = [];
  const warns: string[] = [];
  for (const it of ITEMS) {
    const r = byDrive.get(it.driveId);
    if (!r) { warns.push(`h${it.hook} (${it.base}): sem linha na Biblioteca`); continue; }
    const cands = byName.get(norm(metaTitle(it.base))) ?? [];
    if (!cands.length) { warns.push(`${r.tpId} (${it.base}): vídeo ${metaTitle(it.base)} não achado no Gerenciador`); continue; }
    ready.push({ hook: it.hook, tpId: r.tpId, nomeFinal: r.nomeFinal, videoId: pick(cands) });
  }

  // 4) copy/config do irmão (funil Creators)
  const refAds = await withBackoff("GET ref creative", () => metaGet(`${CLONE_ADSET}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }));
  const refCre = refAds.data?.[0]?.creative ?? {};
  const afs = refCre.asset_feed_spec ?? {}, oss = refCre.object_story_spec ?? {}, vd = oss.video_data ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");
  const copy: Copy = {
    message: afs.bodies?.[0]?.text || vd.message || "",
    title: afs.titles?.[0]?.text || vd.title,
    link: afs.link_urls?.[0]?.website_url || vd.call_to_action?.value?.link || vd.link_description || "",
    cta: afs.call_to_action_types?.[0] || vd.call_to_action?.type || "LEARN_MORE",
    urlTags, pageId: oss.page_id ?? DEFAULT_PAGE, ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };

  // 5) agrupa por faixa de hook + NN (idempotente por matchToken)
  const existing = await withBackoff("GET adsets camp", () => metaGet(`${CAMPAIGN}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let nn = Math.max(NN_FLOOR, ...existingSets.map((s) => nnOf(s.name)));
  const plan: { g: Group; name: string; existingId: string | null; ads: Ad[] }[] = [];
  for (const g of GROUPS) {
    const ads = ready.filter((a) => a.hook >= g.hookMin && a.hook <= g.hookMax).sort((x, y) => x.hook - y.hook);
    if (ads.length > 5) warns.push(`${g.key}: ${ads.length} ads (>5)`);
    const found = existingSets.find((s) => (s.name ?? "").includes(g.matchToken));
    plan.push({ g, name: found?.name ?? conjName(++nn, g), existingId: found?.id ?? null, ads });
  }

  console.log(`\nCampanha ${CAMPAIGN} (CBO existente) · ${plan.length} conjuntos · clone do irmão ${CLONE_ADSET}`);
  console.log(`Copy (${copy.message.length} chars): "${copy.message.slice(0, 90).replace(/\n/g, " ")}…" · link ${copy.link} · cta ${copy.cta}`);
  for (const c of plan) {
    console.log(`\n• ${c.existingId ? "↩︎ existe " + c.existingId : "NOVO"} — ${c.name} (${c.ads.length} ads)`);
    for (const a of c.ads) console.log(`    ${a.nomeFinal}  [video ${a.videoId}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  const totalAds = plan.reduce((s, c) => s + c.ads.length, 0);
  console.log(`\nTotal: ${plan.length} conjuntos · ${totalAds} ads single-video · modo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }

  if (!copy.message || !copy.link) throw new Error(`copy/link do irmão ${CLONE_ADSET} vieram vazios`);
  if (totalAds !== ITEMS.length) throw new Error(`esperava ${ITEMS.length} ads, montei ${totalAds} — rode upload/planilha antes (${warns.join(" | ")})`);

  const cfg = await withBackoff("GET config ref", () => metaGet(CLONE_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }));

  let createdSets = 0, createdAds = 0;
  for (const c of plan) {
    let adsetId = c.existingId;
    if (!adsetId) {
      const created = await withBackoff(`create conj ${c.g.key}`, () => metaPostForm(`${ACC}/adsets`, {
        name: c.name, campaign_id: CAMPAIGN,
        optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
        promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: fixTargeting(cfg.targeting),
        ...(cfg.destination_type && cfg.destination_type !== "UNDEFINED" ? { destination_type: cfg.destination_type } : {}),
        status: "PAUSED",
      }));
      if (!created.id) throw new Error(`conjunto "${c.name}" sem id`);
      adsetId = created.id; createdSets++;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${c.name}`);
    } else console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${c.name}`);

    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);
    for (const a of c.ads) {
      if (names.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal)) { console.log(`  ↩︎ ${a.tpId} já existe`); continue; }
      let thumbUrl: string | null = null;
      try { thumbUrl = await withBackoff(`thumb ${a.tpId}`, () => getVideoThumbnail(a.videoId)); } catch { thumbUrl = null; }
      const cre = await withBackoff(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, singleVideoCreativeParams(a.nomeFinal, a.videoId, thumbUrl, copy)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await withBackoff(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, single 9x16)`);
      createdAds++;
      await sleep(8000);
    }
  }

  console.log(`\nResumo: ${createdSets} conjunto(s) + ${createdAds} ad(s) criado(s) (tudo PAUSED).`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMPAIGN}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
