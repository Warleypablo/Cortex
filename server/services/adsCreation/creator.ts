/**
 * Orquestra a criação de Campaign + AdSet + Ads no Meta a partir do briefing.
 *
 * Tudo é criado em status PAUSED para revisão humana antes de ativação.
 *
 * Documentação:
 *  - Campaign: https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group
 *  - AdSet:    https://developers.facebook.com/docs/marketing-api/reference/ad-campaign
 *  - Ad:       https://developers.facebook.com/docs/marketing-api/reference/adgroup
 *  - Creative: https://developers.facebook.com/docs/marketing-api/reference/ad-creative
 */

import { metaPostForm, getVideoThumbnail, metaBatch, buildBatchBody, metaGet, type BatchRequest } from "./metaApi";
import type {
  Briefing,
  ConjuntoBatch,
  ConjuntoStatus,
  CreationResult,
  MetaObjective,
  PairedAdMedia,
  Placement,
  UploadedMedia,
} from "./types";

// ============== NOMENCLATURA PADRÃO TURBO ==============
// Campanha: nome literal digitado pelo usuário (sem prefixo automático)
// Conjunto: [{NN}] - {Posicionamentos} {Público} {Personagem} - {Nome do ad}
// Anúncio:  Nome Final do Sheet (TP01 - img-xxx - adc1 - DD/MM/AA)

// URL params padrão (fixo pra Turbo, usa IDs em vez de nomes)
export const TURBO_URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}";

type PlacementBucket = "Feed" | "Reels" | "Stories" | "Outros";

const PLACEMENT_BUCKET: Record<Placement, PlacementBucket> = {
  facebook_feed: "Feed",
  facebook_profile_feed: "Feed",
  facebook_video_feeds: "Feed",
  facebook_marketplace: "Feed",
  instagram_feed: "Feed",
  instagram_profile_feed: "Feed",
  instagram_explore: "Feed",
  instagram_explore_home: "Feed",
  instagram_search: "Feed",
  facebook_reels: "Reels",
  instagram_reels: "Reels",
  facebook_stories: "Stories",
  instagram_stories: "Stories",
  facebook_instream_video: "Outros",
  facebook_right_column: "Outros",
};

const BUCKET_ORDER: PlacementBucket[] = ["Feed", "Reels", "Stories", "Outros"];

export function buildCampaignName(briefing: Briefing): string {
  return briefing.campaignName;
}

function placementsLabel(placements: Briefing["placements"]): string {
  if (placements === "auto") return "ADV+";
  if (placements.length === 0) return "ADV+";
  const active = new Set<PlacementBucket>();
  for (const p of placements) {
    const bucket = PLACEMENT_BUCKET[p];
    if (bucket) active.add(bucket);
  }
  return BUCKET_ORDER.filter((b) => active.has(b)).join("+");
}

/**
 * Nome do conjunto. Personagem e nome do ad agora vêm do Sheet (não do briefing).
 */
export function buildAdSetName(
  briefing: Briefing,
  sequenceNumber: number,
  personagem: string,
  adNameBase: string,
): string {
  const nn = String(sequenceNumber).padStart(2, "0");
  const placements = placementsLabel(briefing.placements);
  // Se sem público (Advantage+), usa rótulo "Adv+" no nome pra manter clareza
  const audienceLabel = briefing.audienceName?.trim() || "Adv+";
  return `[${nn}] - ${placements} ${audienceLabel} ${personagem} - ${adNameBase}`;
}

/**
 * Lê os adsets existentes da campanha e descobre o próximo número [NN] disponível.
 * Procura padrão "[01]", "[02]" no início do nome.
 */
