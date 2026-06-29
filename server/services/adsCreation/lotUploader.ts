/**
 * Helpers reutilizáveis para subir LOTES de ads de vídeo pareados (9x16+4x5) quando os
 * vídeos já foram subidos MANUALMENTE no Gerenciador (fluxo "sobe esses ads"). Diferente do
 * pipeline de produção (`creator.ts`, que sobe a própria mídia e já sabe o video_id), aqui
 * precisamos DESCOBRIR o video_id casando pelo nome do arquivo.
 *
 * Traz esse fluxo pro mesmo padrão saudável da produção, pra economizar quota e manter a
 * taxa de erro perto de zero (importante pro upgrade de tier da Marketing API):
 *   1. Descoberta ESTRITA por nome exato (`<base>_9x16` / `<base>_4x5`) — não confunde com
 *      famílias parecidas (ex.: `Estrategia_peculiar_react_*` SEM `_v2`) — com EARLY-EXIT
 *      na paginação (para assim que acha todos → 1 página quando os vídeos são recentes).
 *   2. Criação em BATCH ([creative, ad] por ad via `metaBatch`) em vez de 2 calls por ad.
 *   3. Pré-busca de THUMBNAIL e envio de `thumbnail_url` no creative — evita o erro transitório
 *      code=100 "problem uploading your video thumbnail".
 *   4. Retry de erros TRANSITÓRIOS (inclui "please try again") + fallback de Instagram.
 *
 * A lógica pura (indexação/match/montagem de batch) é exportada separada pra ser testável
 * sem tocar a API (ver test/services/lotUploader.test.ts).
 */

import {
  metaGet,
  metaBatch,
  getVideoThumbnail,
  MetaRateLimitError,
  type BatchRequest,
  type BatchResponse,
} from "./metaApi";

// ===================== util =====================

/** Normaliza título de vídeo / nome de arquivo: trim, lower, sem extensão. */
export function normName(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\.[^.]+$/, "");
}

/** Escolhe um id determinístico quando há duplicatas do mesmo nome (o menor, estável). */
export function pickDeterministic(ids: string[]): string {
  return [...ids].sort()[0];
}

const RATE_LIMIT_RE = /too many|rate limit|code=17|code=80004|code=80014/i;
export function isRateLimit(e: unknown): boolean {
  return e instanceof MetaRateLimitError || RATE_LIMIT_RE.test(e instanceof Error ? e.message : String(e));
}

/** Erros transitórios da Meta que valem retry (mesmo conjunto usado na produção + thumbnail). */
export const TRANSIENT_RE =
  /something went wrong|try again later|temporarily|please try again|reduce the (amount|number)|uploading your video thumbnail/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Roda `fn`, e em rate-limit "duro" espera e tenta de novo (default 5min, até `max` vezes). */
export async function withBackoff<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { max?: number; waitMs?: number; log?: (m: string) => void } = {},
): Promise<T> {
  const max = opts.max ?? 12;
  const waitMs = opts.waitMs ?? 5 * 60_000;
  const log = opts.log ?? ((m: string) => console.log(m));
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= max || !isRateLimit(e)) throw e;
      log(`   ⏳ rate-limit em ${label} — esperando ${Math.round(waitMs / 60000)}min (${i + 1}/${max})`);
      await sleep(waitMs);
    }
  }
}

// ===================== descoberta de vídeo (pura) =====================

/** Indexa vídeos por nome-normalizado → lista de ids (captura duplicatas). PURO. */
export function indexVideosByName(videos: { id: string; title?: string | null }[]): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const v of videos) {
    const k = normName(v.title ?? "");
    if (!k) continue;
    const arr = idx.get(k) ?? idx.set(k, []).get(k)!;
    arr.push(v.id);
  }
  return idx;
}

export interface PairTarget {
  /** chave estável do par (ex.: tpId). */
  key: string;
  /** nome-base do arquivo SEM o sufixo de formato (ex.: "Creator_Summit_React_Esther_h1b1c1"). */
  base: string;
}
export interface DiscoveredPair {
  key: string;
  base: string;
  v9?: string;
  v4?: string;
  /** quantas cópias do mesmo nome existem (1 = ok; >1 = duplicata no Gerenciador). */
  dup9: number;
  dup4: number;
}

/** Conjunto de nomes-alvo (base_9x16 / base_4x5) normalizados — usado pra early-exit. PURO. */
export function targetNameSet(targets: PairTarget[]): Set<string> {
  const want = new Set<string>();
  for (const t of targets) {
    want.add(normName(`${t.base}_9x16`));
    want.add(normName(`${t.base}_4x5`));
  }
  return want;
}

