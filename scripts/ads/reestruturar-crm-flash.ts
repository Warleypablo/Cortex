/**
 * Reestrutura o lote CRM Recompra b1c1 na camp CBO FLASH CRM pro padrão Turbo:
 * 5 ads por conjunto, split por hook (h01–h05 / h06–h09), nomenclatura da ABO Creators teste.
 *
 *   Conjunto 1 = reaproveita o pré-setado, renomeado p/ "151 - … h01 a h05 | b1 | c1"
 *                (mantém TP1630–1634 que já estão lá)
 *   Conjunto 2 = novo "152 - … h06 a h09 | b1 | c1" (clona config do pré-setado, PAUSED)
 *                recebe TP1635–1638 (recriados aqui e deletados do conjunto 1)
 *
 * A API da Meta não move ad entre conjuntos → recria no destino e deleta da origem
 * (cria ANTES de deletar, pra nunca ficar sem o ad). Idempotente + backoff de rate-limit.
 *
 *   npx tsx reestruturar-crm-flash.ts        # DRY (mostra o plano, não escreve)
 *   npx tsx reestruturar-crm-flash.ts --go   # executa
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120252008224000450";
const ADSET1 = "120252008223980450"; // pré-setado → vira conjunto 151 (h01–h05)
const PAGE_ID = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const IG_USER_ID = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

const NAME1 = "151 - [IG] [Aberto] [Stories & Feed & Reels] [Lucas] - CRM Recompra - h01 a h05 | b1 | c1";
const NAME2 = "152 - [IG] [Aberto] [Stories & Feed & Reels] [Lucas] - CRM Recompra - h06 a h09 | b1 | c1";

// h6–h9 (vão pro conjunto 2)
const VIDEOS_H6_9: Record<string, { v9: string; v45: string }> = {
  TP1635: { v9: "1036872112232179", v45: "1315458376907019" }, // h6
  TP1636: { v9: "886275941181007", v45: "1927776761226484" }, // h7
  TP1637: { v9: "1421378906461834", v45: "1002261789265052" }, // h8
  TP1638: { v9: "1093122969977598", v45: "1566242568173543" }, // h9
};
const TPS_H6_9 = Object.keys(VIDEOS_H6_9);

// ─── conteúdo do anúncio (igual ao subir-crm-flash.ts) ───
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
async function withBackoff<T>(label: string, fn: () => Promise<T>, max = 8): Promise<T> {
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
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, TPS_H6_9));
  const byTp = new Map(rows.map((r) => [r.tpId, r]));
  const ADS2 = TPS_H6_9.map((tp) => {
    const r = byTp.get(tp);
    if (!r) throw new Error(`${tp} não está na Biblioteca`);
    return { tpId: tp, nomeFinal: r.nomeFinal, ...VIDEOS_H6_9[tp] };
  });

  console.log(`Campanha CBO ${CAMP}`);
  console.log(`Conjunto 1 (reusa ${ADSET1}) → "${NAME1}"  [mantém h1–h5]`);
  console.log(`Conjunto 2 (novo)            → "${NAME2}"  [recebe h6–h9]`);
  for (const a of ADS2) console.log(`   • ${a.nomeFinal}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  console.log(`\nmodo: ${go ? "🔴 EXECUTAR" : "DRY (não escreve)"}`);
  if (!go) {
    console.log("(DRY) Rode com --go pra executar.");
    process.exit(0);
  }

  // 1) config do pré-setado (clone) + ads atuais
  const cfg = await withBackoff("GET config conjunto1", () =>
    metaGet(ADSET1, { fields: "name,optimization_goal,billing_event,promoted_object,attribution_spec,targeting" }),
  );
  const adsNow = await withBackoff("GET ads conjunto1", () => metaGet(`${ADSET1}/ads`, { fields: "id,name", limit: "200" }));
  const adsList: { id: string; name: string }[] = adsNow.data ?? [];

  // 2) renomeia conjunto 1 (se preciso)
  if (cfg.name !== NAME1) {
    await withBackoff("rename conjunto1", () => metaPostForm(ADSET1, { name: NAME1 }));
    console.log(`✅ conjunto 1 renomeado → "${NAME1}"`);
  } else {
    console.log(`↩︎ conjunto 1 já está com o nome certo`);
  }

  // 3) acha/cria conjunto 2
  const existingSets = await withBackoff("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "200" }));
  let adset2: string | null = (existingSets.data ?? []).find((s: { name: string }) => s.name === NAME2)?.id ?? null;
  if (!adset2) {
    const created = await withBackoff("create conjunto2", () =>
      metaPostForm(`${ACC}/adsets`, {
        name: NAME2,
        campaign_id: CAMP,
        optimization_goal: cfg.optimization_goal,
        billing_event: cfg.billing_event,
        promoted_object: cfg.promoted_object,
        attribution_spec: cfg.attribution_spec,
        targeting: cfg.targeting,
        status: "PAUSED",
      }),
    );
    if (!created.id) throw new Error("conjunto 2 sem id");
    adset2 = created.id;
    console.log(`✅ conjunto 2 criado: ${adset2} (PAUSED, CBO)`);
  } else {
    console.log(`↩︎ conjunto 2 já existe: ${adset2}`);
  }

  // ads já no conjunto 2 (idempotência)
  const ads2Now = await withBackoff("GET ads conjunto2", () => metaGet(`${adset2}/ads`, { fields: "name", limit: "200" }));
  const names2: string[] = (ads2Now.data ?? []).map((a: { name: string }) => a.name);

  // 4) p/ cada h6–h9: cria no conjunto 2 (se falta) e deleta do conjunto 1 (se ainda lá)
  let created = 0;
  let deleted = 0;
  for (const a of ADS2) {
    try {
      const jaNo2 = names2.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal);
      if (!jaNo2) {
        const cre = await withBackoff(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45)));
        if (!cre.id) throw new Error("creative sem id");
        const ad = await withBackoff(`ad ${a.tpId}`, () =>
          metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adset2, creative: { creative_id: cre.id }, status: "PAUSED" }),
        );
        if (!ad.id) throw new Error("ad sem id");
        console.log(`  ✅ ${a.tpId} criado no conjunto 2 → ad ${ad.id}`);
        created++;
        await sleep(8000);
      } else {
        console.log(`  ↩︎ ${a.tpId} já está no conjunto 2`);
      }

      // deleta do conjunto 1 (origem)
      const old = adsList.find((x) => x.name.startsWith(`${a.tpId} `) || x.name === a.nomeFinal);
      if (old) {
        await withBackoff(`delete ${a.tpId}@conj1`, () => metaDelete(old.id));
        console.log(`  🗑️  ${a.tpId} removido do conjunto 1 (ad ${old.id})`);
        deleted++;
        await sleep(3000);
      }
    } catch (e) {
      console.error(`  ⛔ parou em ${a.tpId}: ${e instanceof Error ? e.message : e}`);
      console.error(`     (re-rodar continua de onde parou)`);
      break;
    }
  }

  console.log(`\nResumo: ${created} criado(s) no conjunto 2 · ${deleted} removido(s) do conjunto 1.`);
  console.log(
    "Gerenciador:",
    `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`,
  );
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});

// DELETE via Graph (metaApi não expõe DELETE) — usa fetch direto.
async function metaDelete(id: string): Promise<any> {
  const { getMetaAdsCredentials } = await import("../../server/autoreport/credentials");
  const token = getMetaAdsCredentials().accessToken;
  const res = await fetch(`https://graph.facebook.com/v18.0/${id}?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error || {};
    const e = new Error(`DELETE ${id} ${res.status} (code=${err.code ?? "?"}): ${err.error_user_msg || err.message || res.statusText}`);
    throw e;
  }
  return data;
}
