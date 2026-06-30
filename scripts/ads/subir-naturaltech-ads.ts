/**
 * Sobe os ads do lote "Natural tech" na camp CBO Creators teste.
 * São clipes SOLTOS (sem h/b/c, sem 9x16+4x5) → cada clipe vira 1 ad de VÍDEO ÚNICO.
 *
 * - 3 conjuntos por persona: 165 Esther, 166 Ichino, 167 Musso (NN corrido, piso 164).
 * - Cruza Biblioteca (TP1693–1704) × video_id no Gerenciador por nome normalizado.
 * - Clona config (otimização/pixel/atribuição/targeting) do conjunto 109 Roberto Natural Tech.
 * - Reaproveita copy/link/cta/UTM de um ad do Roberto (UTMs hsa_grp/hsa_ad → macros dinâmicos).
 * - Tudo PAUSED (conjunto + ad).
 *
 *   npx tsx subir-naturaltech-ads.ts        # DRY (descobre + mostra plano, não escreve)
 *   npx tsx subir-naturaltech-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { and, isNull, gte, lte, sql } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120249141209100450"; // [TP] [Leads] [CBO] [Creators] - Campanha de teste
const CLONE_ADSET = "120249175298350450"; // 109 - [Roberto] - Natural Tech (config + creative de referência)
const NN_FLOOR = 164; // global: não reusar até 164 (CRM 151–158, Victor 159–164)
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

// ordem importa p/ NN corrido (Esther 165, Ichino 166, Musso 167)
const PERSONAS: { persona: string; tema: string }[] = [
  { persona: "Esther", tema: "Estratégia peculiar natural tech" },
  { persona: "Ichino", tema: "Estratégia peculiar natural tech" },
  { persona: "Musso", tema: "Natural tech" },
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
const norm = (s: string) => (s ?? "").toLowerCase().replace(/\.[^.]+$/, "").replace(/[\s_]+/g, "").replace(/-/g, "");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function withBackoff<T>(label: string, fn: () => Promise<T>, max = 12): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit em ${label} — espera 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}

interface Reused { message: string; title?: string; link: string; cta: string; urlTags?: string; pageId: string; ig: string }

// clipe SOLTO = vídeo único sem placement customization → creative clássico (object_story_spec.video_data).
// asset_feed_spec sem asset_customization_rules viraria "Dynamic Creative" e exigiria adset DCO.
async function getThumb(videoId: string): Promise<string | undefined> {
  const res = await withBackoff(`thumb ${videoId}`, () => metaGet(`${videoId}/thumbnails`, { fields: "uri,is_preferred" }));
  const t = (res.data ?? []).find((x: any) => x.is_preferred) ?? res.data?.[0];
  return t?.uri;
}

function soloCreativeParams(nomeFinal: string, videoId: string, thumb: string | undefined, r: Reused) {
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: {
      page_id: r.pageId,
      instagram_user_id: r.ig,
      video_data: {
        video_id: videoId,
        ...(thumb ? { image_url: thumb } : {}),
        ...(r.title ? { title: r.title } : {}),
        message: r.message,
        call_to_action: { type: r.cta, value: { link: r.link } },
      },
    },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    ...(r.urlTags ? { url_tags: r.urlTags } : {}),
  };
}

(async () => {
  // 1) Biblioteca TP1693–1704
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    gte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1693),
    lte(sql`CAST(REGEXP_REPLACE(${creativesLibrary.tpId}, '[^0-9]', '', 'g') AS INTEGER)`, 1704),
  ));

  // 2) video_id no Gerenciador (pagina; casa por nome normalizado)
  const vmap = new Map<string, { id: string; title: string }>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  for (let page = 0; url && page < 15; page++) {
    const res: any = await withBackoff("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) if (/natural\s*tech/i.test(v.title ?? "")) vmap.set(norm(v.title), { id: v.id, title: v.title });
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }

  // 3) cruza
  type Ad = { tpId: string; nomeFinal: string; persona: string; videoId: string };
  const ready: Ad[] = [];
  const warns: string[] = [];
  for (const r of rows) {
    const v = vmap.get(norm(r.nomeDrive));
    if (!v) { warns.push(`${r.tpId} (${r.nomeDrive}): sem vídeo no Gerenciador`); continue; }
    ready.push({ tpId: r.tpId, nomeFinal: r.nomeFinal, persona: r.personagem ?? "?", videoId: v.id });
  }

  // 4) conjuntos por persona, NN corrido
  const existing = await withBackoff("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  let nn = Math.max(NN_FLOOR, ...existingSets.map((s) => nnOf(s.name)));
  const conjuntos: { name: string; persona: string; ads: Ad[] }[] = [];
  for (const p of PERSONAS) {
    const ads = ready.filter((a) => a.persona.toLowerCase() === p.persona.toLowerCase())
      .sort((x, y) => x.tpId.localeCompare(y.tpId, "en", { numeric: true }));
    if (!ads.length) continue;
    nn += 1;
    conjuntos.push({ persona: p.persona, ads, name: `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${p.persona}] - ${p.tema}` });
  }

  // 5) reaproveita copy/link/UTM de um ad do Roberto
  const refAds = await withBackoff("GET ref creative", () => metaGet(`${CLONE_ADSET}/ads`, { fields: "creative{asset_feed_spec,url_tags,object_story_spec}", limit: "1" }));
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

  console.log(`Campanha CBO Creators ${CAMP}  ·  Natural tech  ·  ${ready.length}/${rows.length} clipe(s) prontos`);
  console.log(`Copy reaproveitada (${reused.message.length} chars): "${reused.message.slice(0, 90).replace(/\n/g, " ")}…"`);
  console.log(`Link: ${reused.link}  ·  CTA: ${reused.cta}  ·  UTM: ${reused.urlTags ? "sim" : "—"}  ·  page ${reused.pageId} / ig ${reused.ig}`);
  for (const c of conjuntos) { console.log(`\n• ${c.name}`); for (const a of c.ads) console.log(`    ${a.nomeFinal}  [video ${a.videoId}]`); }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }
  if (!conjuntos.length) throw new Error("nada pronto pra subir");
  if (!reused.message || !reused.link) throw new Error(`copy/link do Roberto vieram vazios (msg=${reused.message.length} link=${reused.link})`);

  // config de clone do conjunto Roberto
  const cfg = await withBackoff("GET config Roberto", () =>
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
      const thumb = await getThumb(a.videoId);
      const cre = await withBackoff(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, soloCreativeParams(a.nomeFinal, a.videoId, thumb, reused)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await withBackoff(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, vídeo único)`);
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