/** Casa cada alvo contra o índice por NOME EXATO. PURO. */
export function matchPairs(targets: PairTarget[], index: Map<string, string[]>): Map<string, DiscoveredPair> {
  const out = new Map<string, DiscoveredPair>();
  for (const t of targets) {
    const c9 = index.get(normName(`${t.base}_9x16`)) ?? [];
    const c4 = index.get(normName(`${t.base}_4x5`)) ?? [];
    out.set(t.key, {
      key: t.key,
      base: t.base,
      v9: c9.length ? pickDeterministic(c9) : undefined,
      v4: c4.length ? pickDeterministic(c4) : undefined,
      dup9: c9.length,
      dup4: c4.length,
    });
  }
  return out;
}

/**
 * Pagina /{acc}/advideos com EARLY-EXIT (para assim que acha todos os alvos) e casa por nome
 * EXATO. Retorna os pares + quantas páginas leu + se achou todos.
 */
export async function findPairedVideosByExactName(
  adAccountId: string,
  targets: PairTarget[],
  opts: { maxPages?: number; pageSize?: number; log?: (m: string) => void } = {},
): Promise<{ pairs: Map<string, DiscoveredPair>; pagesRead: number; foundAll: boolean }> {
  const maxPages = opts.maxPages ?? 30;
  const limit = String(opts.pageSize ?? 200);
  const want = targetNameSet(targets);
  const index = new Map<string, string[]>();
  const foundTargets = new Set<string>();

  let url: string | null = `${adAccountId}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit };
  let pagesRead = 0;
  for (; url && pagesRead < maxPages; pagesRead++) {
    const res: any = await withBackoff("GET advideos", () => metaGet(url!, params), { log: opts.log });
    for (const v of res.data ?? []) {
      const k = normName(v.title ?? "");
      if (!k || !want.has(k)) continue;
      (index.get(k) ?? index.set(k, []).get(k)!).push(v.id);
      foundTargets.add(k);
    }
    if (foundTargets.size >= want.size) {
      pagesRead++;
      break;
    }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit, after };
    else url = null;
  }

  return { pairs: matchPairs(targets, index), pagesRead, foundAll: foundTargets.size >= want.size };
}

// ===================== criação em batch =====================

export interface ReusedCopy {
  message: string;
  title?: string;
  link: string;
  cta: string;
  urlTags?: string;
  pageId: string;
  ig?: string;
}

export interface PairedAdSpec {
  /** prefixo único do ad (ex.: tpId) — usado pra label do creative e idempotência. */
  tpId: string;
  /** nome final do ad (vai como `name` no Gerenciador). */
  finalName: string;
  v9: string;
  v45: string;
}

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

/** Monta os params do creative pareado de vídeo (9x16+4x5), com thumbnail_url se houver. PURO. */
export function buildPairedVideoCreativeParams(
  ad: PairedAdSpec,
  copy: ReusedCopy,
  thumbs: Map<string, string | null>,
  withIg: boolean,
): Record<string, any> {
  const safe = ad.tpId.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32);
  const LBL_9 = `lbl_9x16_${safe}`;
  const LBL_4 = `lbl_4x5_${safe}`;
  const mkVideo = (videoId: string, label: string) => {
    const v: Record<string, any> = { video_id: videoId, adlabels: [{ name: label }] };
    const t = thumbs.get(videoId);
    if (t) v.thumbnail_url = t;
    return v;
  };
  const oss: Record<string, any> = { page_id: copy.pageId };
  if (withIg && copy.ig) oss.instagram_user_id = copy.ig;

  return {
    name: `Criativo: ${ad.finalName}`,
    object_story_spec: oss,
    asset_feed_spec: {
      bodies: [{ text: copy.message }],
      ...(copy.title ? { titles: [{ text: copy.title }] } : {}),
      link_urls: [{ website_url: copy.link }],
      call_to_action_types: [copy.cta],
      ad_formats: ["SINGLE_VIDEO"],
      videos: [mkVideo(ad.v9, LBL_9), mkVideo(ad.v45, LBL_4)],
      asset_customization_rules: [
        {
          customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["story", "facebook_reels"], instagram_positions: ["story", "reels"] },
          video_label: { name: LBL_9 },
        },
        {
          customization_spec: { publisher_platforms: ["facebook", "instagram"], facebook_positions: ["feed"], instagram_positions: ["stream", "profile_feed"] },
          video_label: { name: LBL_4 },
        },
      ],
    },
    degrees_of_freedom_spec: ADVANTAGE_PLUS_OPT_OUT,
    contextual_multi_ads: { enroll_status: "OPT_OUT" },
    ...(copy.urlTags ? { url_tags: copy.urlTags } : {}),
  };
}

/**
 * Monta os BatchRequest [creative_i, ad_i] pra um conjunto de ads. O ad referencia o id do
 * creative criado no mesmo batch via `{result=creative_i:$.id}` (depends_on). PURO.
 * `offset` deixa os nomes únicos quando chunkamos (>25 ads).
 */
export function buildAdBatchReqs(
  adAccountId: string,
  adsetId: string,
  ads: PairedAdSpec[],
  copy: ReusedCopy,
  thumbs: Map<string, string | null>,
  withIg: boolean,
  offset = 0,
): BatchRequest[] {
  const reqs: BatchRequest[] = [];
  ads.forEach((ad, i) => {
    const idx = offset + i;
    const cName = `creative_${idx}`;
    const aName = `ad_${idx}`;
    reqs.push({
      name: cName,
      method: "POST",
      relative_url: `${adAccountId}/adcreatives`,
      body: buildPairedVideoCreativeParams(ad, copy, thumbs, withIg),
    });
    reqs.push({
      name: aName,
      method: "POST",
      relative_url: `${adAccountId}/ads`,
      depends_on: cName,
      body:
        `name=${encodeURIComponent(ad.finalName)}` +
        `&adset_id=${adsetId}` +
        `&status=PAUSED` +
        `&creative=${encodeURIComponent('{"creative_id":"')}{result=${cName}:$.id}${encodeURIComponent('"}')}`,
    });
  });
  return reqs;
}

/** Quebra em chunks de no máx `size` ads (cada ad = 2 sub-requests; metaBatch aceita ≤50). PURO. */
export function chunkAds<T>(ads: T[], size = 25): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ads.length; i += size) out.push(ads.slice(i, i + size));
  return out;
}

function isIgError(message: string): boolean {
  return /instagram|ig user|instagram_actor|instagram account/i.test(message ?? "");
}

/**
 * Cria os ads pareados de um adset EXISTENTE em batch, com:
 *  - pré-busca de thumbnail (evita code=100 de thumbnail),
 *  - retry de erros transitórios com backoff,
 *  - fallback de Instagram (BM mal configurado → publica só no Facebook),
 *  - chunking ≤25 ads/batch.
 * Não cria o adset (o caller cria/encontra e passa o `adsetId`).
 */
export async function createPairedVideoAdsBatched(
  adAccountId: string,
  adsetId: string,
  ads: PairedAdSpec[],
  copy: ReusedCopy,
  opts: { withIg?: boolean; retryDelaysMs?: number[]; log?: (m: string) => void; sharedThumbs?: Map<string, string | null> } = {},
): Promise<{ adIds: string[]; errors: string[] }> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const retryDelays = opts.retryDelaysMs ?? [8_000, 20_000, 40_000];
  const adIds: string[] = [];
  const errors: string[] = [];
  if (!ads.length) return { adIds, errors };

  // pré-busca thumbnails (uma vez por video_id)
  const thumbs = opts.sharedThumbs ?? new Map<string, string | null>();
  for (const a of ads) {
    for (const vid of [a.v9, a.v45]) {
      if (vid && !thumbs.has(vid)) {
        const t = await withBackoff(`thumb ${vid}`, () => getVideoThumbnail(vid), { log }).catch(() => null);
        thumbs.set(vid, t);
      }
    }
  }

  for (const chunk of chunkAds(ads, 25)) {
    let pending = chunk.map((_, i) => i);
    let useIg = opts.withIg ?? !!copy.ig;
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt > 0) {
        const delay = retryDelays[Math.min(attempt - 1, retryDelays.length - 1)];
        log(`   ↻ retry ${attempt}: ${pending.length} ad(s) transiente — aguardando ${delay / 1000}s`);
        await sleep(delay);
      }
      const reqs = buildAdBatchReqs(adAccountId, adsetId, pending.map((i) => chunk[i]), copy, thumbs, useIg);
      let resp: BatchResponse[] = await withBackoff("BATCH ads", () => metaBatch(reqs), { log });

      // fallback de IG só na 1ª tentativa
      if (attempt === 0 && useIg && resp.some((r) => r.error && isIgError(r.error))) {
        log(`   ⚠️ IG inválido no batch — retentando sem Instagram`);
        useIg = false;
        resp = await withBackoff("BATCH ads (sem IG)", () => metaBatch(buildAdBatchReqs(adAccountId, adsetId, pending.map((i) => chunk[i]), copy, thumbs, useIg)), { log });
      }

      const stillPending: number[] = [];
      pending.forEach((adIdx, k) => {
        const creativeResp = resp[k * 2];
        const adResp = resp[k * 2 + 1];
        const canRetry = attempt < retryDelays.length;
        if (creativeResp?.code && creativeResp.code >= 400) {
          if (canRetry && TRANSIENT_RE.test(creativeResp.error || "")) stillPending.push(adIdx);
          else errors.push(`Criativo ${chunk[adIdx].finalName}: ${creativeResp.error || "falha"}`);
          return;
        }
        if (!adResp || adResp.code !== 200 || !adResp.body?.id) {
          if (canRetry && TRANSIENT_RE.test(adResp?.error || "")) stillPending.push(adIdx);
          else errors.push(`Anúncio ${chunk[adIdx].finalName}: ${adResp?.error || "falha"}`);
          return;
        }
        adIds.push(adResp.body.id);
      });
      pending = stillPending;
    }
  }

  return { adIds, errors };
}
