/**
 * Passo 3/3 — Cria a CAMPANHA CBO nova + 2 conjuntos + 6 ads do lote
 * "Captação Creators - Ismael/João".
 *   Campanha: CBO (orçamento na campanha), OUTCOME_LEADS, R$30/dia, PAUSED.
 *   Conjuntos: 1 Ismael (3 ads) + 1 João (3 ads). Config (targeting/otimização/pixel/attribution)
 *              clonada do conjunto-irmão CLONE_ADSET (Broad Creators). Tudo PAUSED.
 *   Ads: single-video 9x16. COPY/LINK/CTA/UTM vêm do data file (não são clonados do irmão).
 *
 * Match de vídeo ESTRITO pelo nome EXATO `${base}_9x16`. Biblioteca lida por driveFileId.
 * ⚠️ Conjuntos e ads NASCEM PAUSED — ligar é decisão manual do Caio no Gerenciador.
 * ⚠️ Requer COPY preenchida no creators-cbo.data.ts (o --go trava se estiver vazia).
 *
 *   npx tsx scripts/ads/subir-creators-cbo-ads.ts        # DRY (descobre + mostra plano, não cria)
 *   npx tsx scripts/ads/subir-creators-cbo-ads.ts --go   # cria campanha + conjuntos + ads
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { isNull, and, inArray } from "drizzle-orm";
import { metaGet, metaPostForm, getVideoThumbnail, MetaRateLimitError } from "../../server/services/adsCreation/metaApi";
import {
  GROUPS, ALL_ITEMS, metaTitle, resolveCopy,
  CAMP_NAME, OBJECTIVE, DAILY_BUDGET_CENTS, BID_STRATEGY, CLONE_ADSET,
  LINK, CTA, HEADLINE, URL_TAGS,
} from "./creators-cbo.data";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const DEFAULT_PAGE = process.env.META_DEFAULT_PAGE_ID || "111691498031338";
const DEFAULT_IG = process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID || "17841423555147969";

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
const norm = (s: string) => (s ?? "").trim().toLowerCase().replace(/\.[^.]+$/, "");
const nnOf = (name: string) => { const m = /^\s*\[?(\d{1,4})\]?\s*-/.exec(name ?? ""); return m ? parseInt(m[1], 10) : 0; };
function isRL(e: unknown) { return e instanceof MetaRateLimitError || /too many|rate limit|code=17|code=80004|code=80014/i.test(e instanceof Error ? e.message : String(e)); }
async function bk<T>(label: string, fn: () => Promise<T>, max = 12): Promise<T> {
  for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= max || !isRL(e)) throw e; console.log(`   ⏳ rate-limit ${label} — 5min (${i + 1}/${max})`); await sleep(5 * 60_000); } }
}

// Meta exige `explore` junto de `explore_home`. Garante o par no targeting clonado.
function fixTargeting(t: any) {
  if (!t) return t;
  const ig: string[] | undefined = Array.isArray(t.instagram_positions) ? [...t.instagram_positions] : undefined;
  if (ig && ig.includes("explore_home") && !ig.includes("explore")) ig.push("explore");
  return { ...t, ...(ig ? { instagram_positions: ig } : {}) };
}

// Criativo single-video 9x16 CLÁSSICO (object_story_spec.video_data) — mesmo padrão da produção.
function singleVideoCreativeParams(nomeFinal: string, videoId: string, thumbUrl: string | null, copy: string) {
  const videoData: Record<string, any> = {
    video_id: videoId,
    message: copy,
    call_to_action: { type: CTA, value: { link: LINK } },
  };
  if (HEADLINE.trim()) videoData.title = HEADLINE;
  if (thumbUrl) videoData.image_url = thumbUrl;
  return {
    name: `Criativo: ${nomeFinal}`,
    object_story_spec: { page_id: DEFAULT_PAGE, instagram_user_id: DEFAULT_IG, video_data: videoData },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    ...(URL_TAGS ? { url_tags: URL_TAGS } : {}),
  };
}

(async () => {
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");

  // 1) Biblioteca dos 6 criativos, indexada por driveFileId
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    inArray(creativesLibrary.driveFileId, ALL_ITEMS.map((it) => it.driveId)),
  ));
  const byDrive = new Map(rows.map((r) => [r.driveFileId!, r]));

  // 2) títulos-alvo no Gerenciador (`${base}_9x16`) → índice por nome EXATO, com early-exit
  const want = new Set<string>();
  for (const it of ALL_ITEMS) want.add(norm(metaTitle(it.base)));
  const byName = new Map<string, string[]>();
  const foundTargets = new Set<string>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  let pages = 0;
  for (; url && pages < 40; pages++) {
    const res: any = await bk("GET advideos", () => metaGet(url!, params));
    for (const v of res.data ?? []) {
      const k = norm(v.title ?? ""); if (!k) continue;
      if (want.has(k)) { (byName.get(k) ?? byName.set(k, []).get(k)!).push(v.id); foundTargets.add(k); }
    }
    if (foundTargets.size >= want.size) { pages++; break; }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }
  const pick = (ids: string[]) => [...ids].sort()[0];
  console.log(`(advideos: ${pages} página(s) · alvos achados ${foundTargets.size}/${want.size})`);

  // 3) config do adset irmão (targeting/otimização/pixel/attribution/destino) — SEM budget (CBO manda na campanha)
  const cfg = await bk("GET config clone", () =>
    metaGet(CLONE_ADSET, { fields: "optimization_goal,billing_event,promoted_object,attribution_spec,targeting,destination_type" }),
  );

  // 4) campanha CBO — acha por nome EXATO (idempotência) ou cria
  const campsRes = await bk("GET campaigns", () => metaGet(`${ACC}/campaigns`, { fields: "id,name,daily_budget", limit: "500" }));
  const existingCamp = (campsRes.data ?? []).find((c: { name: string }) => c.name === CAMP_NAME);
  let campId: string | null = existingCamp?.id ?? null;

  // 5) conjuntos existentes na campanha (se ela já existe) → NN + dedup por matchToken
  let existingSets: { id: string; name: string }[] = [];
  if (campId) {
    const existing = await bk("GET adsets camp", () => metaGet(`${campId}/adsets`, { fields: "id,name", limit: "400" }));
    existingSets = existing.data ?? [];
  }
  let maxNn = Math.max(0, ...existingSets.map((s) => nnOf(s.name)));

  // 6) monta plano por grupo
  type Ad = { order: number; tpId: string; nomeFinal: string; videoId: string };
  interface Plan { key: string; persona: string; conjName: string; conjId: string | null; copy: string; ads: Ad[]; warns: string[] }
  const plans: Plan[] = [];
  for (const g of GROUPS) {
    const ads: Ad[] = [];
    const warns: string[] = [];
    for (const it of g.items) {
      const r = byDrive.get(it.driveId);
      if (!r) { warns.push(`${it.base}: sem linha na Biblioteca (drive ${it.driveId.slice(0, 8)}…)`); continue; }
      const cands = byName.get(norm(metaTitle(it.base))) ?? [];
      if (!cands.length) { warns.push(`${r.tpId} (${it.base}): vídeo ${metaTitle(it.base)} não achado no Gerenciador`); continue; }
      if (cands.length > 1) warns.push(`${r.tpId}: duplicata de vídeo x${cands.length}`);
      ads.push({ order: it.order, tpId: r.tpId, nomeFinal: r.nomeFinal, videoId: pick(cands) });
    }
    ads.sort((a, b) => a.order - b.order);

    const found = existingSets.find((s) => (s.name ?? "").includes(g.matchToken));
    let conjName: string, conjId: string | null;
    if (found) { conjName = found.name; conjId = found.id; }
    else { maxNn += 1; conjName = g.conjName(maxNn); conjId = null; }
    plans.push({ key: g.key, persona: g.persona, conjName, conjId, copy: resolveCopy(g.persona), ads, warns });
  }

  const brl = (c: number) => `R$${(c / 100).toFixed(2)}/dia`;
  console.log(`\nCampanha CBO ${campId ? "↩︎ já existe " + campId : "NOVA"} — "${CAMP_NAME}"`);
  console.log(`  obj=${OBJECTIVE} · ${brl(DAILY_BUDGET_CENTS)} (CBO) · bid=${BID_STRATEGY}`);
  console.log(`Config clonada do irmão ${CLONE_ADSET}: opt=${cfg.optimization_goal} · billing=${cfg.billing_event} · dest=${cfg.destination_type ?? "—"} · pixel=${cfg.promoted_object?.pixel_id ?? "—"}/${cfg.promoted_object?.custom_event_type ?? "—"}`);
  console.log(`Link: ${LINK}  ·  CTA: ${CTA}  ·  UTM: ${URL_TAGS ? "sim" : "—"}  ·  page ${DEFAULT_PAGE} / ig ${DEFAULT_IG}`);
  for (const pl of plans) {
    const cstat = pl.copy.trim() ? `${pl.copy.length} chars` : "⚠️ VAZIA";
    console.log(`\n• ${pl.conjId ? "↩︎ existe " + pl.conjId : "NOVO"} — ${pl.conjName}`);
    console.log(`    copy [${pl.persona}]: ${cstat}${pl.copy.trim() ? ` — "${pl.copy.slice(0, 80).replace(/\n/g, " ")}…"` : ""}`);
    for (const a of pl.ads) console.log(`    ${a.nomeFinal}  [video ${a.videoId}]`);
    if (pl.warns.length) console.log(`    ⚠️  ${pl.warns.join(" | ")}`);
  }
  const totalAds = plans.reduce((s, pl) => s + pl.ads.length, 0);
  console.log(`\nTotal: ${plans.length} conjuntos · ${totalAds} ads single-video · modo: ${go ? "🔴 CRIAR" : "DRY (não cria)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra criar."); process.exit(0); }

  // ── guardas antes de criar ──
  const semCopy = plans.filter((pl) => !pl.copy.trim()).map((pl) => pl.persona);
  if (semCopy.length) throw new Error(`copy vazia p/ ${semCopy.join(", ")} — preencha COPY (ou COPY_${semCopy[0].toUpperCase()}) no creators-cbo.data.ts`);
  if (!LINK) throw new Error("LINK vazio no data file");
  if (totalAds !== ALL_ITEMS.length) throw new Error(`esperava ${ALL_ITEMS.length} ads, montei ${totalAds} — revisar match (rode upload/planilha antes)`);

  // 7a) cria a campanha CBO se ainda não existe (PAUSED, budget na campanha)
  if (!campId) {
    const camp = await bk("create campaign", () =>
      metaPostForm(`${ACC}/campaigns`, {
        name: CAMP_NAME,
        objective: OBJECTIVE,
        status: "PAUSED",
        special_ad_categories: [],
        buying_type: "AUCTION",
        daily_budget: DAILY_BUDGET_CENTS,
        bid_strategy: BID_STRATEGY,
      }),
    );
    if (!camp.id) throw new Error("campanha criada sem id");
    campId = camp.id;
    console.log(`\n✅ campanha CBO criada: ${campId} — ${CAMP_NAME} (PAUSED · ${brl(DAILY_BUDGET_CENTS)})`);
  } else {
    console.log(`\n↩︎ campanha já existe: ${campId}`);
  }

  // 7b) cria conjuntos + ads (tudo PAUSED)
  let createdAds = 0, createdSets = 0;
  for (const pl of plans) {
    let adsetId = pl.conjId;
    if (!adsetId) {
      const created = await bk(`create conj ${pl.key}`, () =>
        metaPostForm(`${ACC}/adsets`, {
          name: pl.conjName, campaign_id: campId!,
          optimization_goal: cfg.optimization_goal, billing_event: cfg.billing_event,
          promoted_object: cfg.promoted_object, attribution_spec: cfg.attribution_spec, targeting: fixTargeting(cfg.targeting),
          ...(cfg.destination_type && cfg.destination_type !== "UNDEFINED" ? { destination_type: cfg.destination_type } : {}),
          status: "PAUSED",
        }),
      );
      if (!created.id) throw new Error(`conjunto "${pl.conjName}" sem id`);
      adsetId = created.id; createdSets++;
      console.log(`\n✅ conjunto criado: ${adsetId} — ${pl.conjName}`);
    } else {
      console.log(`\n↩︎ conjunto já existe: ${adsetId} — ${pl.conjName}`);
    }

    const adsNow = await bk(`GET ads ${adsetId}`, () => metaGet(`${adsetId}/ads`, { fields: "name", limit: "200" }));
    const names: string[] = (adsNow.data ?? []).map((a: { name: string }) => a.name);
    for (const a of pl.ads) {
      if (names.some((n) => n.startsWith(`${a.tpId} `) || n === a.nomeFinal)) { console.log(`  ↩︎ ${a.tpId} já existe`); continue; }
      let thumbUrl: string | null = null;
      try { thumbUrl = await bk(`thumb ${a.tpId}`, () => getVideoThumbnail(a.videoId)); } catch { thumbUrl = null; }
      const cre = await bk(`creative ${a.tpId}`, () => metaPostForm(`${ACC}/adcreatives`, singleVideoCreativeParams(a.nomeFinal, a.videoId, thumbUrl, pl.copy)));
      if (!cre.id) throw new Error("creative sem id");
      const ad = await bk(`ad ${a.tpId}`, () => metaPostForm(`${ACC}/ads`, { name: a.nomeFinal, adset_id: adsetId, creative: { creative_id: cre.id }, status: "PAUSED" }));
      if (!ad.id) throw new Error("ad sem id");
      console.log(`  ✅ ${a.tpId} → ad ${ad.id} (PAUSED, single 9x16)`);
      createdAds++;
      await sleep(8000);
    }
  }

  console.log(`\nResumo: ${createdSets} conjunto(s) + ${createdAds} ad(s) criado(s) nesse run (tudo PAUSED).`);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${campId}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
