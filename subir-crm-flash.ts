/**
 * Sobe o ad h1b1c1 (TP1630) pareado (9x16 + 4x5) na campanha CBO "[FLASH CRM]".
 * Vídeos já estão no Meta (só referência por video_id). Ad criado PAUSED no conjunto
 * pré-setado que já existe na campanha (CBO → sem budget no conjunto).
 *
 * Idempotente: pula se o ad TP1630 já existe no conjunto.
 *
 *   npx tsx subir-crm-flash.ts        # DRY
 *   npx tsx subir-crm-flash.ts --go   # cria (PAUSED)
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { eq } from "drizzle-orm";
import { metaGet, metaPostForm } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120252008224000450"; // [TP] [LEADS] [CBO] [FLASH CRM] - Campanha de Teste - [22.06.26]
const ADSET = "120252008223980450"; // "Novo conjunto de anúncios de Leads" (pré-setado, PAUSED via campanha)
const PAGE_ID = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const IG_USER_ID = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";
const TP = "TP1630";

// ─── vídeos já no Meta (PREENCHER após fetch dos IDs) ───
const VIDEO_9 = "1373715248001174"; // Crm_Recompra_Lucas_h1b1c1_9x16.mp4
const VIDEO_45 = "1509680107621231"; // Crm_Recompra_Lucas_h1b1c1_4x5.mp4

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

function pairedCreativeParams(nomeFinal: string) {
  const LBL_9 = `lbl_9x16_${TP}`;
  const LBL_4 = `lbl_4x5_${TP}`;
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
        { video_id: VIDEO_9, adlabels: [{ name: LBL_9 }] },
        { video_id: VIDEO_45, adlabels: [{ name: LBL_4 }] },
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
  const [row] = await db.select().from(creativesLibrary).where(eq(creativesLibrary.tpId, TP));
  if (!row) throw new Error(`${TP} não está na Biblioteca`);
  const nomeFinal = row.nomeFinal;

  // sanity dos placeholders
  const faltando: string[] = [];
  if (VIDEO_9.startsWith("__")) faltando.push("VIDEO_9 (id do 9x16)");
  if (VIDEO_45.startsWith("__")) faltando.push("VIDEO_45 (id do 4x5)");
  if (MESSAGE.startsWith("__")) faltando.push("MESSAGE (copy)");
  if (CTA_LINK.startsWith("__")) faltando.push("CTA_LINK (link destino — pode subir pendente)");

  console.log(`Campanha: ${CAMP} (CBO)`);
  console.log(`Conjunto: ${ADSET} (pré-setado)`);
  console.log(`Ad:       ${nomeFinal}  [9x16 ${VIDEO_9} | 4x5 ${VIDEO_45}]  → PAUSED`);
  console.log(`CTA:      ${CTA_TYPE}  |  link: ${CTA_LINK}`);
  console.log(`UTM:      ${URL_TAGS}`);
  if (faltando.length) console.log(`\n⚠️  faltam preencher: ${faltando.join(", ")}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) {
    console.log("(DRY) Rode com --go pra criar.");
    process.exit(0);
  }
  // Bloqueia se faltar vídeo ou copy (link pode ir pendente conscientemente).
  const bloqueantes = faltando.filter((f) => !f.startsWith("CTA_LINK"));
  if (bloqueantes.length) throw new Error(`não dá pra criar — faltam: ${bloqueantes.join(", ")}`);

  // idempotência: ad já existe?
  const adsExisting = await metaGet(`${ADSET}/ads`, { fields: "name", limit: "100" });
  const exists = (adsExisting.data ?? []).some((a: { name: string }) => a.name.startsWith(`${TP} `) || a.name === nomeFinal);
  if (exists) {
    console.log(`↩︎ ad ${TP} já existe no conjunto — nada a fazer.`);
    process.exit(0);
  }

  const cre = await metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(nomeFinal));
  if (!cre.id) throw new Error("creative sem id");
  const ad = await metaPostForm(`${ACC}/ads`, {
    name: nomeFinal,
    adset_id: ADSET,
    creative: { creative_id: cre.id },
    status: "PAUSED",
  });
  if (!ad.id) throw new Error("ad sem id");
  console.log(`\n✅ ad ${TP} criado: ${ad.id} (PAUSED, 9x16+4x5) | creative ${cre.id}`);
  console.log(
    "Gerenciador:",
    `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACC.replace("act_", "")}&selected_adset_ids=${ADSET}`,
  );
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
