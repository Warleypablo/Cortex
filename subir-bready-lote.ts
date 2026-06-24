/**
 * Sobe um lote Bready (b{N} c1) na campanha Creators ABO teste da Turbo.
 * Parametrizado: BODY=b2 (ou b3). Duplica config do conjunto 141, 9x16, PAUSED, R$20/dia.
 * Descobre o próximo NN sozinho e trava se o conjunto-alvo já existir. Resumável (/tmp/bready-{body}-state.json).
 *
 * Uso: BODY=b2 npx tsx subir-bready-lote.ts
 */
import "dotenv/config";
import fs from "fs";
import { metaGet, metaPostForm, metaUploadVideo, pollVideoUntilReady, getVideoThumbnail } from "./server/services/adsCreation/metaApi";
import { downloadDriveFile } from "./server/services/adsCreation/driveLoader";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { and, eq, isNull, ilike } from "drizzle-orm";

const BODY = (process.env.BODY || "b2").toLowerCase();         // "b2" | "b3"
const BNUM = parseInt(BODY.replace(/\D/g, ""), 10);
const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const CAMP = "120215204345090450";
const TEMPLATE_ADSET = "120250801263010450";                   // 141
const PAGE_ID = "111691498031338";
const IG_USER_ID = "17841423555147969";
const DAILY_BUDGET = "2000";                                   // R$20/dia
const STATE_FILE = `/tmp/bready-${BODY}-state.json`;

const MESSAGE = "A Turbo entrega os anúncios UGCs que a sua marca precisa para gerar mais resultados no social media";
const DESCRIPTION = "Anúncios sem cara de anúncio. Do roteiro ao vídeo editado, prontos pra escalar suas campanhas.";
const CTA_TYPE = "LEARN_MORE";
const CTA_LINK = "https://pages.turbopartners.com.br/creators/";
const TURBO_URL_TAGS = "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}";

const ADVANTAGE_PLUS_OPT_OUT = { creative_features_spec: {
  image_touchups: { enroll_status: "OPT_OUT" }, image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
  image_uncrop: { enroll_status: "OPT_OUT" }, text_optimizations: { enroll_status: "OPT_OUT" },
  inline_comment: { enroll_status: "OPT_OUT" }, audio: { enroll_status: "OPT_OUT" }, image_animation: { enroll_status: "OPT_OUT" },
} };

type State = { adsets: Record<string, string>; videos: Record<string, { videoId: string; thumbUrl: string | null }>; ads: Record<string, { creativeId: string; adId: string }>; };
const loadState = (): State => { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { adsets: {}, videos: {}, ads: {} }; } };
const saveState = (s: State) => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad2 = (n: number) => String(n).padStart(2, "0");

