/**
 * Sobe o lote CRM Recompra **b2c2** (h1–h9 = TP1657–TP1665) na camp CBO FLASH CRM,
 * no padrão Turbo: 5 ads/conjunto, split por hook, pareados 9x16+4x5, PAUSED.
 *
 * Auto-descobre os video_id no Gerenciador (por título), mapeia hook→TP pela Biblioteca,
 * e calcula o próximo NN a partir dos conjuntos da campanha (deve dar 157/158).
 * Idempotente + backoff de rate-limit (quota dev-tier saturada).
 *
 *   npx tsx subir-crm-b2c2.ts        # DRY (descobre e mostra o plano; não escreve)
 *   npx tsx subir-crm-b2c2.ts --go   # cria
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { ilike, and, isNull } from "drizzle-orm";
import { metaGet, metaPostForm, MetaRateLimitError } from "./server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120252008224000450";
const CLONE_FROM = "120252008223980450"; // conjunto 151 (config de referência)
const PAGE_ID = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const IG_USER_ID = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

const BODY = 2;
const CTA = 2;
const TEMA = "CRM Recompra";
const PERSONA = "Lucas";

// ─── conteúdo do anúncio (igual ao resto do lote CRM) ───
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
const pad2 = (n: number) => String(n).padStart(2, "0");

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

const nnOf = (name: string): number => {
  const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? "");
  return m ? parseInt(m[1], 10) : 0;
};

(async () => {
  const reHook = new RegExp(`h(\\d+)b${BODY}c${CTA}_(9x16|4x5)`, "i");

  // 1) descobre vídeos b{BODY}c{CTA} no Gerenciador
  const vids = await withBackoff("GET advideos", () => metaGet(`${ACC}/advideos`, { fields: "id,title", limit: "300" }));
  const byHook = new Map<number, { v9?: string; v45?: string }>();
  for (const v of vids.data ?? []) {
    const t = v.title ?? "";
    if (!/recompra/i.test(t)) continue;
    const m = reHook.exec(t);
    if (!m) continue;
    const hook = parseInt(m[1], 10);
    const fmt = m[2].toLowerCase();
    const cur = byHook.get(hook) ?? {};
    if (fmt === "9x16") cur.v9 = v.id;
    else cur.v45 = v.id;
    byHook.set(hook, cur);
  }

  // 2) Biblioteca: linhas b{BODY}c{CTA} do CRM (hook→TP/nomeFinal)
  const rows = await db
    .select()
    .from(creativesLibrary)
    .where(and(ilike(creativesLibrary.nomeFinal, `%b${BODY}c${CTA}%`), ilike(creativesLibrary.nomeFinal, `%Recompra%`), isNull(creativesLibrary.deletedAt)));
  const tpByHook = new Map<number, { tpId: string; nomeFinal: string }>();
  for (const r of rows) {
    const m = new RegExp(`h(\\d+)b${BODY}c${CTA}`, "i").exec(r.nomeFinal);
    if (m) tpByHook.set(parseInt(m[1], 10), { tpId: r.tpId, nomeFinal: r.nomeFinal });
  }

  // 3) cruza: hooks com vídeo (9x16+4x5) E TP na Biblioteca
  const hooks = [...byHook.keys()].sort((a, b) => a - b);
  const ready: { hook: number; tpId: string; nomeFinal: string; v9: string; v45: string }[] = [];
  const warns: string[] = [];
  for (const h of hooks) {
    const vid = byHook.get(h)!;
    const tp = tpByHook.get(h);
    if (!vid.v9 || !vid.v45) { warns.push(`h${h}: falta ${!vid.v9 ? "9x16" : "4x5"} no Meta`); continue; }
    if (!tp) { warns.push(`h${h}: sem TP na Biblioteca`); continue; }
    ready.push({ hook: h, tpId: tp.tpId, nomeFinal: tp.nomeFinal, v9: vid.v9, v45: vid.v45 });
  }

  // 4) conjuntos: split h≤5 / h≥6, NN corrido da campanha
  const existing = await withBackoff("GET adsets camp", () => metaGet(`${CAMP}/adsets`, { fields: "id,name", limit: "200" }));
  const existingSets: { id: string; name: string }[] = existing.data ?? [];
  const baseNN = Math.max(0, ...existingSets.map((s) => nnOf(s.name)));

  const g1 = ready.filter((r) => r.hook <= 5);
  const g2 = ready.filter((r) => r.hook >= 6);
  const mkName = (nn: number, grp: typeof ready) =>
    `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - h${pad2(Math.min(...grp.map((x) => x.hook)))} a h${pad2(Math.max(...grp.map((x) => x.hook)))} | b${BODY} | c${CTA}`;
  const conjuntos = [g1, g2].filter((g) => g.length).map((g, i) => ({ name: mkName(baseNN + 1 + i, g), ads: g }));

  console.log(`Campanha CBO ${CAMP}  ·  b${BODY}c${CTA}  ·  próximo NN: ${baseNN + 1}`);
  for (const c of conjuntos) {
    console.log(`\n• ${c.name}`);
    for (const a of c.ads) console.log(`    ${a.nomeFinal}  [9x16 ${a.v9} | 4x5 ${a.v45}]`);
  }
  if (warns.length) console.log(`\n⚠️  ${warns.join(" | ")}`);
  console.log(`\nmodo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) {
    console.log("(DRY) Rode com --go pra criar.");
    process.exit(0);
  }
  if (!conjuntos.length) throw new Error("nada pronto pra subir (sem vídeo+TP cruzados)");

  // config de clone
  const cfg = await withBackoff("GET config 151", () =>
    metaGet(CLONE_FROM, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting" }),
  );

  let totalAds = 0;
  for (const conj of conjuntos) {
    let adsetId = existingSets.find((s) => s.name === conj.name)?.id ?? null;
    if (!adsetId) {
      const created = await withBackoff(`create conj`, () =>
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

    const adsNow = await withBackoff(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);

    for (const a of conj.ads) {
      if (names.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal)) {
        console.log(`  ↩︎ ${a.tpId} já existe no conjunto`);
        continue;
      }
      const cre = await withBackoff(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, pairedCreativeParams(a.tpId, a.nomeFinal, a.v9, a.v45)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await withBackoff(`ad ${a.tpId}`, () =>
        metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }),
      );
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, 9x16+4x5)`);
      totalAds++;
      await sleep(8000);
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
