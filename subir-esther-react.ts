/**
 * Sobe os 3 ads do lote Esther "Estratégia Peculiar React" (TP1228–TP1230) NO CONJUNTO 92
 * (120251598318040450), onde o TP1228 já está ATIVO. Cria os 3 como PAUSED — o TP1228 vira
 * um DUP pausado (o original ativo fica intacto, performando) e TP1229/TP1230 entram novos.
 *
 * Os vídeos 9x16 já estão na biblioteca de mídia do Meta — só referenciamos os video_id
 * (sem upload, sem quota de upload). Copy clonada do ad TP1228. Ads novos PAUSED.
 * Idempotente: ad cujo TP já existe no conjunto é pulado. Seguro pra re-rodar após falha parcial.
 *
 *   npx tsx subir-esther-react.ts        # DRY: mostra o que faria
 *   npx tsx subir-esther-react.ts --go   # cria os ads faltantes no conjunto 92
 */
import "dotenv/config";
import { metaGet, metaPostForm, getVideoThumbnail } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const ADSET = "120251598318040450"; // 92 - [IG] [Aberto] [Stories & Feed & Reels] [Esther] - Estratégia Peculiar React
const PAGE_ID = "111691498031338";
const IG_USER_ID = "17841423555147969";
const URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";
const TITLE = "Conheça os criativos UGCs da Turbo";
const CTA_LINK = "https://pages.turbopartners.com.br/creators/";

// Copy exata clonada do ad TP1228 (asset_feed_spec.bodies[0].text)
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

// TP ↔ video_id (9x16) já na biblioteca de mídia do Meta
const ADS = [
  { tpId: "TP1228", hook: 1, videoId: "997472019375472", nomeFinal: "TP1228 - estrategia_peculiar_react_Esther_Hook1_9x16 -  - 23.04.26" },
  { tpId: "TP1229", hook: 2, videoId: "2080369002549935", nomeFinal: "TP1229 - estrategia_peculiar_react_Esther_Hook2_9x16 -  - 23.04.26" },
  { tpId: "TP1230", hook: 3, videoId: "2482788605486431", nomeFinal: "TP1230 - estrategia_peculiar_react_Esther_Hook3_9x16 -  - 23.04.26" },
];

const go = process.argv.includes("--go");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const adsExisting = await metaGet(`${ADSET}/ads`, { fields: "name,status", limit: "100" });
  const existing = (adsExisting.data ?? []) as { name: string; status: string }[];
  // Cria os 3 — o TP1228 vira um dup PAUSED (o original ATIVO fica intacto).
  // Idempotente p/ retry: pula TP que já tenha um ad PAUSED nosso no conjunto.
  const alreadyPaused = (tp: string) =>
    existing.some((a) => a.name.startsWith(`${tp} `) && a.status === "PAUSED");

  console.log(`\nConjunto 92 (${ADSET}) — ${existing.length} ad(s) hoje.`);
  for (const a of ADS)
    console.log(`  ${alreadyPaused(a.tpId) ? "⏭  já tem dup PAUSED" : "🆕 criar (PAUSED)   "} ${a.nomeFinal}`);

  const todo = ADS.filter((a) => !alreadyPaused(a.tpId));
  console.log(`\n${todo.length} ad(s) a criar.  modo: ${go ? "🔴 CRIAR" : "DRY (não cria nada)"}`);
  if (!go) {
    console.log(`(DRY) Rode com --go pra criar os ${todo.length} ad(s) no conjunto 92.`);
    process.exit(0);
  }
  if (!todo.length) {
    console.log("Nada a criar — os 3 já têm dup PAUSED no conjunto.");
    process.exit(0);
  }

  for (const a of todo) {
    let thumb: string | null = null;
    try {
      thumb = await getVideoThumbnail(a.videoId);
    } catch {
      /* segue sem thumb */
    }
    const videoData: Record<string, unknown> = {
      video_id: a.videoId,
      message: MESSAGE,
      title: TITLE,
      link_description: "",
      call_to_action: { type: "LEARN_MORE", value: { link: CTA_LINK } },
    };
    if (thumb) videoData.image_url = thumb;

    const cre = await metaPostForm(`${ACC}/adcreatives`, {
      name: `Criativo: ${a.nomeFinal}`,
      object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID, video_data: videoData },
      degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
      contextual_multi_ads: { enroll_status: "OPT_OUT" },
      url_tags: URL_TAGS,
    });
    if (!cre.id) throw new Error(`criativo ${a.tpId} sem id`);

    const ad = await metaPostForm(`${ACC}/ads`, {
      name: a.nomeFinal,
      adset_id: ADSET,
      creative: { creative_id: cre.id },
      status: "PAUSED",
    });
    if (!ad.id) throw new Error(`ad ${a.tpId} sem id`);
    console.log(`  ✅ ${a.tpId} (h${a.hook}) → ad ${ad.id} (PAUSED)`);
    await sleep(800);
  }

  console.log(
    "\nGerenciador:",
    `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACC.replace("act_", "")}&selected_adset_ids=${ADSET}`,
  );
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