(async () => {
  const state = loadState();

  // ---- criativos do lote na biblioteca ----
  const rows = await db.select().from(creativesLibrary).where(and(
    isNull(creativesLibrary.deletedAt),
    eq(creativesLibrary.produto, "Bready"),
    eq(creativesLibrary.personagem, "Esther"),
    ilike(creativesLibrary.nomeDrive, `%b${BNUM}c1%`),
  ));
  const items = rows.map((r) => ({
    tpId: r.tpId, nomeDrive: r.nomeDrive, nomeFinal: r.nomeFinal, fileId: r.driveFileId!,
    hook: parseInt(String(r.nomeDrive).match(/_h(\d+)b/i)?.[1] ?? "0", 10),
  })).sort((a, b) => a.hook - b.hook);
  if (items.length === 0) throw new Error(`nenhum criativo Bready ${BODY} na biblioteca`);
  console.log(`lote ${BODY}: ${items.length} criativos →`, items.map((i) => `${i.tpId}(h${i.hook})`).join(" "));

  // ---- split: primeiros 5 hooks → conjunto A, resto → B ----
  const groupA = items.filter((i) => i.hook <= 5);
  const groupB = items.filter((i) => i.hook > 5);
  const groups = [groupA, groupB].filter((g) => g.length > 0);

  // ---- descobre próximo NN na campanha ----
  const adsetsResp: any = await metaGet(`${CAMP}/adsets`, { fields: "name", limit: "300" });
  let maxNN = 0;
  for (const s of adsetsResp.data || []) { const m = String(s.name).match(/^\s*\[?(\d+)\]?\s*-/); if (m) maxNN = Math.max(maxNN, parseInt(m[1], 10)); }
  const existingNames = new Set((adsetsResp.data || []).map((s: any) => s.name));

  const groupMeta = groups.map((g, idx) => {
    const nn = maxNN + 1 + idx;
    const hmin = pad2(Math.min(...g.map((x) => x.hook))), hmax = pad2(Math.max(...g.map((x) => x.hook)));
    const name = `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [Esther] - Processo Bready - h${hmin} a h${hmax} | ${BODY} | c1`;
    return { key: String(nn), name, items: g };
  });

  // ---- trava anti-duplicação ----
  for (const gm of groupMeta) {
    if (existingNames.has(gm.name) && !state.adsets[gm.key]) throw new Error(`ABORT: conjunto já existe no Meta: "${gm.name}"`);
  }
  console.log("conjuntos a criar:"); groupMeta.forEach((g) => console.log(`  ${g.key}: ${g.name} (${g.items.length} ads)`));

  // ============ STAGE 1: conjuntos (duplica config do 141) ============
  const tpl: any = await metaGet(TEMPLATE_ADSET, { fields: "billing_event,optimization_goal,bid_strategy,promoted_object,attribution_spec,targeting" });
  for (const gm of groupMeta) {
    if (state.adsets[gm.key]) { console.log(`[stage1] conjunto ${gm.key} já existe: ${state.adsets[gm.key]}`); continue; }
    const res = await metaPostForm(`${ACC}/adsets`, {
      name: gm.name, campaign_id: CAMP, daily_budget: DAILY_BUDGET,
      billing_event: tpl.billing_event, optimization_goal: tpl.optimization_goal, bid_strategy: tpl.bid_strategy,
      promoted_object: tpl.promoted_object, attribution_spec: tpl.attribution_spec, targeting: tpl.targeting, status: "PAUSED",
    });
    if (!res.id) throw new Error(`conjunto ${gm.key} sem id`);
    state.adsets[gm.key] = res.id; saveState(state);
    console.log(`[stage1] conjunto ${gm.key} criado: ${res.id} (R$${Number(DAILY_BUDGET) / 100}/dia, PAUSED)`);
  }

  // ============ STAGE 2: upload dos vídeos ============
  for (const it of items) {
    if (state.videos[it.tpId]) { console.log(`[stage2] ${it.tpId} já subido`); continue; }
    console.log(`[stage2] ${it.tpId} baixando...`);
    const buf = await downloadDriveFile(it.fileId);
    console.log(`[stage2] ${it.tpId} subindo (${(buf.length / 1024 / 1024).toFixed(1)}MB)...`);
    const videoId = await metaUploadVideo(ACC, it.nomeDrive + ".mp4", buf);
    await pollVideoUntilReady(videoId, { maxWaitMs: 300_000 });
    let thumbUrl: string | null = null; try { thumbUrl = await getVideoThumbnail(videoId); } catch {}
    state.videos[it.tpId] = { videoId, thumbUrl }; saveState(state);
    console.log(`[stage2] ${it.tpId} pronto: ${videoId}`);
  }

  // ============ STAGE 3: criativos + ads ============
  for (const gm of groupMeta) {
    for (const it of gm.items) {
      if (state.ads[it.tpId]) { console.log(`[stage3] ${it.tpId} já criado`); continue; }
      const { videoId, thumbUrl } = state.videos[it.tpId];
      const videoData: Record<string, any> = { video_id: videoId, message: MESSAGE, link_description: DESCRIPTION, call_to_action: { type: CTA_TYPE, value: { link: CTA_LINK } } };
      if (thumbUrl) videoData.image_url = thumbUrl;
      const cre = await metaPostForm(`${ACC}/adcreatives`, {
        name: `Criativo: ${it.nomeFinal}`,
        object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID, video_data: videoData },
        degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT, contextual_multi_ads: { enroll_status: "OPT_OUT" }, url_tags: TURBO_URL_TAGS,
      });
      if (!cre.id) throw new Error(`criativo ${it.tpId} sem id`);
      const ad = await metaPostForm(`${ACC}/ads`, { name: it.nomeFinal, adset_id: state.adsets[gm.key], creative: { creative_id: cre.id }, status: "PAUSED" });
      if (!ad.id) throw new Error(`ad ${it.tpId} sem id`);
      state.ads[it.tpId] = { creativeId: cre.id, adId: ad.id }; saveState(state);
      console.log(`[stage3] ${it.tpId} → conj ${gm.key}: ad ${ad.id} (PAUSED)`);
      await sleep(800);
    }
  }

  console.log("\n===== RESUMO =====");
  groupMeta.forEach((g) => console.log(`conjunto ${g.key}: ${state.adsets[g.key]} → ${g.items.length} ads`));
  console.log("total ads:", Object.keys(state.ads).length);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