export async function getNextAdSetSequence(campaignId: string): Promise<number> {
  try {
    const data = await metaGet(`${campaignId}/adsets`, { fields: "id,name", limit: "200" });
    const names = (data?.data ?? []).map((a: any) => a.name as string).filter(Boolean);
    let max = 0;
    for (const name of names) {
      const m = /^\[(\d{1,3})\]/.exec(name);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    return max + 1;
  } catch {
    return 1;
  }
}

interface CreatorContext {
  adAccountId: string;       // act_xxx
  pageId: string;
  instagramActorId?: string;
  pixelId?: string;
}

/**
 * Mapeia objetivo da campanha para optimization_goal + billing_event padrões.
 * Combinações conservadoras que funcionam pra maioria dos casos.
 */
function defaultsFor(objective: MetaObjective): {
  optimizationGoal: string;
  billingEvent: string;
  needsPixel: boolean;
} {
  switch (objective) {
    case "OUTCOME_TRAFFIC":
      return { optimizationGoal: "LANDING_PAGE_VIEWS", billingEvent: "IMPRESSIONS", needsPixel: false };
    case "OUTCOME_ENGAGEMENT":
      return { optimizationGoal: "POST_ENGAGEMENT", billingEvent: "IMPRESSIONS", needsPixel: false };
    case "OUTCOME_AWARENESS":
      return { optimizationGoal: "REACH", billingEvent: "IMPRESSIONS", needsPixel: false };
    case "OUTCOME_LEADS":
      return { optimizationGoal: "OFFSITE_CONVERSIONS", billingEvent: "IMPRESSIONS", needsPixel: true };
    case "OUTCOME_SALES":
      return { optimizationGoal: "OFFSITE_CONVERSIONS", billingEvent: "IMPRESSIONS", needsPixel: true };
    case "OUTCOME_APP_PROMOTION":
      return { optimizationGoal: "APP_INSTALLS", billingEvent: "IMPRESSIONS", needsPixel: false };
  }
}

// Mapping dos nomes do nosso UI pros nomes que a Meta API espera.
const PLACEMENT_MAP: Record<Placement, { platform: "facebook" | "instagram"; position: string }> = {
  facebook_feed: { platform: "facebook", position: "feed" },
  facebook_profile_feed: { platform: "facebook", position: "profile_feed" },
  facebook_stories: { platform: "facebook", position: "story" },
  facebook_reels: { platform: "facebook", position: "facebook_reels" },
  facebook_marketplace: { platform: "facebook", position: "marketplace" },
  facebook_video_feeds: { platform: "facebook", position: "video_feeds" },
  facebook_instream_video: { platform: "facebook", position: "instream_video" },
  facebook_right_column: { platform: "facebook", position: "right_hand_column" },
  instagram_feed: { platform: "instagram", position: "stream" },
  instagram_profile_feed: { platform: "instagram", position: "profile_feed" },
  instagram_stories: { platform: "instagram", position: "story" },
  instagram_reels: { platform: "instagram", position: "reels" },
  instagram_explore: { platform: "instagram", position: "explore" },
  instagram_explore_home: { platform: "instagram", position: "explore_home" },
  instagram_search: { platform: "instagram", position: "ig_search" },
};

/**
 * Opt-out de TODAS as features do Advantage+ Creative (incluindo Multi-advertiser ads).
 * Aplicado em todo creative criado pela feature.
 */
const ADVANTAGE_PLUS_OPT_OUT = {
  creative_features_spec: {
    standard_enhancements: { enroll_status: "OPT_OUT" },
    image_touchups: { enroll_status: "OPT_OUT" },
    image_brightness_and_contrast: { enroll_status: "OPT_OUT" },
    image_uncrop: { enroll_status: "OPT_OUT" },
    text_optimizations: { enroll_status: "OPT_OUT" },
    inline_comment: { enroll_status: "OPT_OUT" },
    audio: { enroll_status: "OPT_OUT" },
    image_animation: { enroll_status: "OPT_OUT" },
    composer_enhancement: { enroll_status: "OPT_OUT" },
    profile_card: { enroll_status: "OPT_OUT" },
    site_extensions: { enroll_status: "OPT_OUT" },
    video_filtering: { enroll_status: "OPT_OUT" },
    advantage_plus_creative: { enroll_status: "OPT_OUT" },
    pac_relaxation: { enroll_status: "OPT_OUT" },
    music: { enroll_status: "OPT_OUT" },
    cta_optimization: { enroll_status: "OPT_OUT" },
    description_automation: { enroll_status: "OPT_OUT" },
    enhance_cta: { enroll_status: "OPT_OUT" },
    text_generation: { enroll_status: "OPT_OUT" },
    image_enhancement: { enroll_status: "OPT_OUT" },
  },
};

function placementsToTargeting(placements: Briefing["placements"]): Record<string, any> {
  if (placements === "auto") {
    return { targeting_automation: { advantage_audience: 1 } };
  }
  const fbPositions = new Set<string>();
  const igPositions = new Set<string>();
  const publisherPlatforms = new Set<string>();

  for (const p of placements as Placement[]) {
    const map = PLACEMENT_MAP[p];
    if (!map) continue;
    publisherPlatforms.add(map.platform);
    if (map.platform === "facebook") fbPositions.add(map.position);
    else igPositions.add(map.position);
  }

  const out: Record<string, any> = {
    publisher_platforms: Array.from(publisherPlatforms),
  };
  if (fbPositions.size > 0) out.facebook_positions = Array.from(fbPositions);
  if (igPositions.size > 0) out.instagram_positions = Array.from(igPositions);
  // device_platforms é obrigatório quando publisher_platforms é manual.
  out.device_platforms = ["mobile", "desktop"];
  return out;
}

function toUnixTimestamp(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / 1000);
}

