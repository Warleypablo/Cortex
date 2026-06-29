/**
 * Sobe os ads do lote "Creator Summit React" na camp CBO Creators teste.
 * Estrutura: máx 5 ads/conjunto → 1 CONJUNTO POR PERSONA (Esther 4 ads, Lucas 5 ads).
 * Cada hook = 1 ad PAREADO 9x16(stories)+4x5(feed). Tudo PAUSED.
 *
 * ⚠️ Match de vídeo é ESTRITO pelo nome EXATO do arquivo (`<base>_9x16` / `<base>_4x5`),
 *    pra NÃO confundir com outras famílias no Gerenciador (creators_summit_lucas_h*_b*,
 *    Estrategia_peculiar_react, Mockup_caprichado_react, vv-creatorssummit-*). Duplicatas do
 *    mesmo nome → escolhe id determinístico (menor).
 *
 * - Cruza Biblioteca (TP1731–1739) por nomeDrive (= base) × vídeo no Gerenciador.
 * - Clona config + copy/link/UTM do conjunto irmão 142 Processo Bready (placeholder).
 * - NN deterministico por sufixo do nome ("[Persona] - Creator Summit React").
 *
 *   npx tsx subir-summit-react-ads.ts        # DRY (descobre + mostra plano, não escreve)
 *   npx tsx subir-summit-react-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120249141209100450"; // [TP] [Leads] [CBO] [Creators] - Campanha de teste
const CLONE_ADSET = "120251810662370450"; // 142 Esther Processo Bready (config + copy de referência)
const NN_FLOOR = 170; // não reusar até 170 (Caio foi 168–170)
const TEMA = "Creator Summit React";
const PERSONA_ORDER = ["Esther", "Lucas"]; // ordem dos conjuntos
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
  // 1) Biblioteca TP1731–1739
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1731),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1739),
  ));

  // 2) índice de vídeos por nome EXATO (sem extensão) → ids (captura duplicatas)
  const byName = new Map<string, string[]>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  for (let page = 0; url && page < 30; page++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) { const k = norm(v.title ?? ""); if (k) (byName.get(k) ?? byName.set(k, []).get(k)!).push(v.id); }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }
  const pick = (ids: string[]) => [...ids].sort()[0];

  // 3) cruza ESTRITO: <base>_9x16 / <base>_4x5
  type Ad = { hook: number; tpId: string; nomeFinal: string; persona: string; v9: string; v45: string };
  const ready: Ad[] = [];
  const warns: string[] = [];
  for (const r of rows) {
    const base = r.nomeDrive ?? "";
    const c9 = byName.get(norm(`${base}_9x16`)) ?? [];
    const c4 = byName.get(norm(`${base}_4x5`)) ?? [];
    if (!c9.length || !c4.length) { warns.push(`${r.tpId} (${base}): falta ${!c9.length ? "9x16" : "4x5"} no Gerenciador`); continue; }
    const mh = /h\s*([1-9])/i.exec(base);
    ready.push({ hook: mh ? +mh[1] : 0, tpId: r.tpId, nomeFinal: r.nomeFinal, persona: r.personagem ?? "?", v9: pick(c9), v45: pick(c4) });
  }

  // 4) agrupa por persona (1 conjunto cada, máx 5 ads), ordenado por hook
  const byPersona = new Map<string, Ad[]>();
  for (const a of ready) (byPersona.get(a.persona) ?? byPersona.set(a.persona, []).get(a.persona)!).push(a);
  for (const arr of byPersona.values()) arr.sort((x, y) => x.hook - y.hook);
  const personas = PERSONA_ORDER.filter((p) => byPersona.has(p)).concat([...byPersona.keys()].filter((p) => !PERSONA_ORDER.includes(p)));

  // 5) NN deterministico por sufixo
  const existing = await bk("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let nnCounter = Math.max(NN_FLOOR, ...existingSets.map((s) => nnOf(s.name)));
  const sufixo = (p: string) => `[${p}] - ${TEMA}`;
  const conjuntos: { name: string; existingId: string | null; persona: string; ads: Ad[] }[] = [];
  for (const p of personas) {
    const ads = byPersona.get(p)!;
    if (ads.length > 5) { warns.push(`${p}: ${ads.length} ads (>5) — revisar split`); }
    const found = existingSets.find((s) => (s.name ?? "").includes(sufixo(p)));
    let name: string;
    if (found) name = found.name;
    else { nnCounter += 1; name = `${nnCounter} - [IG] [Aberto] [Stories & Feed & Reels] ${sufixo(p)}`; }
    conjuntos.push({ name, existingId: found?.id ?? null, persona: p, ads });
  }

  // 6) copy/link/UTM do irmão 142 (placeholder)
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

  console.log(`Campanha CBO Creators ${CAMP}  ·  ${TEMA}  ·  ${conjuntos.length} conjunto(s) (1/persona, máx 5 ads)`);
  console.log(`Copy placeholder (${reused.message.length} chars): "${reused.message.slice(0, 90).replace(/\n/g, " ")}…"`);
  console.log(`Link: ${reused.link}  ·  CTA: ${reused.cta}  ·  UTM: ${reused.urlTags ? "sim" : "—"}  ·  page ${reused.pageId} / ig ${reused.ig}`);
  for (const c of conjuntos) {
    console.log(`\n• ${c.existingId ? "↩︎ existe " + c.existingId : "novo"} — ${c.name}  (${c.ads.length} ads)`);
    for (const a of c.ads) console.log(`    ${a.nomeFinal}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }
  if (!conjuntos.length) throw new Error("nada pronto pra subir");
  if (!reused.message || !reused.link) throw new Error(`copy/link do irmão vieram vazios (msg=${reused.message.length} link=${reused.link})`);

  const cfg = await bk("GET config 142", () =>
    metaGet(CLONE_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }),
  );

  let totalAds = 0;
  for (const conj of conjuntos) {
    let adsetId = conj.existingId;
    if (!adsetId) {
      const created = await bk(`create conj ${conj.persona}`, () =>
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
