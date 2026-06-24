/**
 * Cliente HTTP para Meta Graph API com retry/backoff.
 * Suporta GET, POST form-urlencoded e POST multipart para upload de mídia.
 */

import { getMetaAdsCredentials } from "../../autoreport/credentials";

export const META_API_VERSION = "v18.0";
export const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Códigos transientes (vale tentar de novo): timeout, falhas pontuais.
const RETRIABLE_ERROR_CODES = new Set([2, 4, 17, 32, 613]);
// Rate limit "duro" — retry NÃO ajuda, pode até piorar a quota.
const HARD_RATE_LIMIT_CODES = new Set([80004, 80014, 4]);
const TRANSIENT_HTTP = new Set([500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BACKOFF_MS = [10_000, 30_000, 60_000];

interface MetaApiError {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_msg?: string;
  type?: string;
}

/**
 * Erro tipado para rate limit "duro" da Meta (code 80004/80014).
 * Permite o pipeline detectar e pausar com bookmark em vez de falhar.
 */
export class MetaRateLimitError extends Error {
  readonly code: number;
  readonly metaError: MetaApiError;
  constructor(message: string, code: number, metaError: MetaApiError) {
    super(message);
    this.name = "MetaRateLimitError";
    this.code = code;
    this.metaError = metaError;
  }
}

function getAccessToken(): string {
  return getMetaAdsCredentials().accessToken;
}

/**
 * Lê o header X-Business-Use-Case-Usage e loga aviso se uso > 75%.
 * Header é um JSON: { "act_X": [{ type, call_count, total_cputime, total_time, estimated_time_to_regain_access }] }
 */
function logRateLimitWarning(response: Response, label: string): void {
  const header = response.headers.get("x-business-use-case-usage") || response.headers.get("x-ad-account-usage");
  if (!header) return;
  try {
    const parsed = JSON.parse(header);
    for (const accId of Object.keys(parsed)) {
      const entries = parsed[accId];
      const arr = Array.isArray(entries) ? entries : [entries];
      for (const e of arr) {
        const max = Math.max(e.call_count ?? 0, e.total_cputime ?? 0, e.total_time ?? 0);
        if (max >= 75) {
          console.warn(
            `[meta-api] ${label} — uso da conta ${accId} em ${max}% (call=${e.call_count}, cputime=${e.total_cputime}, time=${e.total_time}). Estimado pra liberar: ${e.estimated_time_to_regain_access ?? 0}min`,
          );
        }
      }
    }
  } catch {
    // header malformado — ignora
  }
}

async function handleResponse(response: Response, attempt: number, label: string): Promise<{ ok: true; data: any } | { ok: false; retry: boolean; error: Error; isRateLimit: boolean }> {
  logRateLimitWarning(response, label);

  if (response.ok) {
    return { ok: true, data: await response.json() };
  }

  const errorData = await response.json().catch(() => ({}));
  const error: MetaApiError = errorData.error || {};
  const isHardRateLimit = !!(error.code && HARD_RATE_LIMIT_CODES.has(error.code)) || response.status === 429;
  const isRetriable = !!(error.code && RETRIABLE_ERROR_CODES.has(error.code)) || TRANSIENT_HTTP.has(response.status);

  let msg = error.error_user_msg || error.message || response.statusText;
  if (isHardRateLimit) {
    msg = `Rate limit da Meta atingido na conta. Aguarde 15-30 min antes de tentar de novo. (${msg})`;
  }
  const wrapped: Error = isHardRateLimit
    ? new MetaRateLimitError(
        `Meta API ${label} ${response.status} (code=${error.code ?? "?"}): ${msg}`,
        error.code ?? 80004,
        error,
      )
    : new Error(`Meta API ${label} ${response.status} (code=${error.code ?? "?"}): ${msg}`);

  // Rate limit duro: NÃO tenta de novo (retry só piora a quota).
  const retry = !isHardRateLimit && isRetriable && attempt < MAX_RETRIES;
  return { ok: false, retry, error: wrapped, isRateLimit: isHardRateLimit };
}

export async function metaGet(pathOrId: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${META_API_BASE}/${pathOrId}`);
  url.searchParams.set("access_token", getAccessToken());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString());
    const result = await handleResponse(response, attempt, `GET ${pathOrId}`);
    if (result.ok) return result.data;
    if (!result.retry) throw result.error;
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
  }
  throw new Error(`Meta API GET ${pathOrId}: retries exhausted`);
}

export async function metaPostForm(pathOrId: string, params: Record<string, string | number | object>): Promise<any> {
  const url = new URL(`${META_API_BASE}/${pathOrId}`);
  url.searchParams.set("access_token", getAccessToken());

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString(), {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result = await handleResponse(response, attempt, `POST ${pathOrId}`);
    if (result.ok) return result.data;
    if (!result.retry) throw result.error;
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
  }
  throw new Error(`Meta API POST ${pathOrId}: retries exhausted`);
}

/**
 * Batch API: agrupa até 50 sub-requests em UMA única chamada HTTP.
 * Reduz drasticamente o consumo do rate limit por campanha.
 *
 * Suporta dependências (depends_on) e referência a resultados de itens anteriores
 * via sintaxe {result=NOME:$.path.to.field}.
 *
 * https://developers.facebook.com/docs/graph-api/batch-requests
 */
export interface BatchRequest {
  method: "GET" | "POST" | "DELETE";
  name?: string;
  relative_url: string;
  /** Pode ser objeto (será URL-encoded) ou string raw (usado quando há substituição {result=...}). */
  body?: Record<string, any> | string;
  depends_on?: string;
  omit_response_on_success?: boolean;
}

/**
 * Monta string url-encoded preservando marcadores {result=...} (não encoda eles).
 * Necessário pra Meta resolver as substituições corretamente em batch.
 */
export function buildBatchBody(params: Record<string, any>): string {
  const SUBST = /\{result=[^}]+\}/g;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const strVal = typeof v === "object" ? JSON.stringify(v) : String(v);

    let encoded = "";
    let pos = 0;
    let m: RegExpExecArray | null;
    SUBST.lastIndex = 0;
    while ((m = SUBST.exec(strVal)) !== null) {
      encoded += encodeURIComponent(strVal.slice(pos, m.index)) + m[0];
      pos = m.index + m[0].length;
    }
    encoded += encodeURIComponent(strVal.slice(pos));
    parts.push(`${encodeURIComponent(k)}=${encoded}`);
  }
  return parts.join("&");
}

export interface BatchResponse {
  code: number;
  body: any; // já parseado de JSON
  raw?: string;
  error?: string;
}

export async function metaBatch(requests: BatchRequest[]): Promise<BatchResponse[]> {
  if (requests.length === 0) return [];
  if (requests.length > 50) {
    throw new Error(`Batch da Meta aceita no máx 50 requests, recebeu ${requests.length}`);
  }

  const batchPayload = requests.map((r) => {
    const item: any = { method: r.method, relative_url: r.relative_url };
    if (r.name) item.name = r.name;
    if (r.depends_on) item.depends_on = r.depends_on;
    if (r.omit_response_on_success) item.omit_response_on_success = r.omit_response_on_success;
    if (r.body) {
      item.body = typeof r.body === "string" ? r.body : buildBatchBody(r.body);
    }
    return item;
  });

  const formBody = new URLSearchParams();
  formBody.set("access_token", getAccessToken());
  formBody.set("batch", JSON.stringify(batchPayload));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(META_API_BASE, {
      method: "POST",
      body: formBody,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result = await handleResponse(response, attempt, `BATCH (${requests.length} reqs)`);
    if (result.ok) {
      return (result.data as any[]).map((r: any) => {
        if (!r) return { code: 0, body: null, error: "null response" };
        let parsedBody: any = null;
        try {
          parsedBody = r.body ? JSON.parse(r.body) : null;
        } catch {
          parsedBody = r.body;
        }
        return {
          code: r.code,
          body: parsedBody,
          raw: r.body,
          error: r.code >= 400 ? (parsedBody?.error?.error_user_msg || parsedBody?.error?.message || "erro") : undefined,
        };
      });
    }
    if (!result.retry) throw result.error;
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
  }
  throw new Error(`Meta API BATCH: retries exhausted`);
}

/**
 * Threshold acima do qual usamos upload chunked em vez de direto.
 * Meta recomenda chunked para arquivos > 100MB; abaixo disso, multipart direto é mais simples.
 */
const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100MB

/**
 * Tamanho de chunk forçado por nós no upload chunked (em vez de respeitar end_offset da Meta).
 * Meta sugere ~4MB no phase=start, mas aceita chunks bem maiores em transfer.
 * 25MB é o sweet-spot: reduz ~6x o overhead HTTP (handshake + headers + processamento Meta)
 * sem risco de timeout em conexões razoáveis.
 */
const VIDEO_CHUNK_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Upload de vídeo. Auto-detecta direto vs chunked baseado no tamanho do buffer.
 * Vídeo entra em processamento — precisa polling de status antes de criar o ad.
 * https://developers.facebook.com/docs/marketing-api/video-ads/upload-video-files
 */
export async function metaUploadVideo(adAccountId: string, fileName: string, buffer: Buffer): Promise<string> {
  if (buffer.length < CHUNKED_UPLOAD_THRESHOLD) {
    return metaUploadVideoDirect(adAccountId, fileName, buffer);
  }
  console.log(`[meta-api] vídeo ${fileName} tem ${(buffer.length / 1024 / 1024).toFixed(1)}MB — usando upload chunked`);
  return metaUploadVideoChunked(adAccountId, fileName, buffer);
}

/**
 * Upload direto via multipart (1 chamada). Limite ~1GB.
 */
async function metaUploadVideoDirect(adAccountId: string, fileName: string, buffer: Buffer): Promise<string> {
  const url = new URL(`${META_API_BASE}/${adAccountId}/advideos`);
  url.searchParams.set("access_token", getAccessToken());

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append("source", blob, fileName);
  form.append("name", fileName);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString(), { method: "POST", body: form });
    const result = await handleResponse(response, attempt, `UPLOAD video ${fileName}`);
    if (result.ok) {
      const id = result.data.id;
      if (!id) throw new Error(`Meta API: video sem id retornado`);
      return id as string;
    }
    if (!result.retry) throw result.error;
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
  }
  throw new Error(`Meta API UPLOAD video ${fileName}: retries exhausted`);
}

/**
 * Upload chunked em 3 fases (start → transfer N chunks → finish).
 * Necessário pra vídeos > 100MB ou que dão 413 no upload direto.
 *
 * https://developers.facebook.com/docs/marketing-api/video-ads/upload-video-files#chunked-upload
 */
async function metaUploadVideoChunked(adAccountId: string, fileName: string, buffer: Buffer): Promise<string> {
  const totalMB = (buffer.length / 1024 / 1024).toFixed(1);

  // ===== Phase 1: start =====
  const startUrl = new URL(`${META_API_BASE}/${adAccountId}/advideos`);
  startUrl.searchParams.set("access_token", getAccessToken());
  const startBody = new URLSearchParams();
  startBody.set("upload_phase", "start");
  startBody.set("file_size", String(buffer.length));

  const startRes = await fetch(startUrl.toString(), {
    method: "POST",
    body: startBody,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!startRes.ok) {
    const errData = await startRes.json().catch(() => ({}));
    throw new Error(
      `Meta API UPLOAD chunked start ${fileName} ${startRes.status}: ${errData?.error?.error_user_msg || errData?.error?.message || startRes.statusText}`,
    );
  }
  const startData = await startRes.json();
  const uploadSessionId = startData.upload_session_id as string;
  const videoId = startData.video_id as string;
  let startOffset = parseInt(startData.start_offset, 10);
  // Ignoramos endOffset sugerido pela Meta — usamos VIDEO_CHUNK_SIZE (25MB) que é mais eficiente.
  // Após cada transfer, atualizamos startOffset com o que Meta retorna (ele aceita +/- e ajusta).
  if (!uploadSessionId || !videoId) {
    throw new Error(`Meta API UPLOAD chunked start ${fileName}: resposta sem upload_session_id/video_id`);
  }
  const chunkSize = VIDEO_CHUNK_SIZE;
  const totalChunks = Math.ceil(buffer.length / chunkSize);
  console.log(
    `[meta-api] chunked ${fileName}: ${totalMB}MB → ~${totalChunks} chunks de ${(chunkSize / 1024 / 1024).toFixed(1)}MB`,
  );

  // ===== Phase 2: transfer (loop) =====
  let chunkIdx = 0;
  const startedAt = Date.now();
  while (startOffset < buffer.length) {
    const chunkEnd = Math.min(startOffset + chunkSize, buffer.length);
    const chunk = buffer.subarray(startOffset, chunkEnd);
    const transferUrl = new URL(`${META_API_BASE}/${adAccountId}/advideos`);
    transferUrl.searchParams.set("access_token", getAccessToken());

    const form = new FormData();
    form.append("upload_phase", "transfer");
    form.append("upload_session_id", uploadSessionId);
    form.append("start_offset", String(startOffset));
    form.append("video_file_chunk", new Blob([new Uint8Array(chunk)]), fileName);

    let transferRes: Response | null = null;
    let transferErr: any = null;
    // Retry transient para chunks (rede flutuante)
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      transferRes = await fetch(transferUrl.toString(), { method: "POST", body: form });
      if (transferRes.ok) break;
      const errBody = await transferRes.json().catch(() => ({}));
      transferErr = errBody?.error;
      if (TRANSIENT_HTTP.has(transferRes.status) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
        continue;
      }
      break;
    }
    if (!transferRes?.ok) {
      throw new Error(
        `Meta API UPLOAD chunked transfer ${fileName} offset=${startOffset}: ${transferErr?.error_user_msg || transferErr?.message || transferRes?.statusText}`,
      );
    }
    const transferData = await transferRes.json();
    chunkIdx++;
    // Log a cada 5 chunks (ou último) com ETA — chunks grandes, log mais frequente
    if (chunkIdx % 5 === 0 || chunkIdx === totalChunks) {
      const pctChunks = Math.min(100, Math.round((chunkIdx / totalChunks) * 100));
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      const etaSec = chunkIdx > 0 ? Math.round((elapsedSec / chunkIdx) * (totalChunks - chunkIdx)) : 0;
      console.log(
        `[meta-api] chunked ${fileName}: chunk ${chunkIdx}/${totalChunks} (${pctChunks}%) — elapsed ${elapsedSec}s, ETA ${etaSec}s`,
      );
    }
    // Meta retorna o próximo offset esperado (cobre caso de chunk parcialmente aceito)
    const nextStartOffset = parseInt(transferData.start_offset, 10);
    if (Number.isNaN(nextStartOffset)) break;
    if (nextStartOffset === startOffset) {
      // Meta diz que não avançou — algo estranho, sai pra evitar loop infinito
      throw new Error(`Meta API UPLOAD chunked transfer ${fileName}: Meta não avançou offset ${startOffset}`);
    }
    startOffset = nextStartOffset;
  }

  // ===== Phase 3: finish =====
  const finishUrl = new URL(`${META_API_BASE}/${adAccountId}/advideos`);
  finishUrl.searchParams.set("access_token", getAccessToken());
  const finishBody = new URLSearchParams();
  finishBody.set("upload_phase", "finish");
  finishBody.set("upload_session_id", uploadSessionId);
  finishBody.set("title", fileName);

  const finishRes = await fetch(finishUrl.toString(), {
    method: "POST",
    body: finishBody,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!finishRes.ok) {
    const errData = await finishRes.json().catch(() => ({}));
    throw new Error(
      `Meta API UPLOAD chunked finish ${fileName} ${finishRes.status}: ${errData?.error?.error_user_msg || errData?.error?.message || finishRes.statusText}`,
    );
  }
  const finishData = await finishRes.json();
  if (!finishData?.success) {
    throw new Error(`Meta API UPLOAD chunked finish ${fileName}: success=false (${JSON.stringify(finishData)})`);
  }

  return videoId;
}

/**
 * Aguarda o vídeo ficar pronto. Vídeo da Meta passa por status:
 *  upload_complete → processing → ready
 * Pode também ir pra status "error" — nesse caso lança.
 */
export async function pollVideoUntilReady(videoId: string, opts: { maxWaitMs?: number } = {}): Promise<void> {
  const maxWaitMs = opts.maxWaitMs ?? 300_000; // 5min
  const startedAt = Date.now();
  // Backoff escalonado pra reduzir chamadas: 10s, 20s, 30s, depois 30s.
  // Vídeo curto fica pronto em ~10-30s; vídeo longo em 60-180s.
  // Aumentado de [5s, 10s, 15s] para reduzir polling redundante (-25% calls/vídeo).
  const intervals = [10_000, 20_000, 30_000];
  let attempt = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    const data = await metaGet(videoId, { fields: "status" });
    const code = data?.status?.video_status as string | undefined;
    if (code === "ready") return;
    if (code === "error") {
      throw new Error(`Vídeo ${videoId} falhou no processamento: ${data.status?.processing_progress ?? ""}`);
    }
    const wait = intervals[Math.min(attempt, intervals.length - 1)] ?? 20_000;
    await new Promise((r) => setTimeout(r, wait));
    attempt++;
  }
  throw new Error(`Vídeo ${videoId} não ficou pronto em ${Math.round(maxWaitMs / 1000)}s`);
}

/**
 * Busca uma thumbnail gerada pela Meta para o vídeo.
 */
export async function getVideoThumbnail(videoId: string): Promise<string | null> {
  const data = await metaGet(`${videoId}/thumbnails`, {});
  const thumbs = data?.data ?? [];
  if (thumbs.length === 0) return null;
  const preferred = thumbs.find((t: any) => t.is_preferred) ?? thumbs[0];
  return preferred?.uri ?? null;
}

/**
 * Upload de imagem via multipart. Retorna o image_hash.
 * https://developers.facebook.com/docs/marketing-api/reference/ad-image
 */
export async function metaUploadImage(adAccountId: string, fileName: string, buffer: Buffer): Promise<string> {
  const url = new URL(`${META_API_BASE}/${adAccountId}/adimages`);
  url.searchParams.set("access_token", getAccessToken());

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append(fileName, blob, fileName);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url.toString(), { method: "POST", body: form });
    const result = await handleResponse(response, attempt, `UPLOAD ${fileName}`);
    if (result.ok) {
      const images = result.data.images;
      if (!images) throw new Error(`Meta API: resposta de upload sem 'images' field`);
      const first = Object.values(images)[0] as any;
      if (!first?.hash) throw new Error(`Meta API: image_hash ausente na resposta`);
      return first.hash as string;
    }
    if (!result.retry) throw result.error;
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
  }
  throw new Error(`Meta API UPLOAD ${fileName}: retries exhausted`);
}
