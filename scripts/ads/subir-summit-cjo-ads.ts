/**
 * Passo 3/3 — Sobe os ads do lote "5 - Creators Summit - Camila/Jaque + Quebra de Objeções"
 * na camp de teste do Summit ([TP] [Vendas] [CBO] [Quente] [Summit] - Teste de criativos).
 * 4 conjuntos: 18 [Camila] (4), 19 [Jaque] (4), 20 [Quebra de Objeções] CTA01 (6), 21 CTA02 (6).
 * Cada criativo = 1 ad SINGLE_VIDEO 9x16 (single-format). Tudo PAUSED (conjunto E ads —
 * ligar é decisão manual do Caio no Gerenciador).
 *
 * Config + copy/link/CTA/UTM clonados do conjunto 12 [Victor] Empresário (120252734035990450).
 * Match de vídeo ESTRITO pelo nome EXATO `${base}_9x16`. Biblioteca lida por driveFileId.
 *
 *   npx tsx scripts/ads/subir-summit-cjo-ads.ts        # DRY (descobre + mostra plano)
 *   npx tsx scripts/ads/subir-summit-cjo-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { isNull, and, inArray } from "drizzle-orm";
import { metaGet, metaPostForm, getVideoThumbnail, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";
import { GROUPS, ALL_ITEMS, CAMP, CLONE_ADSET, metaTitle } from "./summit-cjo.data";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

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

// Criativo single-video 9x16 CLÁSSICO (object_story_spec.video_data) — mesmo padrão da produção
// (creator.ts). Um asset_feed_spec "pelado" (1 vídeo, sem asset_customization_rules) a Meta trata
// como Dynamic Creative e exige conjunto dinâmico; video_data é criativo normal e roda em qualquer
// conjunto. image_url (thumbnail buscada) evita o code=100 "problem uploading your video thumbnail".
function singleVideoCreativeParams(nomeFinal: string, videoId: string, thumbUrl: string | null, r: Reused) {
  const videoData: Record<string, any> = {
    video_id: videoId,
    message: r.message,
    call_to_action: { type: r.cta, value: { link: r.link } },
  };
  if (r.title) videoData.title = r.title;
  if (thumbUrl) videoData.image_url = thumbUrl;
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: r.pageId, instagram_user_id: r.ig, video_data: videoData },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    ...(r.urlTags ? { url_tags: r.urlTags } : {}),
  };
}

(async () => {
  // 1) Biblioteca dos 20 criativos, indexada por driveFileId
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    inArray(creativesLibrary.driveFileId, ALL_ITEMS.map((it) => it.driveId)),
  ));
  const byDrive = new Map(rows.map((r) => [r.driveFileId!, r]));

  // 2) títulos-alvo no Gerenciador (`${base}_9x16`) → índice por nome EXATO, com early-exit
  const want = new Set<string>();
  for (const it of ALL_ITEMS) want.add(norm(metaTitle(it.base)));
  const byName = new Map<string, string[]>();
  const foundTargets = new Set<string>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  let pages = 0;
  for (; url && pages < 40; pages++) {
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

  // 5) conjuntos existentes na campanha → NN + dedup por matchToken
  const existing = await bk("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let maxNn = Math.max(0, ...existingSets.map((s) => nnOf(s.name)));

  // 6) monta plano por grupo
  type Ad = { order: number; tpId: string; nomeFinal: string; videoId: string };
  interface Plan { key: string; conjName: string; conjId: string | null; ads: Ad[]; warns: string[] }
  const plans: Plan[] = [];
  for (const g of GROUPS) {
    const ads: Ad[] = [];
    const warns: string[] = [];
    for (const it of g.items) {
      const r = byDrive.get(it.driveId);
      if (!r) { warns.push(`${it.base}: sem linha na Biblioteca (drive ${it.driveId.slice(0, 8)}…)`); continue; }
      const cands = byName.get(norm(metaTitle(it.base))) ?? [];
      if (!cands.length) { warns.push(`${r.tpId} (${it.base}): vídeo ${metaTitle(it.base)} não achado no Gerenciador`); continue; }
      if (cands.length > 1) warns.push(`${r.tpId}: duplicata de vídeo x${cands.length}`);
      ads.push({ order: it.order, tpId: r.tpId, nomeFinal: r.nomeFinal, videoId: pick(cands) });
    }
    ads.sort((a, b) => a.order - b.order);
    if (ads.length > 6) warns.push(`${ads.length} ads (>6) num conjunto só`);

    const found = existingSets.find((s) => (s.name ?? "").includes(g.matchToken));
    let conjName: string, conjId: string | null;
    if (found) { conjName = found.name; conjId = found.id; }
    else { maxNn += 1; conjName = g.conjName(maxNn); conjId = null; }
    plans.push({ key: g.key, conjName, conjId, ads, warns });
  }

  console.log(`\nCampanha Teste de criativos Summit ${CAMP}  ·  ${plans.length} conjuntos`);
  console.log(`Copy clonada do conjunto 12 Empresário (${reused.message.length} chars): "${reused.message.slice(0, 90).replace(/\n/g, " ")}…"`);
  console.log(`Link: ${reused.link}  ·  CTA: ${reused.cta}  ·  UTM: ${reused.urlTags ? "sim" : "—"}  ·  page ${reused.pageId} / ig ${reused.ig}`);
  console.log(`Config: opt=${cfg.optimization_goal} · billing=${cfg.billing_event} · dest=${cfg.destination_type ?? "—"} · pixel=${cfg.promoted_object?.pixel_id ?? "—"}/${cfg.promoted_object?.custom_event_type ?? "—"}`);
  for (const pl of plans) {
    console.log(`\n• ${pl.conjId ? "↩︎ existe " + pl.conjId : "NOVO"} — ${pl.conjName}`);
    for (const a of pl.ads) console.log(`    ${a.nomeFinal}  [video ${a.videoId}]`);
    if (pl.warns.length) console.log(`    ⚠️  ${pl.warns.join(" | ")}`);
  }
  const totalAds = plans.reduce((s, pl) => s + pl.ads.length, 0);
  console.log(`\nTotal: ${plans.length} conjuntos · ${totalAds} ads single-video · modo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }
  if (!reused.message || !reused.link) throw new Error(`copy/link do irmão vieram vazios (msg=${reused.message.length} link=${reused.link})`);
  if (totalAds !== ALL_ITEMS.length) throw new Error(`esperava ${ALL_ITEMS.length} ads, montei ${totalAds} — revisar match antes de criar`);

  // 7) cria (tudo PAUSED — conjunto E ads; ligar é decisão manual)
  let createdAds = 0, createdSets = 0;
  for (const pl of plans) {
    let adsetId = pl.conjId;
    if (!adsetId) {
      const created = await bk(`create conj ${pl.key}`, () =>
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
      let thumbUrl: string | null = null;
      try { thumbUrl = await bk(`thumb ${a.tpId}`, () => getVideoThumbnail(a.videoId)); } catch { thumbUrl = null; }
      const cre = await bk(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, singleVideoCreativeParams(a.nomeFinal, a.videoId, thumbUrl, reused)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await bk(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, single 9x16)`);
      createdAds++;
      await sleep(8000);
    }
  }

  console.log(`\nResumo: ${createdSets} conjunto(s) + ${createdAds} ad(s) criado(s) nesse run (tudo PAUSED).`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