export async function createCampaign(
  ctx: CreatorContext,
  briefing: Briefing,
): Promise<string> {
  const result = await metaPostForm(`${ctx.adAccountId}/campaigns`, {
    name: briefing.campaignName,
    objective: briefing.objective,
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
  });
  if (!result.id) throw new Error("Campaign criada sem ID retornado");
  return result.id;
}

/**
 * Constrói o objeto `targeting` enviado pra Meta API.
 *
 * - `custom_audiences`: público salvo principal. Se vazio → modo Advantage+ Audience
 *   (sem público específico, Meta usa só sinais comportamentais + localização).
 * - `excluded_custom_audiences`: opcional. Bloqueia entrega pra audiences listados (ex: compradores, leads recentes).
 * - `targeting_relaxation_types`: quando `disableAdvantageExpansion=true`, força o Meta a NÃO ampliar
 *   o público pra além do salvo (lookalike: 0, custom_audience: 0). Sem isso, Meta amplia por default.
 * - `geo_locations`: BR como default quando não há público (Advantage+ exige pelo menos uma localização).
 * - placements (auto vs manual): herdado de `placementsToTargeting`.
 */
function buildTargeting(
  briefing: Briefing,
  audienceId: string,
  excludedAudienceIds: string[] = [],
): Record<string, any> {
  const useAdvantagePlusAudience = !audienceId;
  const targeting: Record<string, any> = {
    ...placementsToTargeting(briefing.placements),
  };

  if (useAdvantagePlusAudience) {
    // Advantage+ Audience: sem custom_audiences, geo_locations BR + advantage_audience=1
    targeting.geo_locations = { countries: ["BR"] };
    targeting.targeting_automation = {
      ...(targeting.targeting_automation || {}),
      advantage_audience: 1,
    };
  } else {
    targeting.custom_audiences = [{ id: audienceId }];
  }

  if (excludedAudienceIds.length > 0) {
    targeting.excluded_custom_audiences = excludedAudienceIds.map((id) => ({ id }));
  }
  if (briefing.disableAdvantageExpansion && !useAdvantagePlusAudience) {
    targeting.targeting_relaxation_types = { lookalike: 0, custom_audience: 0 };
  }
  return targeting;
}

export async function createAdSet(
  ctx: CreatorContext,
  briefing: Briefing,
  campaignId: string,
  audienceId: string,
  excludedAudienceIds: string[] = [],
): Promise<string> {
  const defaults = defaultsFor(briefing.objective);

  if (defaults.needsPixel && !ctx.pixelId) {
    throw new Error(
      `Objetivo ${briefing.objective} requer Pixel configurado em META_DEFAULT_PIXEL_ID`,
    );
  }

  const targeting = buildTargeting(briefing, audienceId, excludedAudienceIds);

  const params: Record<string, any> = {
    name: `${briefing.campaignName} — Conjunto`,
    campaign_id: campaignId,
    status: "PAUSED",
    daily_budget: briefing.dailyBudgetCents,
    billing_event: defaults.billingEvent,
    optimization_goal: defaults.optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    start_time: toUnixTimestamp(briefing.startDate),
  };

  if (briefing.endDate) {
    params.end_time = toUnixTimestamp(briefing.endDate);
  }

  if (defaults.needsPixel && ctx.pixelId) {
    params.promoted_object = {
      pixel_id: ctx.pixelId,
      custom_event_type: briefing.objective === "OUTCOME_SALES" ? "PURCHASE" : "LEAD",
    };
  }

  const result = await metaPostForm(`${ctx.adAccountId}/adsets`, params);
  if (!result.id) throw new Error("AdSet criado sem ID retornado");
  return result.id;
}

