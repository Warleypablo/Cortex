/**
 * Sobe os ads do lote Victor "Bready" na camp CBO Creators teste, padrão Turbo:
 * 5 ads/conjunto, split h01–h05 / h06–h09, pareados 9x16+4x5, PAUSED.
 *
 * - Auto-descobre os video_id do Victor no Gerenciador (b1/b2/b3 × h1–h9, ambos formatos)
 * - Cruza com a Biblioteca (hook/body → TP)
 * - Clona config do conjunto irmão (142 Processo Bready) E reaproveita a copy/link/UTM de um ad irmão
 * - NN: contador corrido (piso 158 p/ não colidir com os 151–158 do CRM), incrementando por conjunto
 * - cta no nome = c1 (Victor não tem variação de cta)
 *
 *   npx tsx subir-victor-ads.ts        # DRY (descobre + mostra plano, não escreve)
 *   npx tsx subir-victor-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { ilike, and, isNull } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120249141209100450"; // [TP] [Leads] [CBO] [Creators] - Campanha de teste
const CLONE_ADSET = "120251810662370450"; // 142 - Esther Processo Bready h01–h05 b1 c1 (config + creative de referência)
const NN_FLOOR = 158; // global: não reusar 151–158 (CRM)
const PERSONA = "Victor";
const TEMA = "Bready";
const CTA_LABEL = "c1"; // sufixo fixo no nome (Victor sem variação de cta)
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
const pad2 = (n: number) => String(n).padStart(2, "0");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function withBackoff<T>(label: string, fn: () => Promise<T>, max = 12): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit em ${label} — espera 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
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
  // 1) vídeos Victor Bready no Gerenciador
  const vids = await withBackoff("GET advideos", () => metaGet(`${ACC}/advideos`, { fields: "id,title", limit: "400" }));
  const vByKey = new Map<string, { v9?: string; v45?: string }>(); // key b{b}h{h}
  for (const v of vids.data ?? []) {
    const m = /h(\d+)b(\d+)-bready-victor-(9x16|4x5)/i.exec(v.title ?? "");
    if (!m) continue;
    const key = `b${+m[2]}h${+m[1]}`;
    const cur = vByKey.get(key) ?? {};
    if (/9x16/i.test(m[3])) cur.v9 = v.id; else cur.v45 = v.id;
    vByKey.set(key, cur);
  }

  // 2) Biblioteca Victor Bready (hook/body → TP)
  const rows = await db.select().from(creativesLibrary).where(and(ilike(creativesLibrary.nomeFinal, "%Bready-Victor%"), isNull(creativesLibrary.deletedAt)));
  const tpByKey = new Map<string, { tpId: string; nomeFinal: string }>();
  for (const r of rows) { const m = /H(\d+)B(\d+)/i.exec(r.nomeFinal); if (m) tpByKey.set(`b${+m[2]}h${+m[1]}`, { tpId: r.tpId, nomeFinal: r.nomeFinal }); }

  // 3) cruza ready (vídeo pareado + TP)
  type Ad = { body: number; hook: number; tpId: string; nomeFinal: string; v9: string; v45: string };
  const ready: Ad[] = [];
  const warns: string[] = [];
  for (const [key, vid] of vByKey) {
    const m = /^b(\d+)h(\d+)$/.exec(key)!;
    const body = +m[1], hook = +m[2];
    const tp = tpByKey.get(key);
    if (!vid.v9 || !vid.v45) { warns.push(`b${body}h${hook}: falta ${!vid.v9 ? "9x16" : "4x5"}`); continue; }
    if (!tp) { warns.push(`b${body}h${hook}: sem TP na Biblioteca`); continue; }
    ready.push({ body, hook, tpId: tp.tpId, nomeFinal: tp.nomeFinal, v9: vid.v9, v45: vid.v45 });
  }
  const bodies = [...new Set(ready.map((a) => a.body))].sort((a, b) => a - b);

  // 4) NN corrido + idempotência
  const existing = await withBackoff("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let nn = Math.max(NN_FLOOR, ...existingSets.map((s) => nnOf(s.name)));

  // monta conjuntos: por body, split h≤5 / h≥6
  const conjuntos: { name: string; ads: Ad[] }[] = [];
  for (const b of bodies) {
    for (const grp of [ready.filter((a) => a.body === b && a.hook <= 5), ready.filter((a) => a.body === b && a.hook >= 6)]) {
      if (!grp.length) continue;
      grp.sort((x, y) => x.hook - y.hook);
      nn += 1;
      const lo = pad2(Math.min(...grp.map((x) => x.hook)));
      const hi = pad2(Math.max(...grp.map((x) => x.hook)));
      conjuntos.push({ name: `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - h${lo} a h${hi} | b${b} | ${CTA_LABEL}`, ads: grp });
    }
  }

  // 5) reaproveita copy/link/UTM de um ad irmão (Processo Bready)
  const refAds = await withBackoff("GET ref creative", () => metaGet(`${CLONE_ADSET}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }));
  const refCre = refAds.data?.[0]?.creative ?? {};
  const afs = refCre.asset_feed_spec ?? {};
  const oss = refCre.object_story_spec ?? {};
  const vd = oss.video_data ?? {}; // criativos antigos (object_story_spec) guardam a copy aqui
  const reused: Reused = {
    message: afs.bodies?.[0]?.text || vd.message || "",
    title: afs.titles?.[0]?.text || vd.title,
    link: afs.link_urls?.[0]?.website_url || vd.call_to_action?.value?.link || vd.link_description || "",
    cta: afs.call_to_action_types?.[0] || vd.call_to_action?.type || "LEARN_MORE",
    urlTags: refCre.url_tags,
    pageId: oss.page_id ?? DEFAULT_PAGE,
    ig: oss.instagram_actor_id ?? oss.instagram_user_id ?? DEFAULT_IG,
  };

  console.log(`Campanha CBO Creators ${CAMP}  ·  Victor Bready  ·  bodies: ${bodies.join(",") || "—"}`);
  console.log(`Copy reaproveitada (${reused.message.length} chars): "${reused.message.slice(0, 90).replace(/\n/g, " ")}…"`);
  console.log(`Link: ${reused.link}  ·  CTA: ${reused.cta}  ·  UTM: ${reused.urlTags ? "sim" : "—"}  ·  page ${reused.pageId} / ig ${reused.ig}`);
  for (const c of conjuntos) { console.log(`\n• ${c.name}`); for (const a of c.ads) console.log(`    ${a.nomeFinal}  [9x16 ${a.v9} | 4x5 ${a.v45}]`); }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }
  if (!conjuntos.length) throw new Error("nada pronto pra subir");
  if (!reused.message || !reused.link) throw new Error(`copy/link do irmão vieram vazios (msg=${reused.message.length} link=${reused.link})`);

  // config de clone do conjunto irmão
  const cfg = await withBackoff("GET config 142", () =>
    metaGet(CLONE_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting" }),
  );

  let totalAds = 0;
  for (const conj of conjuntos) {
    let adsetId = existingSets.find((s) => s.name === conj.name)?.id ?? null;
    if (!adsetId) {
      const created = await withBackoff(`create conj`, () =>
        metaPostForm(`${ACC}/adsets`, {
          name: conj.name, campaign_id: CAMP,
          optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
          promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: cfg.targeting,
          status: "PAUSED",
        }),
      );
      if (!created.id) throw new Error(`conjunto "${conj.name}" sem id`);
      adsetId = created.id;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${conj.name}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${conj.name}`);
    }

    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);

    for (const a of conj.ads) {
      if (names.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal)) { console.log(`  ↩︎ ${a.tpId} já existe`); continue; }
      const cre = await withBackoff(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45, reused)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await withBackoff(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
      totalAds++;
      await sleep(8000);
    }
  }

  console.log(`\nResumo: ${conjuntos.length} conjunto(s) · ${totalAds} ad(s) criado(s) nesse run.`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
