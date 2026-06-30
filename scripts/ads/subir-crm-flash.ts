/**
 * Sobe os ads do lote CRM Recompra (b1c1, hooks h1–h9 = TP1630–TP1638) pareados (9x16+4x5),
 * todos PAUSED, no conjunto pré-setado da campanha CBO "[FLASH CRM]" (sem budget no conjunto).
 * Vídeos já estão no Meta (só referência por video_id).
 *
 * Robusto: idempotente (pula ad que já existe pelo TP) e gentil com a quota dev-tier —
 * espaça as criações e, em rate-limit duro (80004/80014), espera e tenta de novo; re-rodar
 * continua de onde parou.
 *
 *   npx tsx subir-crm-flash.ts        # DRY
 *   npx tsx subir-crm-flash.ts --go   # cria (PAUSED)
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120252008224000450"; // [TP] [LEADS] [CBO] [FLASH CRM] - Campanha de Teste - [22.06.26]
const ADSET = "120252008223980450"; // "Novo conjunto de anúncios de Leads" (pré-setado, PAUSED via campanha)
const PAGE_ID = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const IG_USER_ID = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

// ─── vídeos já no Meta (b1c1, h1–h9), pareados por hook ───
const VIDEOS: Record<string, { v9: string; v45: string }> = {
  TP1630: { v9: "1373715248001174", v45: "1509680107621231" }, // h1
  TP1631: { v9: "27374069562274562", v45: "1567059148170640" }, // h2
  TP1632: { v9: "1501813371141785", v45: "2012524936027535" }, // h3
  TP1633: { v9: "27628050873455124", v45: "1669134627474625" }, // h4
  TP1634: { v9: "1693965168509513", v45: "1016808464372912" }, // h5
  TP1635: { v9: "1036872112232179", v45: "1315458376907019" }, // h6
  TP1636: { v9: "886275941181007", v45: "1927776761226484" }, // h7
  TP1637: { v9: "1421378906461834", v45: "1002261789265052" }, // h8
  TP1638: { v9: "1093122969977598", v45: "1566242568173543" }, // h9
};
const TPS = Object.keys(VIDEOS);

// ─── conteúdo do anúncio ───
// UTM dinâmica padrão da Turbo (campaign-agnostic — funciona em qualquer campanha).
const URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";
// PENDENTE: link real da página de destino virá do usuário. URL válida de placeholder até lá
// (a copy pede "preenche um formulário curto" → landing com form). Trocar antes de publicar.
const CTA_LINK = "https://turbopartners.com.br/";
const CTA_TYPE = "LEARN_MORE"; // "Saiba mais" — confirmado
const TITLE = ""; // opcional p/ vídeo
const MESSAGE = `Conquistar cliente novo é a venda mais cara que o seu e-commerce faz. A mais barata é pra quem já comprou de você — e é justamente essa que quase nenhuma marca faz.

Vender só pra cliente novo é a coisa mais cara que a sua marca pode fazer.

É caro em custo de anúncio, é caro em margem no seu negócio e é caro em tempo que você investe pra tentar fazer suas campanhas converterem…

E você só percebe isso, quando olha pro mês inteiro e vê o quanto gastou em tráfego com gente nova que não tá recomprando nenhuma vez.

Agora quando você começa a vender de novo pra quem já comprou, o seu jogo muda:

Cada cliente te gera muito mais do que você gastou pra adquirir…

O seu negócio tem muito mais margem…

E você começa a ter investimento de sobra pra escalar a sua marca.

Então se você quer transformar quem já comprou da sua marca no seu maior canal de vendas…

Toca aqui embaixo em 'Saiba mais', preenche um formulário curto, que um dos nossos consultores vai entrar em contato com você.`;

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
const RATE_WAIT_MS = 5 * 60_000; // espera em rate-limit duro
const MAX_RATE_RETRIES = 8; // ~40min de janela coberta por ad

function pairedCreativeParams(tpId: string, nomeFinal: string, v9: string, v45: string) {
  const LBL_9 = `lbl_9x16_${tpId}`;
  const LBL_4 = `lbl_4x5_${tpId}`;
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID },
    asset_feed_spec: {
      bodies: [{ text: MESSAGE }],
      ...(TITLE ? { titles: [{ text: TITLE }] } : {}),
      link_urls: [{ website_url: CTA_LINK }],
      call_to_action_types: [CTA_TYPE],
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

/** Cria 1 ad pareado (creative + ad PAUSED), com retry em rate-limit duro. */
async function createPairedAd(a: { tpId: string; nomeFinal: string; v9: string; v45: string }): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const cre = await metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await metaPostForm(`${ACC}/ads`, {
        name: a.nomeFinal,
        adset_id: ADSET,
        creative: { creative_id: cre.id },
        status: "PAUSED",
      });
      if (!ad.id) throw new Error("ad sem id");
      return ad.id as string;
    } catch (e) {
      if (e instanceof MetaRateLimitError && attempt < MAX_RATE_RETRIES) {
        console.log(`   ⏳ rate-limit em ${a.tpId} — esperando ${RATE_WAIT_MS / 60000}min (tentativa ${attempt + 1}/${MAX_RATE_RETRIES})`);
        await sleep(RATE_WAIT_MS);
        continue;
      }
      throw e;
    }
  }
}

(async () => {
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, TPS));
  const byTp = new Map(rows.map((r) => [r.tpId, r]));
  const ADS = TPS.map((tp) => {
    const r = byTp.get(tp);
    if (!r) throw new Error(`${tp} não está na Biblioteca`);
    return { tpId: tp, nomeFinal: r.nomeFinal, ...VIDEOS[tp] };
  });

  console.log(`Campanha: ${CAMP} (CBO)`);
  console.log(`Conjunto: ${ADSET} (pré-setado)`);
  console.log(`CTA: ${CTA_TYPE} | link: ${CTA_LINK} (placeholder, pendente)`);
  console.log(`${ADS.length} ad(s) pareados (9x16+4x5), PAUSED:`);
  for (const a of ADS) console.log(`  • ${a.nomeFinal}   [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) {
    console.log("(DRY) Rode com --go pra criar.");
    process.exit(0);
  }

  // idempotência: quais ads já existem no conjunto?
  const adsExisting = await metaGet(`${ADSET}/ads`, { fields: "name", limit: "200" });
  const existingNames: string[] = (adsExisting.data ?? []).map((a: { name: string }) => a.name);
  const todo = ADS.filter((a) => !existingNames.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal));
  console.log(`\n${todo.length} ad(s) a criar (de ${ADS.length}); ${ADS.length - todo.length} já existem.`);

  let done = 0;
  for (const a of todo) {
    try {
      const adId = await createPairedAd(a);
      console.log(`  ✅ ${a.tpId} → ad ${adId} (PAUSED, 9x16+4x5)`);
      done++;
      await sleep(8000);
    } catch (e) {
      console.error(`  ⛔ parou em ${a.tpId}: ${e instanceof Error ? e.message : e}`);
      console.error(`     (${done} criado(s) nesse run; re-rodar continua de onde parou)`);
      break;
    }
  }

  console.log(`\nResumo: ${done} criado(s) nesse run · faltam ${todo.length - done}.`);
  console.log(
    "Gerenciador:",
    `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACC.replace("act_", "")}&selected_adset_ids=${ADSET}`,
  );
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
