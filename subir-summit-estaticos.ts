/**
 * Sobe os estáticos do Creator Summit (QUENTE) no conjunto '10', PAREADOS 4x5(feed)+9x16(stories)
 * num único ad via asset_feed_spec — imagens já no gerenciador (só referência por image_hash).
 * Copy/link/CTA = PADRÃO dos outros ads da campanha. Registra cada ad na Biblioteca (TP sequencial)
 * e usa o nome_final (TPxxxx - <base>) como nome do ad. Tudo PAUSED.
 *
 *   npx tsx subir-summit-estaticos.ts        # DRY (mostra o plano, não escreve nada)
 *   npx tsx subir-summit-estaticos.ts --go   # cria de verdade
 *
 * Idempotente: pula par já registrado na Biblioteca (tag de hashes na observacao) e
 * pula ad cujo nome (TP) já existe no conjunto. Gentil com rate limit (sleep entre criações).
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { ilike, and, isNull } from "drizzle-orm";
import { metaGet, metaPostForm } from "./server/services/adsCreation/metaApi";
import { createCreative } from "./server/services/adsCreation/creativesRepo";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const PAGE_ID = process.env.META_DEFAULT_PAGE_ID!;
const IG_USER_ID = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID!;
const ADSET = "120252239374870450"; // 10 -  (QUENTE, PAUSED)

// ---- copy/link/cta PADRÃO (extraídos dos ads existentes da campanha) ----
const MESSAGE = `O maior evento da  creator economy do Espírito Santo!

Descubra os playbooks das marcas que mais investem em creators, conecte-se com criadores e marcas do mercado e faça parte do maior evento da creator economy do Espírito Santo.

03 de agosto · 2026
Brizz · Vitória/ES

Clique em ’Saiba Mais’ pra garantir seu ingresso!`;
const DESCRIPTION = "Anúncios sem cara de anúncio. Do roteiro ao vídeo editado, prontos pra escalar suas campanhas.";
const CTA_LINK = "https://pages.turbopartners.com.br/creators-summit-es/";
const URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";

const ADVANTAGE_PLUS_OPT_OUT = {
  creative_features_spec: {
    image_touchups: { enroll_status: "OPT_OUT" },
    image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
    image_uncrop: { enroll_status: "OPT_OUT" },
    text_optimizations: { enroll_status: "OPT_OUT" },
    inline_comment: { enroll_status: "OPT_OUT" },
    image_animation: { enroll_status: "OPT_OUT" },
  },
};

// =================== PARES (base, feed=4x5, stories=9x16) ===================
// Cada item vira 1 ad pareado. `feed`/`stories` = image_hash. Se faltar par, `null`.
interface Par { base: string; feed: string | null; stories: string | null; nota?: string }

const PARES: Par[] = [
  // ---- Palestrantes (pareia stories N com 4_5 N) ----
  { base: "palestrantes-1", feed: "0e9b916c746cf37190df8e1924f81a59", stories: "2583b93184d632f0a3c7ae96093dd959" },
  { base: "palestrantes-2", feed: null,                                 stories: "ddac035ebe8b5fe52fb41b00c58974a5", nota: "SEM feed 4_5 2 — stories órfã" },
  { base: "palestrantes-3", feed: "0678246f2d5ad126002f232f34afdb7a", stories: "ac28b814148a40e75b6b05d65a56a06d" },
  { base: "palestrantes-4", feed: "78ea54ddd862fa6f7bccc71c235d83ef", stories: "8480e552fd51bdf90ffde57957e8d8a1" },
  { base: "palestrantes-5", feed: "7995e51dc11e0bcebab71440b65d99e7", stories: "9231d4d670b672e047d6dc2686b4647c" },
  { base: "palestrantes-6", feed: "f81cdda4fb093efa24e0058010638c0d", stories: "8df32bacd7950775004631822774452e" },
  { base: "palestrantes-7", feed: "fd5417e0a49aba477d7708b459255199", stories: "ab4cbb97bf2833fe5bb4d7007b8c4bd4" },

  // ---- Lote numérico A (arquivos SEM "(1)") ----
  { base: "estatico-a-1", feed: "22c4e1311f920d12d4c68704aab237c4", stories: "8e8915a73ac40e6f2e62b663e9cc4a5d" },
  { base: "estatico-a-2", feed: "7a25afa5fbababc11b1f203f920df793", stories: "aeb4a55902812cc5228cf1f6b28b312a" },
  { base: "estatico-a-3", feed: "632585ffc19c19c58f7598b6e96ab8b6", stories: "8daf123b94f8f2d514c7968b824af9c2" },
  { base: "estatico-a-4", feed: "237c45bf3416ee1d7448f92e980d7501", stories: "07cd6043f5c2a44767517ac0aebb166b" },
  { base: "estatico-a-5", feed: "07912cd6f2e0204a7a33d9f879e9aff8", stories: "86e5f658bf028dbeeab1cd0c966eeda9" },

  // ---- Lote numérico B (arquivos COM "(1)"; #1 stories = "1 stories " c/ espaço) ----
  { base: "estatico-b-1", feed: "0125dca4efc138afc2551d1d92ab702e", stories: "735208a371ed308cc588215679a90cb2", nota: "stories = '1 stories ' (c/ espaço)" },
  { base: "estatico-b-2", feed: "23dcec61f276e7f37fb6e752c00b2166", stories: "bdfd7b0d6f735856c979a7f7dff30215" },
  { base: "estatico-b-3", feed: "5c15dad038d84cd024580e1841e4702e", stories: "a86da91b0dac18e1632a92e1783dd6bf" },
  { base: "estatico-b-4", feed: "980c4012a91204e27c20f33faf85e631", stories: "4c154e1448f9a3c68fed6512d5cb245b" },
  { base: "estatico-b-5", feed: "4dae7498ff0f77a069514596560ab9a3", stories: "78cd3431d027bc28f794919b190f6467" },
];

const go = process.argv.includes("--go");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function creativeParams(base: string, feed: string | null, stories: string | null) {
  // Imagem única (ex.: stories órfã): asset_feed_spec de 1 asset SEM regras é tratado como
  // "dynamic creative" pela Meta e quebra em conjunto normal. Usa object_story_spec.link_data.
  const single = feed && stories ? null : (stories ?? feed);
  if (single) {
    return {
      name: `Criativo: ${base}`,
      object_story_spec: {
        page_id: PAGE_ID,
        instagram_user_id: IG_USER_ID,
        link_data: {
          image_hash: single,
          link: CTA_LINK,
          message: MESSAGE,
          name: "",
          description: DESCRIPTION,
          call_to_action: { type: "LEARN_MORE", value: { link: CTA_LINK } },
        },
      },
      degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
      url_tags: URL_TAGS,
    };
  }

  // Pareado (4x5 feed + 9x16 stories): asset_feed_spec COM asset_customization_rules.
  const LBL_9 = `lbl_9x16_${base}`;
  const LBL_4 = `lbl_4x5_${base}`;
  const images = [
    { hash: stories, adlabels: [{ name: LBL_9 }] },
    { hash: feed, adlabels: [{ name: LBL_4 }] },
  ];
  const rules = [
    {
      customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] },
      image_label: { name: LBL_9 },
    },
    {
      customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed"], instagram_positions: ["stream"] },
      image_label: { name: LBL_4 },
    },
  ];
  return {
    name: `Criativo: ${base}`,
    object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID },
    asset_feed_spec: {
      images,
      bodies: [{ text: MESSAGE }],
      titles: [{ text: "" }],
      descriptions: [{ text: DESCRIPTION }],
      link_urls: [{ website_url: CTA_LINK }],
      call_to_action_types: ["LEARN_MORE"],
      ad_formats: ["SINGLE_IMAGE"],
      asset_customization_rules: rules,
    },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    url_tags: URL_TAGS,
  };
}

(async () => {
  // valida conjunto
  const set = await metaGet(ADSET, { fields: "id,name,configured_status,campaign{name}" });
  console.log(`Conjunto: ${set.id} | ${set.configured_status} | ${set.name}  (camp: ${set.campaign?.name})`);

  // ads já existentes no conjunto (idempotência)
  const adsExisting = await metaGet(`${ADSET}/ads`, { fields: "name", limit: "200" });
  const existingNames: string[] = (adsExisting.data ?? []).map((a: any) => a.name);

  console.log(`\nPlano: ${PARES.length} ads pareados (PAUSED), nome_final = TPxxxx - <base>:\n`);
  let n = 0;
  for (const p of PARES) {
    n++;
    const fmt = [p.stories ? "9x16" : null, p.feed ? "4x5" : null].filter(Boolean).join("+");
    const flag = p.nota ? `   ⚠️ ${p.nota}` : "";
    console.log(`  ${String(n).padStart(2)}. ${p.base.padEnd(16)} [${fmt}]  feed=${p.feed?.slice(0, 8) ?? "—"} stories=${p.stories?.slice(0, 8) ?? "—"}${flag}`);
  }

  console.log(`\nCopy: "${MESSAGE.slice(0, 60)}…"`);
  console.log(`Link: ${CTA_LINK}  ·  CTA: LEARN_MORE  ·  Descrição: "${DESCRIPTION.slice(0, 40)}…"`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria nada)"}`);
  if (!go) {
    console.log(`\n(DRY) Rode com --go pra criar (depois da sua aprovação).`);
    process.exit(0);
  }

  let done = 0;
  for (const p of PARES) {
    try {
      // 1) registra na Biblioteca (TP sequencial) com tag de hashes p/ idempotência
      const tag = `summit-estatico | 9x16=${p.stories ?? "-"} | 4x5=${p.feed ?? "-"}`;
      const já = await db
        .select({ tpId: creativesLibrary.tpId, nomeFinal: creativesLibrary.nomeFinal })
        .from(creativesLibrary)
        .where(and(isNull(creativesLibrary.deletedAt), ilike(creativesLibrary.observacao, `%9x16=${p.stories ?? "-"}%4x5=${p.feed ?? "-"}%`)))
        .limit(1);
      let nomeFinal: string;
      if (já.length) {
        nomeFinal = já[0].nomeFinal;
        console.log(`  ↻ Biblioteca já tem ${já[0].tpId} (${p.base})`);
      } else {
        const row = await createCreative({
          nomeDrive: p.base,
          tipoAd: "img",
          plataforma: "Meta",
          etapaFunil: "Quente",
          personagem: p.base.startsWith("palestrantes") ? "Palestrantes" : "Estatico",
          produto: "Creator Summit ES",
          observacao: tag,
          createdBy: process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br",
        });
        nomeFinal = row.nomeFinal;
        console.log(`  📚 Biblioteca: ${row.tpId} → ${nomeFinal}`);
      }

      // pula se ad já existe no conjunto
      const tp = nomeFinal.split(" - ")[0];
      if (existingNames.some((nm) => nm.startsWith(tp))) {
        console.log(`     ⏭  ad ${tp} já existe no conjunto — pulado`);
        done++;
        continue;
      }

      // 2) cria creative + ad PAUSED
      const cre = await metaPostForm(`${ACC}/adcreatives`, creativeParams(p.base, p.feed, p.stories));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await metaPostForm(`${ACC}/ads`, {
        name: nomeFinal,
        adset_id: ADSET,
        creative: { creative_id: cre.id },
        status: "PAUSED",
      });
      if (!ad.id) throw new Error("ad sem id");
      console.log(`     ✅ ad ${ad.id} (PAUSED) — ${nomeFinal}`);
      done++;
      await sleep(2500);
    } catch (e) {
      console.error(`  ⛔ parou em ${p.base}: ${e instanceof Error ? e.message : e}`);
      console.error(`     (${done} criado(s); re-rodar continua de onde parou)`);
      break;
    }
  }

  console.log(`\nResumo: ${done}/${PARES.length} processado(s).`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${ACC.replace("act_", "")}&selected_adset_ids=${ADSET}`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
