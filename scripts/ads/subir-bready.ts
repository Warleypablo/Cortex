/**
 * One-off: sobe os 9 criativos Bready (b1 c1) na campanha Creators ABO teste da Turbo.
 * Duplica a config do conjunto 141 em 2 conjuntos novos (142 h1-h5, 143 h6-h9), 9x16, PAUSED.
 * Resumável: salva estado em /tmp/bready-state.json (re-run não duplica).
 */
import "dotenv/config";
import fs from "fs";
import { metaGet, metaPostForm, metaUploadVideo, pollVideoUntilReady, getVideoThumbnail } from "../../server/services/adsCreation/metaApi";

// igual ao TURBO_URL_TAGS do creator.ts (UTM dinâmica padrão da Turbo)
const TURBO_URL_TAGS = "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}";
import { downloadDriveFile } from "../../server/services/adsCreation/driveLoader";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;        // act_1331413260627780
const CAMP = "120215204345090450";                          // [TP] [Leads] [ABO] [Creators] - Campanha de teste
const TEMPLATE_ADSET = "120250801263010450";                // 141 (último)
const PAGE_ID = "111691498031338";
const IG_USER_ID = "17841423555147969";
const DAILY_BUDGET = "2000";                                // R$20/dia
const STATE_FILE = "/tmp/bready-state.json";

const MESSAGE = "A Turbo entrega os anúncios UGCs que a sua marca precisa para gerar mais resultados no social media";
const DESCRIPTION = "Anúncios sem cara de anúncio. Do roteiro ao vídeo editado, prontos pra escalar suas campanhas.";
const CTA_TYPE = "LEARN_MORE";
const CTA_LINK = "https://pages.turbopartners.com.br/creators/";

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

const ADSET_NAMES: Record<string, string> = {
  "142": "142 - [IG] [Aberto] [Stories & Feed & Reels] [Esther] - Processo Bready - h01 a h05 | b1 | c1",
  "143": "143 - [IG] [Aberto] [Stories & Feed & Reels] [Esther] - Processo Bready - h06 a h09 | b1 | c1",
};

type State = {
  adsets: Record<string, string>;
  videos: Record<string, { videoId: string; thumbUrl: string | null }>;
  ads: Record<string, { creativeId: string; adId: string }>;
};
function loadState(): State {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return { adsets: {}, videos: {}, ads: {} }; }
}
function saveState(s: State) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const state = loadState();

  // ---- creatives da biblioteca (TP1589..TP1597) ----
  const tps = Array.from({ length: 9 }, (_, i) => "TP" + (1589 + i));
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, tps));
  rows.sort((a, b) => a.tpId.localeCompare(b.tpId, "en", { numeric: true }));
  const items = rows.map((r) => {
    const hook = parseInt(String(r.nomeDrive).match(/_h(\d+)b/i)?.[1] ?? "0", 10);
    return {
      tpId: r.tpId, nomeDrive: r.nomeDrive, nomeFinal: r.nomeFinal,
      fileId: r.driveFileId!, hook,
      adsetKey: hook <= 5 ? "142" : "143",
    };
  });
  console.log("criativos:", items.map((i) => `${i.tpId}(h${i.hook}→${i.adsetKey})`).join(" "));

  // ============ STAGE 1: conjuntos 142 e 143 (duplica config do 141) ============
  const tpl: any = await metaGet(TEMPLATE_ADSET, {
    fields: "billing_event,optimization_goal,bid_strategy,promoted_object,attribution_spec,targeting,destination_type",
  });
  for (const key of ["142", "143"]) {
    if (state.adsets[key]) { console.log(`[stage1] conjunto ${key} já existe: ${state.adsets[key]}`); continue; }
    const res = await metaPostForm(`${ACC}/adsets`, {
      name: ADSET_NAMES[key],
      campaign_id: CAMP,
      daily_budget: DAILY_BUDGET,
      billing_event: tpl.billing_event,
      optimization_goal: tpl.optimization_goal,
      bid_strategy: tpl.bid_strategy,
      promoted_object: tpl.promoted_object,
      attribution_spec: tpl.attribution_spec,
      targeting: tpl.targeting,
      status: "PAUSED",
    });
    if (!res.id) throw new Error(`conjunto ${key} sem id`);
    state.adsets[key] = res.id; saveState(state);
    console.log(`[stage1] conjunto ${key} criado: ${res.id} (R$${Number(DAILY_BUDGET) / 100}/dia, PAUSED)`);
  }

  // ============ STAGE 2: upload dos 9 vídeos ============
  for (const it of items) {
    if (state.videos[it.tpId]) { console.log(`[stage2] ${it.tpId} já subido: ${state.videos[it.tpId].videoId}`); continue; }
    console.log(`[stage2] ${it.tpId} baixando do Drive...`);
    const buf = await downloadDriveFile(it.fileId);
    console.log(`[stage2] ${it.tpId} subindo no Meta (${(buf.length / 1024 / 1024).toFixed(1)}MB)...`);
    const videoId = await metaUploadVideo(ACC, it.nomeDrive + ".mp4", buf);
    await pollVideoUntilReady(videoId, { maxWaitMs: 300_000 });
    let thumbUrl: string | null = null;
    try { thumbUrl = await getVideoThumbnail(videoId); } catch {}
    state.videos[it.tpId] = { videoId, thumbUrl }; saveState(state);
    console.log(`[stage2] ${it.tpId} pronto: video ${videoId}${thumbUrl ? " (+thumb)" : ""}`);
  }

  // ============ STAGE 3: criativos + ads ============
  for (const it of items) {
    if (state.ads[it.tpId]) { console.log(`[stage3] ${it.tpId} já criado: ad ${state.ads[it.tpId].adId}`); continue; }
    const { videoId, thumbUrl } = state.videos[it.tpId];
    const videoData: Record<string, any> = {
      video_id: videoId,
      message: MESSAGE,
      link_description: DESCRIPTION,
      call_to_action: { type: CTA_TYPE, value: { link: CTA_LINK } },
    };
    if (thumbUrl) videoData.image_url = thumbUrl;
    const creativeRes = await metaPostForm(`${ACC}/adcreatives`, {
      name: `Criativo: ${it.nomeFinal}`,
      object_story_spec: { page_id: PAGE_ID, instagram_user_id: IG_USER_ID, video_data: videoData },
      degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
      contextual_multi_ads: { enroll_status: "OPT_OUT" },
      url_tags: TURBO_URL_TAGS,
    });
    if (!creativeRes.id) throw new Error(`criativo ${it.tpId} sem id`);
    const adRes = await metaPostForm(`${ACC}/ads`, {
      name: it.nomeFinal,
      adset_id: state.adsets[it.adsetKey],
      creative: { creative_id: creativeRes.id },
      status: "PAUSED",
    });
    if (!adRes.id) throw new Error(`ad ${it.tpId} sem id`);
    state.ads[it.tpId] = { creativeId: creativeRes.id, adId: adRes.id }; saveState(state);
    console.log(`[stage3] ${it.tpId} → conj ${it.adsetKey}: ad ${adRes.id} (PAUSED)`);
    await sleep(800);
  }

  // ---- resumo ----
  console.log("\n===== RESUMO =====");
  console.log("conjunto 142:", state.adsets["142"], "→", items.filter((i) => i.adsetKey === "142").length, "ads");
  console.log("conjunto 143:", state.adsets["143"], "→", items.filter((i) => i.adsetKey === "143").length, "ads");
  console.log("total ads criados:", Object.keys(state.ads).length);
  console.log("Gerenciador:", `https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${ACC.replace("act_", "")}&selected_campaign_ids=${CAMP}`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