export async function createAd(
  ctx: CreatorContext,
  briefing: Briefing,
  adsetId: string,
  media: UploadedMedia,
  index: number,
): Promise<string> {
  const objectStorySpec: Record<string, any> = { page_id: ctx.pageId };
  if (ctx.instagramActorId) objectStorySpec.instagram_actor_id = ctx.instagramActorId;

  if (media.kind === "video" && media.videoId) {
    const videoData: Record<string, any> = {
      video_id: media.videoId,
      message: briefing.primaryText,
      call_to_action: { type: briefing.callToAction, value: { link: briefing.destinationUrl } },
    };
    if (briefing.headline) videoData.title = briefing.headline;
    if (briefing.description) videoData.link_description = briefing.description;
    const thumbUrl = await getVideoThumbnail(media.videoId).catch(() => null);
    if (thumbUrl) videoData.image_url = thumbUrl;
    objectStorySpec.video_data = videoData;
  } else {
    const linkData: Record<string, any> = {
      link: briefing.destinationUrl,
      message: briefing.primaryText,
      image_hash: media.imageHash,
      call_to_action: { type: briefing.callToAction, value: { link: briefing.destinationUrl } },
    };
    if (briefing.headline) linkData.name = briefing.headline;
    if (briefing.description) linkData.description = briefing.description;
    objectStorySpec.link_data = linkData;
  }

  const creativeResult = await createCreativeWithIgFallback(
    ctx,
    `${briefing.campaignName} — Criativo ${index + 1} (${media.fileName})`,
    objectStorySpec,
  );
  if (!creativeResult.id) throw new Error("AdCreative criado sem ID retornado");

  const adResult = await metaPostForm(`${ctx.adAccountId}/ads`, {
    name: `${briefing.campaignName} — Anúncio ${index + 1}`,
    adset_id: adsetId,
    creative: { creative_id: creativeResult.id },
    status: "PAUSED",
  });
  if (!adResult.id) throw new Error("Ad criado sem ID retornado");
  return adResult.id;
}

/**
 * Cria creative tentando primeiro com instagram_actor_id; se a Meta rejeitar
 * por IG inválido (config de BM ruim), retenta sem IG (só Facebook).
 */
async function createCreativeWithIgFallback(
  ctx: CreatorContext,
  name: string,
  objectStorySpec: Record<string, any>,
): Promise<{ id: string }> {
  try {
    return await metaPostForm(`${ctx.adAccountId}/adcreatives`, {
      name,
      object_story_spec: objectStorySpec,
    });
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    const igError =
      objectStorySpec.instagram_actor_id &&
      /instagram_actor_id|valid Instagram account/i.test(msg);
    if (!igError) throw err;
    console.warn(`[ads-creation] IG ID inválido, recriando sem Instagram: ${msg}`);
    const fallback = { ...objectStorySpec };
    delete fallback.instagram_actor_id;
    return await metaPostForm(`${ctx.adAccountId}/adcreatives`, {
      name,
      object_story_spec: fallback,
    });
  }
}

export async function createCarouselAd(
  ctx: CreatorContext,
  briefing: Briefing,
  adsetId: string,
  medias: UploadedMedia[],
): Promise<string> {
  const childAttachments = medias
    .filter((m) => m.imageHash)
    .map((m) => ({
      link: briefing.destinationUrl,
      image_hash: m.imageHash,
      name: briefing.headline,
      description: briefing.description,
      call_to_action: { type: briefing.callToAction },
    }));

  if (childAttachments.length < 2) {
    throw new Error("Carrossel exige no mínimo 2 imagens");
  }

  const objectStorySpec: Record<string, any> = {
    page_id: ctx.pageId,
    link_data: {
      link: briefing.destinationUrl,
      message: briefing.primaryText,
      child_attachments: childAttachments,
    },
  };
  if (ctx.instagramActorId) objectStorySpec.instagram_actor_id = ctx.instagramActorId;

  const creativeResult = await createCreativeWithIgFallback(
    ctx,
    `${briefing.campaignName} — Carrossel`,
    objectStorySpec,
  );
  if (!creativeResult.id) throw new Error("AdCreative carrossel sem ID retornado");

  const adResult = await metaPostForm(`${ctx.adAccountId}/ads`, {
    name: `${briefing.campaignName} — Carrossel`,
    adset_id: adsetId,
    creative: { creative_id: creativeResult.id },
    status: "PAUSED",
  });
  if (!adResult.id) throw new Error("Ad carrossel sem ID retornado");
  return adResult.id;
}

