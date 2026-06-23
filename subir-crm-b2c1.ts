/**
 * Sobe o lote CRM Recompra **b2c1** (h1–h9 = TP1648–TP1656) na camp CBO FLASH CRM,
 * no padrão Turbo: 5 ads/conjunto, split por hook, pareados 9x16+4x5, PAUSED.
 *
 *   Conjunto 153 = "… - CRM Recompra - h01 a h05 | b2 | c1"  → TP1648–1652 (h1–h5)
 *   Conjunto 154 = "… - CRM Recompra - h06 a h09 | b2 | c1"  → TP1653–1656 (h6–h9)
 *
 * Config clonada do conjunto 151 (120252008223980450). Idempotente (reusa conjunto pelo
 * nome, pula ad que já existe) + backoff de rate-limit (quota dev-tier saturada).
 *
 *   npx tsx subir-crm-b2c1.ts        # DRY
 *   npx tsx subir-crm-b2c1.ts --go   # cria
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120252008224000450";
const CLONE_FROM = "120252008223980450"; // conjunto 151 (config de referência)
const PAGE_ID = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const IG_USER_ID = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

const VIDEOS: Record<string, { v9: string; v45: string }> = {
  TP1648: { v9: "2435810223594452", v45: "1666469171292747" }, // h1
  TP1649: { v9: "1042123382091971", v45: "1259279899510941" }, // h2
  TP1650: { v9: "1026898743125866", v45: "951202354619204" }, // h3
  TP1651: { v9: "1727469058253369", v45: "1325287509180141" }, // h4
  TP1652: { v9: "1025002203552751", v45: "1519002623010081" }, // h5
  TP1653: { v9: "1307836961555502", v45: "1525532889023500" }, // h6
  TP1654: { v9: "984185727856987", v45: "3235704246601762" }, // h7
  TP1655: { v9: "1312741924300799", v45: "2221659478584314" }, // h8
  TP1656: { v9: "1538390934645017", v45: "1588602429522672" }, // h9
};

const CONJUNTOS = [
  { name: "153 - [IG] [Aberto] [Stories & Feed & Reels] [Lucas] - CRM Recompra - h01 a h05 | b2 | c1", tps: ["TP1648", "TP1649", "TP1650", "TP1651", "TP1652"] },
  { name: "154 - [IG] [Aberto] [Stories & Feed & Reels] [Lucas] - CRM Recompra - h06 a h09 | b2 | c1", tps: ["TP1653", "TP1654", "TP1655", "TP1656"] },
];

// ─── conteúdo do anúncio (igual aos outros do lote CRM) ───
const URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";
const CTA_LINK = "https://turbopartners.com.br/"; // placeholder pendente
const CTA_TYPE = "LEARN_MORE";
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

function isRateLimit(e: unknown): boolean {
  if (e instanceof MetaRateLimitError) return true;
  const m = e instanceof Error ? e.message : String(e);
  return /too many|rate limit|code=17|code=80004|code=80014|#17\b/i.test(m);
}
async function withBackoff<T>(label: string, fn: () => Promise<T>, max = 12): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= max || !isRateLimit(e)) throw e;
      console.log(`   ⏳ rate-limit em ${label} — espera 5min (${i + 1}/${max})`);
      await sleep(5 * 60_000);
    }
  }
}

function pairedCreativeParams(tpId: string, nomeFinal: string, v9: string, v45: string) {
  const LBL_9 = `lbl_9x16_${tpId}`;
  const LBL_4 = `lbl_4x5_${tpId}`;
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID },
    asset_feed_spec: {
      bodies: [{ text: MESSAGE }],
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

(async () => {
  const allTps = CONJUNTOS.flatMap((c) => c.tps);
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, allTps));
  const byTp = new Map(rows.map((r) => [r.tpId, r]));
  for (const tp of allTps) if (!byTp.has(tp)) throw new Error(`${tp} não está na Biblioteca`);

  console.log(`Campanha CBO ${CAMP}`);
  for (const c of CONJUNTOS) {
    console.log(`\n• ${c.name}`);
    for (const tp of c.tps) console.log(`    ${byTp.get(tp)!.nomeFinal}  [9x16 ${VIDEOS[tp].v9} | 4x5 ${VIDEOS[tp].v45}]`);
  }
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) {
    console.log("(DRY) Rode com --go pra criar.");
    process.exit(0);
  }

  // config de clone (1 GET)
  const cfg = await withBackoff("GET config 151", () =>
    metaGet(CLONE_FROM, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting" }),
  );
  // conjuntos existentes na campanha (idempotência)
  const existing = await withBackoff("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "200" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];

  let totalAds = 0;
  for (const conj of CONJUNTOS) {
    // acha ou cria o conjunto
    let adsetId = existingSets.find((s) => s.name === conj.name)?.id ?? null;
    if (!adsetId) {
      const created = await withBackoff(`create "${conj.name.slice(0, 6)}"`, () =>
        metaPostForm(`${ACC}/adsets`, {
          name: conj.name,
          campaign_id: CAMP,
          optimization_goal: cfg.optimization_goal,
          billing_event: cfg.billing_event,
          promoted_object: cfg.promoted_object,
          attribution_spec: cfg.attribution_spec,
          targeting: cfg.targeting,
          status: "PAUSED",
        }),
      );
      if (!created.id) throw new Error(`conjunto "${conj.name}" sem id`);
      adsetId = created.id;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${conj.name}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${conj.name}`);
    }

    // ads já existentes nesse conjunto
    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);

    for (const tp of conj.tps) {
      const nomeFinal = byTp.get(tp)!.nomeFinal;
      if (names.some((n) => n.startsWith(`${tp} `) || n === nomeFinal)) {
        console.log(`  ↩︎ ${tp} já existe no conjunto`);
        continue;
      }
      try {
        const cre = await withBackoff(`creative ${tp}`, () => metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(tp, nomeFinal, VIDEOS[tp].v9, VIDEOS[tp].v45)));
        if (!cre.id) throw new Error("creative sem id");
        const ad = await withBackoff(`ad ${tp}`, () =>
          metaPostForm(`${ACC}/ads`, { name: nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }),
        );
        if (!ad.id) throw new Error("ad sem id");
        console.log(`  ✅ ${tp} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
        totalAds++;
        await sleep(8000);
      } catch (e) {
        console.error(`  ⛔ parou em ${tp}: ${e instanceof Error ? e.message : e}`);
        console.error(`     (re-rodar continua de onde parou)`);
        process.exit(1);
      }
    }
  }

  console.log(`\nResumo: ${totalAds} ad(s) criado(s) nesse run.`);
  console.log(
    "Gerenciador:",
    `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`,
  );
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
