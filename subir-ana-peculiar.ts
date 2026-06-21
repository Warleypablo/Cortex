/**
 * Cria os 8 ads pareados (9x16 + 4x5) da Ana "Estratégia Peculiar" (TP1619–TP1626)
 * DENTRO do conjunto 149 (120251873967700450), que já foi criado (clone do 115, R$20/dia, PAUSED).
 *
 * Cada ad usa asset_feed_spec + asset_customization_rules (9x16 → story/reels, 4x5 → feed).
 * Os 16 vídeos já estão na biblioteca de mídia do Meta — só referenciamos os video_id (sem upload).
 *
 * Robusto a rate limit (dev-tier): cria quantos a quota aguentar, para com elegância e
 * REPORTA o progresso. Idempotente — re-rodar pula os ads que já existem e cria o resto.
 *
 *   npx tsx subir-ana-peculiar.ts        # DRY
 *   npx tsx subir-ana-peculiar.ts --go   # cria os ads que faltam no conjunto 149
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { metaPostForm, metaGet } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const TARGET_ADSET = "120251873967700450"; // conjunto 149 - [Ana] - Estratégia Peculiar (já existe)
const PAGE_ID = "111691498031338";
const IG_USER_ID = "17841423555147969";
const URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";
const TITLE = "Conheça os criativos UGCs da Turbo";
const CTA_LINK = "https://pages.turbopartners.com.br/creators/";

const MESSAGE = `A Turbo entrega os anúncios UGCs que a sua marca precisa para gerar mais resultados no social media e no tráfego pago.

São os mesmos criativos que produzimos para marcas como Óticas Paris, Minimal Club e mais de 652 grandes empresas…

... e que já geraram ROAS de 11x, 12x, 13x e até mesmo 28x nas campanhas dessas marcas.

E aqui, nós fazemos tudo de ponta a ponta:

Desde a seleção dos criadores e roteirização, até a gravação e edição desses anúncios.

Tudo para que você tenha mais engajamento, cliques e vendas consistentes das suas fontes de tráfego.

Quer entender como isso pode funcionar pra sua marca na prática?

👉 É só tocar em "Saiba Mais" e conhecer a solução de criativos UGC da Turbo`;

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

const VIDEOS: Record<string, { v9: string; v45: string }> = {
  TP1619: { v9: "2344395019383753", v45: "3436045459886448" },
  TP1620: { v9: "1537402158096661", v45: "2088675105026423" },
  TP1621: { v9: "2030269668367516", v45: "1715354033033151" },
  TP1622: { v9: "1457268329762414", v45: "1428449719309988" },
  TP1623: { v9: "27613194825036705", v45: "1365809375437755" },
  TP1624: { v9: "3163426730512145", v45: "1948061262511755" },
  TP1625: { v9: "1749288062909133", v45: "955052360937263" },
  TP1626: { v9: "1357864986251503", v45: "866876656016589" },
};
const TPS = Object.keys(VIDEOS);

const go = process.argv.includes("--go");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pairedCreativeParams(tpId: string, nomeFinal: string, v9: string, v45: string) {
  const LBL_9 = `lbl_9x16_${tpId}`;
  const LBL_4 = `lbl_4x5_${tpId}`;
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID },
    asset_feed_spec: {
      bodies: [{ text: MESSAGE }],
      titles: [{ text: TITLE }],
      link_urls: [{ website_url: CTA_LINK }],
      call_to_action_types: ["LEARN_MORE"],
      ad_formats: ["SINGLE_VIDEO"],
      videos: [
        { video_id: v9, adlabels: [{ name: LBL_9 }] },
        { video_id: v45, adlabels: [{ name: LBL_4 }] },
      ],
      asset_customization_rules: [
        {
          customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] },
          video_label: { name: LBL_9 },
        },
        {
          customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed"], instagram_positions: ["stream"] },
          video_label: { name: LBL_4 },
        },
      ],
    },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    url_tags: URL_TAGS,
  };
}

(async () => {
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, TPS));
  const byTp = new Map(rows.map((r) => [r.tpId, r]));
  const ADS = TPS.map((tp) => {
    const r = byTp.get(tp);
    if (!r) throw new Error(`${tp} não está na planilha`);
    return { tpId: tp, nomeFinal: r.nomeFinal, ...VIDEOS[tp] };
  });

  // ads já no conjunto (idempotência)
  const adsExisting = await metaGet(`${TARGET_ADSET}/ads`, { fields: "name", limit: "100" });
  const existingNames: string[] = (adsExisting.data ?? []).map((a: { name: string }) => a.name);
  const has = (tp: string) => existingNames.some((n) => n.startsWith(`${tp} `));
  const todo = ADS.filter((a) => !has(a.tpId));

  console.log(`\nConjunto 149 (${TARGET_ADSET}) — ${existingNames.length} ad(s) hoje. ${todo.length} a criar.`);
  for (const a of ADS) console.log(`  ${has(a.tpId) ? "⏭  já existe" : "🆕 criar    "} ${a.nomeFinal}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria nada)"}`);
  if (!go) {
    console.log(`(DRY) Rode com --go pra criar os ${todo.length} ad(s) faltantes.`);
    process.exit(0);
  }
  if (!todo.length) {
    console.log("✅ Os 8 já estão no conjunto. Nada a fazer.");
    process.exit(0);
  }

  let done = 0;
  for (const a of todo) {
    try {
      const cre = await metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await metaPostForm(`${ACC}/ads`, {
        name: a.nomeFinal,
        adset_id: TARGET_ADSET,
        creative: { creative_id: cre.id },
        status: "PAUSED",
      });
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
      done++;
      await sleep(2000); // gentil com a quota dev-tier
    } catch (e) {
      console.error(`  ⛔ parou em ${a.tpId}: ${e instanceof Error ? e.message : e}`);
      console.error(`     (provável quota — ${done} criado(s) nesse run; é só re-rodar pra continuar de onde parou)`);
      break;
    }
  }

  console.log(`\nResumo: ${done} criado(s) nesse run · faltam ${todo.length - done}.`);
  console.log(
    "Gerenciador:",
    `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACC.replace("act_", "")}&selected_adset_ids=${TARGET_ADSET}`,
  );
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