export function buildManagerUrl(adAccountId: string, campaignId: string): string {
  const acct = adAccountId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${acct}&selected_campaign_ids=${campaignId}`;
}

/**
 * Constrói os params do creative pra UM media (single mode).
 * Aceita opt-in de incluir/excluir IG.
 */
function buildCreativeParams(
  ctx: CreatorContext,
  briefing: Briefing,
  media: UploadedMedia,
  index: number,
  totalAds: number,
  withIg: boolean,
  adName: string,
  videoThumbUrl?: string | null,
): Record<string, any> {
  const objectStorySpec: Record<string, any> = { page_id: ctx.pageId };
  if (withIg && ctx.instagramActorId) objectStorySpec.instagram_actor_id = ctx.instagramActorId;

  if (media.kind === "video" && media.videoId) {
    const videoData: Record<string, any> = {
      video_id: media.videoId,
      message: briefing.primaryText,
      call_to_action: { type: briefing.callToAction, value: { link: briefing.destinationUrl } },
    };
    if (briefing.headline) videoData.title = briefing.headline;
    if (briefing.description) videoData.link_description = briefing.description;
    if (videoThumbUrl) videoData.image_url = videoThumbUrl;
    objectStorySpec.video_data = videoData;
  } else {
    const linkData: Record<string, any> = {
      link: briefing.destinationUrl,
      message: briefing.primaryText,
      image_hash: media.imageHash,
      call_to_action: { type: briefing.callToAction, value: { link: briefing.destinationUrl } },
    };
    if (briefing.headline) linkData.name = briefing.headline;
    if (briefing.description) linkData.description = briefing.description;
    objectStorySpec.link_data = linkData;
  }

  const params: Record<string, any> = {
    name: `Criativo: ${adName}`,
    object_story_spec: objectStorySpec,
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    url_tags: TURBO_URL_TAGS,
  };
  return params;
}

function buildCarouselCreativeParams(
  ctx: CreatorContext,
  briefing: Briefing,
  uploadedMedia: UploadedMedia[],
  withIg: boolean,
): Record<string, any> {
  const childAttachments = uploadedMedia
    .filter((m) => m.imageHash)
    .map((m) => ({
      link: briefing.destinationUrl,
      image_hash: m.imageHash,
      name: briefing.headline,
      description: briefing.description,
      call_to_action: { type: briefing.callToAction },
    }));
  if (childAttachments.length < 2) throw new Error("Carrossel exige no mínimo 2 imagens");

  const objectStorySpec: Record<string, any> = {
    page_id: ctx.pageId,
    link_data: {
      link: briefing.destinationUrl,
      message: briefing.primaryText,
      child_attachments: childAttachments,
    },
  };
  if (withIg && ctx.instagramActorId) objectStorySpec.instagram_actor_id = ctx.instagramActorId;

  const params: Record<string, any> = {
    name: `Criativo: carrossel`,
    object_story_spec: objectStorySpec,
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    url_tags: TURBO_URL_TAGS,
  };
  return params;
}

function buildCampaignParams(briefing: Briefing): Record<string, any> {
  return {
    name: buildCampaignName(briefing),
    objective: briefing.objective,
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
  };
}

function buildAdSetParams(
  ctx: CreatorContext,
  briefing: Briefing,
  campaignIdOrSubst: string,
  audienceId: string,
  sequenceNumber: number,
  personagem: string,
  adNameBase: string,
  excludedAudienceIds: string[] = [],
  dailyBudgetCentsOverride?: number,
): Record<string, any> {
  const defaults = defaultsFor(briefing.objective);
  if (defaults.needsPixel && !ctx.pixelId) {
    throw new Error(`Objetivo ${briefing.objective} requer Pixel configurado em META_DEFAULT_PIXEL_ID`);
  }

  const targeting = buildTargeting(briefing, audienceId, excludedAudienceIds);

  const params: Record<string, any> = {
    name: buildAdSetName(briefing, sequenceNumber, personagem, adNameBase),
    campaign_id: campaignIdOrSubst,
    status: "PAUSED",
    daily_budget: dailyBudgetCentsOverride ?? briefing.dailyBudgetCents,
    billing_event: defaults.billingEvent,
    optimization_goal: defaults.optimizationGoal,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting,
    start_time: toUnixTimestamp(briefing.startDate),
  };
  if (briefing.endDate) params.end_time = toUnixTimestamp(briefing.endDate);
  if (defaults.needsPixel && ctx.pixelId) {
    params.promoted_object = {
      pixel_id: ctx.pixelId,
      custom_event_type: briefing.objective === "OUTCOME_SALES" ? "PURCHASE" : "LEAD",
    };
  }
  return params;
}

function isIgError(message: string): boolean {
  return /instagram_actor_id|valid Instagram account/i.test(message);
}

/**
 * Constrói params de creative usando `asset_feed_spec` quando o ad tem 9x16 + 4x5
 * pareados — Meta entrega o asset certo pra cada placement automaticamente.
 *
 * Quando há só um formato (default ou só um dos lados pareados), cai no
 * `object_story_spec` antigo.
 */
function buildPairedCreativeParams(
  ctx: CreatorContext,
  briefing: Briefing,
  pair: PairedAdMedia,
  withIg: boolean,
  videoThumbs: Map<string, string | null>,
): Record<string, any> {
  const m9 = pair.format9x16;
  const m4 = pair.format4x5;
  const both = m9 && m4;

  // Caso simples: só um formato → object_story_spec tradicional
  if (!both) {
    const single = m9 ?? m4 ?? pair.default;
    if (!single) throw new Error(`Pair sem mídia: ${pair.baseName}`);
    return buildCreativeParams(
      ctx,
      briefing,
      single,
      0,
      1,
      withIg,
      pair.finalAdName,
      single.videoId ? (videoThumbs.get(single.videoId) ?? undefined) : undefined,
    );
  }

  // Caso pareado: asset_feed_spec com regras de customização por placement
  const isVideo = m9!.kind === "video";
  const safeBase = pair.baseName.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
  const LBL_9 = `lbl_9x16_${safeBase}`;
  const LBL_4 = `lbl_4x5_${safeBase}`;

  const assetFeedSpec: Record<string, any> = {
    bodies: [{ text: briefing.primaryText }],
    link_urls: [{ website_url: briefing.destinationUrl }],
    call_to_action_types: [briefing.callToAction],
    ad_formats: isVideo ? ["SINGLE_VIDEO"] : ["SINGLE_IMAGE"],
  };
  if (briefing.headline) assetFeedSpec.titles = [{ text: briefing.headline }];
  if (briefing.description) assetFeedSpec.descriptions = [{ text: briefing.description }];

  if (isVideo) {
    const buildVideo = (m: UploadedMedia, label: string) => {
      const v: Record<string, any> = { video_id: m.videoId, adlabels: [{ name: label }] };
      const t = videoThumbs.get(m.videoId ?? "");
      if (t) v.thumbnail_url = t;
      return v;
    };
    assetFeedSpec.videos = [buildVideo(m9!, LBL_9), buildVideo(m4!, LBL_4)];
  } else {
    assetFeedSpec.images = [
      { hash: m9!.imageHash, adlabels: [{ name: LBL_9 }] },
      { hash: m4!.imageHash, adlabels: [{ name: LBL_4 }] },
    ];
  }

  const labelKey = isVideo ? "video_label" : "image_label";
  assetFeedSpec.asset_customization_rules = [
    {
      customization_spec: {
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["story", "facebook_reels"],
        instagram_positions: ["story", "reels"],
      },
      [labelKey]: { name: LBL_9 },
    },
    {
      customization_spec: {
        publisher_platforms: ["facebook", "instagram"],
        facebook_positions: ["feed"],
        instagram_positions: ["stream"],
      },
      [labelKey]: { name: LBL_4 },
    },
  ];

  const objectStorySpec: Record<string, any> = { page_id: ctx.pageId };
  if (withIg && ctx.instagramActorId) objectStorySpec.instagram_actor_id = ctx.instagramActorId;

  return {
    name: `Criativo: ${pair.finalAdName}`,
    object_story_spec: objectStorySpec,
    asset_feed_spec: assetFeedSpec,
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    url_tags: TURBO_URL_TAGS,
  };
}

/**
 * Cria 1 ad set + N ads dele dentro da campanha. Reusável tanto pra single
 * (1 chamada) quanto pra bulk (N chamadas). Lê `[NN]` do parâmetro
 * (sequência local) e não consulta o Meta de novo.
 *
 * Retorna `{ adsetId, adIds, errors }` agregados desse conjunto. Erros num
 * conjunto não abortam a execução completa — apenas são propagados pra cima.
 */
async function createOneAdSetWithAds(
  ctx: CreatorContext,
  briefing: Briefing,
  campaignId: string,
  audienceId: string,
  sequenceNumber: number,
  batch: ConjuntoBatch,
  excludedAudienceIds: string[] = [],
  // Cache compartilhado entre adsets (do mesmo job) — evita re-buscar thumb do mesmo videoId
  sharedVideoThumbs?: Map<string, string | null>,
): Promise<{ adsetId: string; adIds: string[]; errors: string[] }> {
  const errors: string[] = [];
  const adIds: string[] = [];

  // Aplica overrides por conjunto (modo bulk-edit)
  const effectiveAudienceId = batch.audienceIdOverride ?? audienceId;
  const effectiveDailyBudgetCents = batch.dailyBudgetCentsOverride ?? briefing.dailyBudgetCents;

  // 1. Cria o ad set (sozinho — ads referenciam ele via {result=})
  const adsetResp = await metaPostForm(
    `${ctx.adAccountId}/adsets`,
    buildAdSetParams(
      ctx,
      briefing,
      campaignId,
      effectiveAudienceId,
      sequenceNumber,
      batch.personagem,
      batch.adNameBase,
      excludedAudienceIds,
      effectiveDailyBudgetCents,
    ),
  );
  if (!adsetResp?.id) {
    throw new Error(`Falha ao criar conjunto: ${JSON.stringify(adsetResp)}`);
  }
  const adsetId = adsetResp.id as string;

  // 2. Pré-busca thumbnails dos vídeos (reusa cache compartilhado entre adsets se houver)
  const videoThumbs = sharedVideoThumbs ?? new Map<string, string | null>();
  for (const pair of batch.ads) {
    for (const m of [pair.format9x16, pair.format4x5, pair.default]) {
      if (m?.kind === "video" && m.videoId && !videoThumbs.has(m.videoId)) {
        const t = await getVideoThumbnail(m.videoId).catch(() => null);
        videoThumbs.set(m.videoId, t);
      }
    }
  }

  // 3. Phase 3: batch com [creative_i, ad_i] por ad
  const buildBatchReqs = (withIg: boolean): BatchRequest[] => {
    const reqs: BatchRequest[] = [];
    batch.ads.forEach((pair, i) => {
      const cName = `creative_${i}`;
      const aName = `ad_${i}`;
      const params = buildPairedCreativeParams(ctx, briefing, pair, withIg, videoThumbs);
      reqs.push({
        name: cName,
        method: "POST",
        relative_url: `${ctx.adAccountId}/adcreatives`,
        body: params,
      });
      reqs.push({
        name: aName,
        method: "POST",
        relative_url: `${ctx.adAccountId}/ads`,
        depends_on: cName,
        body:
          `name=${encodeURIComponent(pair.finalAdName)}` +
          `&adset_id=${adsetId}` +
          `&status=PAUSED` +
          `&creative=${encodeURIComponent('{"creative_id":"')}{result=${cName}:$.id}${encodeURIComponent('"}')}`,
      });
    });
    return reqs;
  };

  let phase3 = await metaBatch(buildBatchReqs(!!ctx.instagramActorId));

  // Retry sem IG se erro de IG detectado
  const igFailed = phase3.some((r) => r.error && isIgError(r.error));
  if (igFailed && ctx.instagramActorId) {
    console.warn("[ads-creation] IG inválido no batch, retentando sem Instagram");
    phase3 = await metaBatch(buildBatchReqs(false));
  }

  for (let i = 0; i < batch.ads.length; i++) {
    const creativeResp = phase3[i * 2];
    const adResp = phase3[i * 2 + 1];
    if (creativeResp?.code && creativeResp.code >= 400) {
      errors.push(`Criativo ${batch.ads[i].finalAdName}: ${creativeResp.error || "falha"}`);
      continue;
    }
    if (!adResp || adResp.code !== 200 || !adResp.body?.id) {
      errors.push(`Anúncio ${batch.ads[i].finalAdName}: ${adResp?.error || "falha"}`);
      continue;
    }
    adIds.push(adResp.body.id);
  }

  return { adsetId, adIds, errors };
}

/**
 * Orquestração principal. Recebe N conjuntos (1 no modo single, M no bulk)
 * e cria todos numa mesma campanha. Sequência [NN] resolvida 1x antes do loop;
 * cada conjunto incrementa localmente.
 *
 * Erro num conjunto é registrado em `errors[]` e o loop continua nos próximos —
 * não aborta tudo só porque 1 conjunto deu pau.
 */
export async function orchestrateCreation(
  ctx: CreatorContext,
  briefing: Briefing,
  audienceId: string,
  conjuntos: ConjuntoBatch[],
  excludedAudienceIds: string[] = [],
  onProgress?: (snapshot: CreationResult) => Promise<void> | void,
): Promise<CreationResult> {
  // Inicializa progresso por conjunto (todos pending)
  const conjuntoStatuses: ConjuntoStatus[] = conjuntos.map((b, i) => ({
    folderName: b.folderName ?? b.adNameBase ?? `Conjunto ${i + 1}`,
    status: "pending",
    adIds: [],
    totalAds: b.ads.length,
  }));

  const result: CreationResult = {
    adsetIds: [],
    adIds: [],
    errors: [],
    conjuntos: conjuntoStatuses,
  };

  const flush = async () => {
    if (onProgress) {
      try { await onProgress(result); } catch (err: any) {
        console.warn("[ads-creation] onProgress failed:", err?.message ?? err);
      }
    }
  };

  if (conjuntos.length === 0) {
    throw new Error("orchestrateCreation: nenhum conjunto fornecido");
  }

  // ===== Campanha: cria nova ou reusa existente =====
  if (briefing.campaignMode === "existing") {
    if (!briefing.existingCampaignId) {
      throw new Error("existingCampaignId obrigatório quando campaignMode='existing'");
    }
    result.campaignId = briefing.existingCampaignId;
  } else {
    const campaignResp = await metaPostForm(
      `${ctx.adAccountId}/campaigns`,
      buildCampaignParams(briefing),
    );
    if (!campaignResp?.id) {
      throw new Error(`Falha ao criar campanha: ${JSON.stringify(campaignResp)}`);
    }
    result.campaignId = campaignResp.id;
  }
  await flush();

  // ===== Sequência [NN] resolvida 1x antes do loop =====
  let nextSeq = await getNextAdSetSequence(result.campaignId!);

  // Cache de thumbnails compartilhado entre todos os adsets desse job
  // (se um mesmo videoId aparecer em N adsets, busca thumb 1x só)
  const sharedVideoThumbs = new Map<string, string | null>();

  // ===== Loop sobre conjuntos =====
  for (let i = 0; i < conjuntos.length; i++) {
    const batch = conjuntos[i];
    const cs = conjuntoStatuses[i];
    cs.status = "running";
    await flush();
    try {
      const out = await createOneAdSetWithAds(
        ctx,
        briefing,
        result.campaignId!,
        audienceId,
        nextSeq,
        batch,
        excludedAudienceIds,
        sharedVideoThumbs,
      );
      result.adsetIds.push(out.adsetId);
      result.adIds.push(...out.adIds);
      result.errors.push(...out.errors);
      cs.status = "done";
      cs.adsetId = out.adsetId;
      cs.adIds = out.adIds;
      nextSeq++;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[ads-creation] conjunto "${batch.adNameBase}" falhou:`, msg);
      result.errors.push(`Conjunto "${batch.adNameBase}": ${msg}`);
      cs.status = "failed";
      cs.error = msg;
      // ainda incrementa seq pra evitar colisão se conjunto seguinte rodar
      nextSeq++;
    }
    await flush();
  }

  // Compat: primeiro adsetId em `adsetId` (legado)
  if (result.adsetIds.length > 0) result.adsetId = result.adsetIds[0];

  result.managerUrl = buildManagerUrl(ctx.adAccountId, result.campaignId!);
  return result;
}
