/**
 * One-off: cria os ads do lote "Bastidores" da personagem Ana na campanha Creators ABO teste.
 * Variante do fluxo Bready: os vídeos 9x16 JÁ foram subidos no Meta manualmente (biblioteca de mídia),
 * então aqui apenas referenciamos os video_id existentes — sem download do Drive / sem upload.
 * Cria UM único conjunto (148) com os 3 hooks dentro, clonando a config do conjunto Ana 115
 * (otimização OFFSITE_CONVERSIONS/LEAD, pixel, targeting BR aberto). Tudo PAUSED, R$20/dia.
 *
 * Copy = a copy completa dos ads Ana/Creators (asset_feed_spec do TP1350), com UTM dinâmica limpa
 * (o ad antigo tinha o typo "tum_term ="). Criativos cadastrados na biblioteca como TP1616-TP1618.
 *
 * Uso: npx tsx subir-ana-bastidores.ts
 */
import "dotenv/config";
import { metaGet, metaPostForm, getVideoThumbnail } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120215204345090450";                 // [TP] [Leads] [ABO] [Creators] - Campanha de teste
const TEMPLATE_ADSET = "120249587099640450";       // 115 - [Ana] - Estratégia Peculiar (config de referência)
const PAGE_ID = "111691498031338";
const IG_USER_ID = "17841423555147969";
const DAILY_BUDGET = "2000";                        // R$20/dia
const NN = 148;
const ADSET_NAME = `${NN} - [IG] [Aberto] [Stories & Feed & Reels] [Ana] - Bastidores - h01 a h03 | b1 | c1`;

const MESSAGE = `A Turbo entrega os anúncios UGCs que a sua marca precisa para gerar mais resultados no social media e no tráfego pago.

São os mesmos criativos que produzimos para marcas como Óticas Paris, Minimal Club e mais de 652 grandes empresas…

... e que já geraram ROAS de 11x, 12x, 13x e até mesmo 28x nas campanhas dessas marcas.

E aqui, nós fazemos tudo de ponta a ponta:

Desde a seleção dos criadores e roteirização, até a gravação e edição desses anúncios.

Tudo para que você tenha mais engajamento, cliques e vendas consistentes das suas fontes de tráfego.

Quer entender como isso pode funcionar pra sua marca na prática?

👉 É só tocar em “Saiba Mais” e conhecer a solução de criativos UGC da Turbo`;
const TITLE = "Conheça os criativos UGCs da Turbo";
const CTA_LINK = "https://pages.turbopartners.com.br/creators/";
const TURBO_URL_TAGS = "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}";

const ADVANTAGE_PLUS_OPT_OUT = { creative_features_spec: {
  image_touchups: { enroll_status: "OPT_OUT" }, image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
  image_uncrop: { enroll_status: "OPT_OUT" }, text_optimizations: { enroll_status: "OPT_OUT" },
  inline_comment: { enroll_status: "OPT_OUT" }, audio: { enroll_status: "OPT_OUT" }, image_animation: { enroll_status: "OPT_OUT" },
} };

// nome_final da biblioteca (TP1616-1618) ↔ video_id já no Meta (9x16)
const ADS = [
  { tpId: "TP1616", hook: 1, videoId: "1690725772151388",  nomeFinal: "TP1616 - Bastidores_ana_ h1 b1 c1 _9x16 -  - 16.06.26" },
  { tpId: "TP1617", hook: 2, videoId: "27804987962472096", nomeFinal: "TP1617 - Bastidores_ana_ h2 b1 c1 _9x16 -  - 16.06.26" },
  { tpId: "TP1618", hook: 3, videoId: "1566797498143837",  nomeFinal: "TP1618 - Bastidores_ana_ h3 b1 c1 _9x16 -  - 16.06.26" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ---- trava anti-duplicação ----
  const existing: any = await metaGet(`${CAMP}/adsets`, { fields: "name", limit: "400" });
  if ((existing.data || []).some((s: any) => s.name === ADSET_NAME)) throw new Error(`ABORT: conjunto já existe: "${ADSET_NAME}"`);

  // ---- clona config do template Ana 115 ----
  const tpl: any = await metaGet(TEMPLATE_ADSET, { fields: "billing_event,optimization_goal,bid_strategy,promoted_object,attribution_spec,targeting" });
  console.log("template:", { og: tpl.optimization_goal, be: tpl.billing_event, bs: tpl.bid_strategy });

  // ============ conjunto único 148 ============
  const setRes = await metaPostForm(`${ACC}/adsets`, {
    name: ADSET_NAME, campaign_id: CAMP, daily_budget: DAILY_BUDGET,
    billing_event: tpl.billing_event, optimization_goal: tpl.optimization_goal, bid_strategy: tpl.bid_strategy,
    promoted_object: tpl.promoted_object, attribution_spec: tpl.attribution_spec, targeting: tpl.targeting, status: "PAUSED",
  });
  if (!setRes.id) throw new Error("conjunto sem id");
  const adsetId = setRes.id;
  console.log(`✅ conjunto ${NN} criado: ${adsetId} (R$${Number(DAILY_BUDGET) / 100}/dia, PAUSED)`);

  // ============ 3 criativos + ads ============
  const out: any[] = [];
  for (const a of ADS) {
    let thumb: string | null = null; try { thumb = await getVideoThumbnail(a.videoId); } catch {}
    const videoData: Record<string, any> = {
      video_id: a.videoId, message: MESSAGE, title: TITLE, link_description: "",
      call_to_action: { type: "LEARN_MORE", value: { link: CTA_LINK } },
    };
    if (thumb) videoData.image_url = thumb;
    const cre = await metaPostForm(`${ACC}/adcreatives`, {
      name: `Criativo: ${a.nomeFinal}`,
      object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID, video_data: videoData },
      degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT, contextual_multi_ads: { enroll_status: "OPT_OUT" }, url_tags: TURBO_URL_TAGS,
    });
    if (!cre.id) throw new Error(`criativo ${a.tpId} sem id`);
    const ad = await metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" });
    if (!ad.id) throw new Error(`ad ${a.tpId} sem id`);
    out.push({ tpId: a.tpId, hook: a.hook, creativeId: cre.id, adId: ad.id });
    console.log(`  ✅ ${a.tpId} (h${a.hook}) → ad ${ad.id} (PAUSED)`);
    await sleep(800);
  }

  console.log("\n===== RESUMO =====");
  console.log("conjunto:", adsetId, "|", ADSET_NAME);
  out.forEach((o) => console.log(`  ${o.tpId} h${o.hook}: ad=${o.adId} creative=${o.creativeId}`));
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACC.replace("act_", "")}&selected_adset_ids=${adsetId}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
