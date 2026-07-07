/**
 * Sobe os ads do lote "4 - Creators Summit - Creator" na camp de teste do Summit
 * ([TP] [Vendas] [CBO] [Quente] [Summit] - Teste de criativos — MESMA camp do lote Empresário).
 * 6 hooks (Victor h1-3 = TP1793-1795, Lucas h1-3 = TP1796-1798) → 1 CONJUNTO POR AVATAR.
 * Cada hook = 1 ad PAREADO 9x16(stories)+4x5(feed) via asset_feed_spec. Tudo PAUSED
 * (conjunto E ads — ligar é decisão manual do Caio no Gerenciador).
 *
 * Config + copy/link/CTA/UTM clonados do conjunto 12 [Victor] do lote Empresário
 * (120252734035990450) — o irmão mais recente, já com targeting IG-only sanitizado
 * (explore+explore_home). Match de vídeo ESTRITO pelo nome EXATO.
 *
 *   npx tsx scripts/ads/subir-summit-creator-ads.ts        # DRY (descobre + mostra plano)
 *   npx tsx scripts/ads/subir-summit-creator-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120251818147660450"; // [TP] [Vendas] [CBO] [Quente] [Summit] - Teste de criativos
const CLONE_ADSET = "120252734035990450"; // conjunto 12 [Victor] Creators Summit Empresário (config + copy do Summit)
const TEMA = "Creators Summit Creator";
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

// Avatares → faixa de TP na Biblioteca
const PERSONAS = [
  { persona: "Victor", from: 1793, to: 1795 },
  { persona: "Lucas", from: 1796, to: 1798 },
];

const ADVANTAGE_PLUS_OPT_OUT = {
  creative_features_spec: {
    image_touchups: { enroll_status: "OPT_OUT" },
    image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
    image_uncrop: { enroll_status: "OPT_OUT" },
    text_optimizations: { enroll_status: "OPT_OUT" },
    inline_comment: { enroll_status: "OPT_OUT" },
    audio: { enroll_status: "OPT_OUT" },
    image_animation: { enroll_status: "OPT_OUT" },
  },
};

const go = process.argv.includes("--go");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\.[^.]+$/, "");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 12): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}

// Meta exige `explore` junto de `explore_home`. Garante o par no targeting clonado.
function fixTargeting(t: any) {
  if (!t) return t;
  const ig: string[] | undefined = Array.isArray(t.instagram_positions) ? [...t.instagram_positions] : undefined;
  if (ig && ig.includes("explore_home") && !ig.includes("explore")) ig.push("explore");
  return { ...t, ...(ig ? { instagram_positions: ig } : {}) };
}

interface Reused { message: string; title?: string; link: string; cta: string; urlTags?: string; pageId: string; ig: string }

function pairedCreativeParams(tpId: string, nomeFinal: string, v9: string, v45: string, r: Reused) {
  const LBL_9 = `lbl_9x16_${tpId}`;
  const LBL_4 = `lbl_4x5_${tpId}`;
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: r.pageId, instagram_user_id: r.ig },
    asset_feed_spec: {
      bodies: [{ text: r.message }],
      ...(r.title ? { titles: [{ text: r.title }] } : {}),
      link_urls: [{ website_url: r.link }],
      call_to_action_types: [r.cta],
      ad_formats: ["SINGLE_VIDEO"],
      videos: [
        { video_id: v9, adlabels: [{ name: LBL_9 }] },
        { video_id: v45, adlabels: [{ name: LBL_4 }] },
      ],
      asset_customization_rules: [
        // IG-only (o conjunto clonado entrega só no Instagram). 9x16 → story+reels; 4x5 → resto.
        { customization_spec: { publisher_platforms: ["instagram"], instagram_positions: ["story", "reels"] }, video_label: { name: LBL_9 } },
        { customization_spec: { publisher_platforms: ["instagram"], instagram_positions: ["stream", "profile_feed", "explore", "explore_home", "ig_search"] }, video_label: { name: LBL_4 } },
      ],
    },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    ...(r.urlTags ? { url_tags: r.urlTags } : {}),
  };
}

(async () => {
  // 1) Biblioteca TP1793-1798 (base = nomeDrive)
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1793),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1798),
  ));
  const tpNum = (t: string) => parseInt(t.replace(/[^0-9]/g, ""), 10);
  const byTp = new Map(rows.map((r) => [tpNum(r.tpId), r]));

  const want = new Set<string>();
  for (const r of rows) { want.add(norm(`${r.nomeDrive}_9x16`)); want.add(norm(`${r.nomeDrive}_4x5`)); }

  // 2) índice de vídeos por nome EXATO, com EARLY-EXIT
  const byName = new Map<string, string[]>();
  const foundTargets = new Set<string>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  let pages = 0;
  for (; url && pages < 30; pages++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      const k = norm(v.title ?? ""); if (!k) continue;
      if (want.has(k)) { (byName.get(k) ?? byName.set(k, []).get(k)!).push(v.id); foundTargets.add(k); }
    }
    if (foundTargets.size >= want.size) { pages++; break; }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }
  const pick = (ids: string[]) => [...ids].sort()[0];
  console.log(`(advideos: ${pages} página(s) · alvos achados ${foundTargets.size}/${want.size})`);

  // 3) copy/link/UTM/page/ig do irmão (conjunto 12 Empresário)
  const refAds = await bk("GET ref creative", () => metaGet(`${CLONE_ADSET}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }));
  const refCre = refAds.data?.[0]?.creative ?? {};
  const afs = refCre.asset_feed_spec ?? {};
  const oss = refCre.object_story_spec ?? {};
  const ld = oss.link_data ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");
  const reused: Reused = {
    message: afs.bodies?.[0]?.text || ld.message || "",
    title: afs.titles?.[0]?.text || ld.name || undefined,
    link: afs.link_urls?.[0]?.website_url || ld.link || ld.call_to_action?.value?.link || "",
    cta: afs.call_to_action_types?.[0] || ld.call_to_action?.type || "LEARN_MORE",
    urlTags,
    pageId: oss.page_id ?? DEFAULT_PAGE,
    ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };

  // 4) config do adset irmão (targeting/otimização/pixel/destino)
  const cfg = await bk("GET config clone", () =>
    metaGet(CLONE_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }),
  );

  // 5) conjuntos existentes na campanha → NN + dedup por persona
  const existing = await bk("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let maxNn = Math.max(0, ...existingSets.map((s) => nnOf(s.name)));

  // 6) monta plano por persona
  type Ad = { hook: number; tpId: string; nomeFinal: string; v9: string; v45: string };
  interface Plan { persona: string; conjName: string; conjId: string | null; ads: Ad[]; warns: string[] }
  const plans: Plan[] = [];
  for (const p of PERSONAS) {
    const ads: Ad[] = [];
    const warns: string[] = [];
    for (let tp = p.from; tp <= p.to; tp++) {
      const r = byTp.get(tp);
      if (!r) { warns.push(`TP${tp}: sem linha na Biblioteca`); continue; }
      const base = r.nomeDrive ?? "";
      const c9 = byName.get(norm(`${base}_9x16`)) ?? [];
      const c4 = byName.get(norm(`${base}_4x5`)) ?? [];
      if (!c9.length || !c4.length) { warns.push(`${r.tpId} (${base}): falta ${!c9.length ? "9x16" : "4x5"} no Gerenciador`); continue; }
      if (c9.length > 1 || c4.length > 1) warns.push(`${r.tpId}: duplicata 9x16 x${c9.length} 4x5 x${c4.length}`);
      const mh = /h\s*([1-9])/i.exec(base);
      ads.push({ hook: mh ? +mh[1] : 0, tpId: r.tpId, nomeFinal: r.nomeFinal, v9: pick(c9), v45: pick(c4) });
    }
    ads.sort((a, b) => a.hook - b.hook);
    if (ads.length > 5) warns.push(`${ads.length} ads (>5) num conjunto só`);

    const sufixo = `[${p.persona}] - ${TEMA}`;
    const found = existingSets.find((s) => (s.name ?? "").includes(sufixo));
    let conjName: string, conjId: string | null;
    if (found) { conjName = found.name; conjId = found.id; }
    else { maxNn += 1; conjName = `${maxNn} - [IG] [Aberto] [Stories & Feed & Reels] ${sufixo} - h01 a h03 | b1 | c1`; conjId = null; }
    plans.push({ persona: p.persona, conjName, conjId, ads, warns });
  }

  console.log(`\nCampanha Teste de criativos Summit ${CAMP}  ·  ${TEMA}  ·  ${plans.length} conjuntos (1 por avatar)`);
  console.log(`Copy clonada do conjunto 12 Empresário (${reused.message.length} chars): "${reused.message.slice(0, 90).replace(/\n/g, " ")}…"`);
  console.log(`Link: ${reused.link}  ·  CTA: ${reused.cta}  ·  UTM: ${reused.urlTags ? "sim" : "—"}  ·  page ${reused.pageId} / ig ${reused.ig}`);
  console.log(`Config: opt=${cfg.optimization_goal} · billing=${cfg.billing_event} · dest=${cfg.destination_type ?? "—"} · pixel=${cfg.promoted_object?.pixel_id ?? "—"}/${cfg.promoted_object?.custom_event_type ?? "—"}`);
  for (const pl of plans) {
    console.log(`\n• ${pl.conjId ? "↩︎ existe " + pl.conjId : "NOVO"} — ${pl.conjName}`);
    for (const a of pl.ads) console.log(`    ${a.nomeFinal}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
    if (pl.warns.length) console.log(`    ⚠️  ${pl.warns.join(" | ")}`);
  }
  const totalAds = plans.reduce((s, pl) => s + pl.ads.length, 0);
  console.log(`\nTotal: ${plans.length} conjuntos · ${totalAds} ads pareados · modo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }
  if (!reused.message || !reused.link) throw new Error(`copy/link do irmão vieram vazios (msg=${reused.message.length} link=${reused.link})`);
  if (totalAds !== 6) throw new Error(`esperava 6 ads, montei ${totalAds} — revisar match antes de criar`);

  // 7) cria (tudo PAUSED — conjunto E ads; ligar é decisão manual)
  let createdAds = 0, createdSets = 0;
  for (const pl of plans) {
    let adsetId = pl.conjId;
    if (!adsetId) {
      const created = await bk(`create conj ${pl.persona}`, () =>
        metaPostForm(`${ACC}/adsets`, {
          name: pl.conjName, campaign_id: CAMP,
          optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
          promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: fixTargeting(cfg.targeting),
          ...(cfg.destination_type && cfg.destination_type !== "UNDEFINED" ? { destination_type: cfg.destination_type } : {}),
          status: "PAUSED",
        }),
      );
      if (!created.id) throw new Error(`conjunto "${pl.conjName}" sem id`);
      adsetId = created.id; createdSets++;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${pl.conjName}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${pl.conjName}`);
    }

    const adsNow = await bk(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);
    for (const a of pl.ads) {
      if (names.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal)) { console.log(`  ↩︎ ${a.tpId} já existe`); continue; }
      const cre = await bk(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45, reused)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await bk(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
      createdAds++;
      await sleep(8000);
    }
  }

  console.log(`\nResumo: ${createdSets} conjunto(s) + ${createdAds} ad(s) criado(s) nesse run (tudo PAUSED).`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
