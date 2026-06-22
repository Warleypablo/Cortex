/**
 * Cria o conjunto novo + os 3 ads pareados (9x16+4x5) da Ana "Super Produção" (TP1627–1629)
 * na campanha Creators ABO teste, clonando a config do 115. Vídeos já no Meta (só referência).
 *
 * Robusto: reusa o conjunto por TEMA ("[Ana] - Super Produção") se já existir — evita o bug de
 * criar conjunto duplicado quando o nome usa [NN] sequencial. Idempotente (pula ad que já existe)
 * e gentil com rate limit (cria o que a quota aguenta, para e reporta).
 *
 *   npx tsx subir-superproducao-ads.ts        # DRY
 *   npx tsx subir-superproducao-ads.ts --go   # cria
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { metaGet, metaPostForm } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120215204345090450";
const TEMPLATE_ADSET = "120249587099640450"; // 115 - [Ana] - Estratégia Peculiar (config de referência)
const PAGE_ID = "111691498031338";
const IG_USER_ID = "17841423555147969";
const DAILY_BUDGET = "2000"; // R$20/dia
const URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";
const TITLE = "Conheça os criativos UGCs da Turbo";
const CTA_LINK = "https://pages.turbopartners.com.br/creators/";
const THEME_RE = /\[ana\]\s*-\s*super\s*produ/i;

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
  TP1627: { v9: "999790209702452", v45: "1015198434333466" },
  TP1628: { v9: "2187819512058555", v45: "1393585725921535" },
  TP1629: { v9: "1487292976051929", v45: "1066875876020376" },
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

  const adsets = await metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "400" });
  const list: { id: string; name: string }[] = adsets.data ?? [];
  let max = 0;
  for (const s of list) {
    const m = /^\s*\[?(\d{1,3})\]?\s*-/.exec(s.name ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const existente = list.find((s) => THEME_RE.test(s.name ?? ""));
  let adsetId: string | null = existente?.id ?? null;
  const ADSET_NAME = existente?.name ?? `${max + 1} - [IG] [Aberto] [Stories & Feed & Reels] [Ana] - Super Produção`;

  console.log(`\nConjunto: ${ADSET_NAME}`);
  console.log(adsetId ? `  (reusa existente ${adsetId})` : `  (novo — clone do 115, R$20/dia, PAUSED)`);
  console.log(`  3 ads pareados (9x16+4x5), PAUSED:`);
  for (const a of ADS) console.log(`    • ${a.nomeFinal}   [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria nada)"}`);
  if (!go) {
    console.log(`(DRY) Rode com --go pra criar.`);
    process.exit(0);
  }

  if (!adsetId) {
    const tpl = await metaGet(TEMPLATE_ADSET, {
      fields: "billing_event,optimization_goal,bid_strategy,promoted_object,attribution_spec,targeting",
    });
    const setRes = await metaPostForm(`${ACC}/adsets`, {
      name: ADSET_NAME,
      campaign_id: CAMP,
      daily_budget: DAILY_BUDGET,
      billing_event: tpl.billing_event,
      optimization_goal: tpl.optimization_goal,
      bid_strategy: tpl.bid_strategy,
      promoted_object: tpl.promoted_object,
      attribution_spec: tpl.attribution_spec,
      targeting: tpl.targeting,
      status: "PAUSED",
    });
    if (!setRes.id) throw new Error("conjunto sem id");
    adsetId = setRes.id;
    console.log(`\n✅ conjunto criado: ${adsetId} (PAUSED)`);
  } else {
    console.log(`\n↻ reusando conjunto ${adsetId}`);
  }

  const adsExisting = await metaGet(`${adsetId}/ads`, { fields: "name", limit: "100" });
  const existingNames: string[] = (adsExisting.data ?? []).map((a: { name: string }) => a.name);
  const todo = ADS.filter((a) => !existingNames.some((n) => n.startsWith(`${a.tpId} `)));
  console.log(`${todo.length} ad(s) a criar (de ${ADS.length}).`);

  let done = 0;
  for (const a of todo) {
    try {
      const cre = await metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await metaPostForm(`${ACC}/ads`, {
        name: a.nomeFinal,
        adset_id: adsetId,
        creative: { creative_id: cre.id },
        status: "PAUSED",
      });
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
      done++;
      await sleep(2000);
    } catch (e) {
      console.error(`  ⛔ parou em ${a.tpId}: ${e instanceof Error ? e.message : e}`);
      console.error(`     (provável quota — ${done} criado(s); re-rodar continua de onde parou)`);
      break;
    }
  }

  console.log(`\nResumo: ${done} criado(s) nesse run · faltam ${todo.length - done}.`);
  console.log(
    "Gerenciador:",
    `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACC.replace("act_", "")}&selected_adset_ids=${adsetId}`,
  );
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
