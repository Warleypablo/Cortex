/**
 * Sobe os ads do lote "Caio - 3x ads validados re-escritos" na camp CBO Creators teste.
 * Estrutura pedida: 1 ROTEIRO POR CONJUNTO → 3 conjuntos (Roteiro 1/2/3), cada um com
 * seus 3 hooks PAREADOS 9x16(stories)+4x5(feed). Tudo PAUSED.
 *
 * - Auto-descobre os video_id no Gerenciador (R#H#-Caio-(9x16|4x5)) e pareia por hook.
 * - Cruza com a Biblioteca (TP1722–1730) por R#H# → tpId / nome_final (= nome do ad).
 * - Clona config (otimização/billing/pixel/atribuição/targeting/destination) do conjunto
 *   irmão 142 Processo Bready E reaproveita copy/link/CTA/UTM de um ad dele (placeholder).
 * - NN deterministico por nome: reusa conjunto existente pelo sufixo "[Caio] - ... - Roteiro N".
 *
 *   npx tsx subir-caio-roteiros-ads.ts        # DRY (descobre + mostra plano, não escreve)
 *   npx tsx subir-caio-roteiros-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120249141209100450"; // [TP] [Leads] [CBO] [Creators] - Campanha de teste
const CLONE_ADSET = "120251810662370450"; // 142 Esther Processo Bready (config + copy de referência)
const NN_FLOOR = 167; // não reusar até 167 (Natural tech foi 165–167)
const PERSONA = "Caio";
const TEMA = "Ads validados re-escritos";
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
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 12): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
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
        { customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] }, video_label: { name: LBL_9 } },
        { customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed"], instagram_positions: ["stream", "profile_feed"] }, video_label: { name: LBL_4 } },
      ],
    },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    ...(r.urlTags ? { url_tags: r.urlTags } : {}),
  };
}

(async () => {
  // 1) vídeos Caio R#H# no Gerenciador (pareia v9/v45 por hook)
  const vByKey = new Map<string, { v9?: string; v45?: string }>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  for (let page = 0; url && page < 20; page++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      const t: string = v.title ?? "";
      if (!/caio/i.test(t)) continue;
      const m = /r[\s_-]*([1-3])[\s_-]*h[\s_-]*([1-3])/i.exec(t);
      const f = /(9\s*x\s*16|4\s*x\s*5)/i.exec(t);
      if (!m || !f) continue;
      const key = `r${m[1]}h${m[2]}`;
      const cur = vByKey.get(key) ?? {};
      if (/9/.test(f[1])) cur.v9 = v.id; else cur.v45 = v.id;
      vByKey.set(key, cur);
    }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }

  // 2) Biblioteca TP1722–1730 → R#H# → {tpId, nomeFinal}
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1722),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1730),
  ));
  const tpByKey = new Map<string, { tpId: string; nomeFinal: string }>();
  for (const rr of rows) { const m = /R([1-3])H([1-3])/i.exec(rr.nomeDrive ?? rr.nomeFinal); if (m) tpByKey.set(`r${m[1]}h${m[2]}`, { tpId: rr.tpId, nomeFinal: rr.nomeFinal }); }

  // 3) monta os 3 conjuntos (1 roteiro cada), cruzando vídeo pareado + TP
  type Ad = { hook: number; tpId: string; nomeFinal: string; v9: string; v45: string };
  const warns: string[] = [];
  const roteiros: { roteiro: number; ads: Ad[] }[] = [];
  for (const roteiro of [1, 2, 3]) {
    const ads: Ad[] = [];
    for (const hook of [1, 2, 3]) {
      const key = `r${roteiro}h${hook}`;
      const vid = vByKey.get(key) ?? {};
      const tp = tpByKey.get(key);
      if (!vid.v9 || !vid.v45) { warns.push(`${key}: falta ${!vid.v9 ? "9x16" : "4x5"}`); continue; }
      if (!tp) { warns.push(`${key}: sem TP na Biblioteca`); continue; }
      ads.push({ hook, tpId: tp.tpId, nomeFinal: tp.nomeFinal, v9: vid.v9, v45: vid.v45 });
    }
    if (ads.length) roteiros.push({ roteiro, ads: ads.sort((a, b) => a.hook - b.hook) });
  }

  // 4) NN deterministico: reusa conjunto pelo sufixo "[Caio] - <tema> - Roteiro N"; senão próximo NN livre
  const existing = await bk("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let nnCounter = Math.max(NN_FLOOR, ...existingSets.map((s) => nnOf(s.name)));
  const sufixo = (r: number) => `[${PERSONA}] - ${TEMA} - Roteiro ${r}`;
  const conjuntos: { name: string; existingId: string | null; ads: Ad[]; roteiro: number }[] = [];
  for (const rt of roteiros) {
    const found = existingSets.find((s) => (s.name ?? "").includes(sufixo(rt.roteiro)));
    let name: string;
    if (found) name = found.name;
    else { nnCounter += 1; name = `${nnCounter} - [IG] [Aberto] [Stories & Feed & Reels] ${sufixo(rt.roteiro)}`; }
    conjuntos.push({ name, existingId: found?.id ?? null, ads: rt.ads, roteiro: rt.roteiro });
  }

  // 5) copy/link/UTM de um ad irmão (142 Processo Bready) — placeholder
  const refAds = await bk("GET ref creative", () => metaGet(`${CLONE_ADSET}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }));
  const refCre = refAds.data?.[0]?.creative ?? {};
  const afs = refCre.asset_feed_spec ?? {};
  const oss = refCre.object_story_spec ?? {};
  const vd = oss.video_data ?? {};
  let urlTags: string | undefined = refCre.url_tags;
  if (urlTags) urlTags = urlTags.replace(/hsa_grp=\d+/, "hsa_grp={{adset.id}}").replace(/hsa_ad=\d+/, "hsa_ad={{ad.id}}");
  const reused: Reused = {
    message: afs.bodies?.[0]?.text || vd.message || "",
    title: afs.titles?.[0]?.text || vd.title,
    link: afs.link_urls?.[0]?.website_url || vd.call_to_action?.value?.link || vd.link_description || "",
    cta: afs.call_to_action_types?.[0] || vd.call_to_action?.type || "LEARN_MORE",
    urlTags,
    pageId: oss.page_id ?? DEFAULT_PAGE,
    ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };

  console.log(`Campanha CBO Creators ${CAMP}  ·  ${PERSONA} ${TEMA}  ·  ${roteiros.length} roteiro(s)/conjunto(s)`);
  console.log(`Copy placeholder (${reused.message.length} chars): "${reused.message.slice(0, 90).replace(/\n/g, " ")}…"`);
  console.log(`Link: ${reused.link}  ·  CTA: ${reused.cta}  ·  UTM: ${reused.urlTags ? "sim" : "—"}  ·  page ${reused.pageId} / ig ${reused.ig}`);
  for (const c of conjuntos) {
    console.log(`\n• ${c.existingId ? "↩︎ existe " + c.existingId : "novo"} — ${c.name}`);
    for (const a of c.ads) console.log(`    ${a.nomeFinal}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }
  if (!conjuntos.length) throw new Error("nada pronto pra subir");
  if (!reused.message || !reused.link) throw new Error(`copy/link do irmão vieram vazios (msg=${reused.message.length} link=${reused.link})`);

  // config de clone do conjunto irmão
  const cfg = await bk("GET config 142", () =>
    metaGet(CLONE_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }),
  );

  let totalAds = 0;
  for (const conj of conjuntos) {
    let adsetId = conj.existingId;
    if (!adsetId) {
      const created = await bk(`create conj r${conj.roteiro}`, () =>
        metaPostForm(`${ACC}/adsets`, {
          name: conj.name, campaign_id: CAMP,
          optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
          promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: cfg.targeting,
          ...(cfg.destination_type ? { destination_type: cfg.destination_type } : {}),
          status: "PAUSED",
        }),
      );
      if (!created.id) throw new Error(`conjunto "${conj.name}" sem id`);
      adsetId = created.id;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${conj.name}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${conj.name}`);
    }

    const adsNow = await bk(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);

    for (const a of conj.ads) {
      if (names.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal)) { console.log(`  ↩︎ ${a.tpId} já existe`); continue; }
      const cre = await bk(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45, reused)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await bk(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
      totalAds++;
      await sleep(8000);
    }
  }

  console.log(`\nResumo: ${conjuntos.length} conjunto(s) · ${totalAds} ad(s) criado(s) nesse run.`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
