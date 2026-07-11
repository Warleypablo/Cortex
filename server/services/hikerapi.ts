/**
 * Cliente fino da HikerAPI (https://hikerapi.com) — provedor gerenciado de scraping
 * do Instagram (roda o pool de contas deles; a Turbo NÃO loga conta nem opera proxy).
 *
 * Auth: header `x-access-key: <token>`. Base: https://api.hikerapi.com.
 * Pay-per-request (~US$0,0006/request). Sem token → funções lançam (chamadas ficam gated
 * por HIKERAPI_TOKEN no caller).
 *
 * ⚠️ LGPD: capturar likers/followers trata dado pessoal de quem não consentiu. Marcar
 * origem `source='scraper'` em todo registro derivado daqui (auditoria / expurgo).
 *
 * Docs: https://api.hikerapi.com/docs (Swagger) · https://api.hikerapi.com/redoc
 */

const HIKER_BASE = "https://api.hikerapi.com";

function token(): string {
  const t = process.env.HIKERAPI_TOKEN;
  if (!t) throw new Error("HIKERAPI_TOKEN não configurado.");
  return t;
}

/** GET genérico na HikerAPI. Só paga resposta bem-sucedida (erro 50x não é cobrado). */
async function hikerGet<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const url = `${HIKER_BASE}${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "x-access-key": token() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HikerAPI ${path} falhou (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export type HikerUser = {
  pk: string;
  username: string;
  full_name?: string | null;
  profile_pic_url?: string | null;
  is_private?: boolean;
  is_verified?: boolean;
};

/** Extrai o shortcode de um permalink do Instagram (/p/CODE/, /reel/CODE/, /tv/CODE/). */
export function shortcodeFromPermalink(permalink: string): string | null {
  const m = permalink.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Resolve o pk privado da mídia a partir do shortcode (nosso ig_media_id do Graph != pk privado). */
export async function mediaPkFromCode(code: string): Promise<string | null> {
  const r = await hikerGet<any>("/v1/media/pk/from/code", { code });
  // Endpoint devolve a string do pk (às vezes embrulhada em objeto).
  if (typeof r === "string") return r;
  return r?.pk ?? r?.id ?? null;
}

/** Lista quem curtiu uma mídia (por pk). v2 devolve {users, user_count}. */
export async function mediaLikers(mediaPk: string): Promise<HikerUser[]> {
  const r = await hikerGet<any>("/v2/media/likers", { id: mediaPk });
  const users = Array.isArray(r) ? r : r?.users;
  return Array.isArray(users) ? (users as HikerUser[]) : [];
}

/** Resolve o user_id (pk) de um @username. */
export async function userIdByUsername(username: string): Promise<string | null> {
  const r = await hikerGet<any>("/v2/user/by/username", { username });
  const u = r?.user ?? r;
  return u?.pk ?? u?.id ?? null;
}

/**
 * Um "chunk" de followers. Devolve [users, nextMaxId]. nextMaxId vazio/null = fim.
 * Paginar chamando de novo com o max_id retornado.
 */
export async function userFollowersChunk(
  userId: string,
  maxId = "",
): Promise<{ users: HikerUser[]; nextMaxId: string }> {
  const r = await hikerGet<any>("/v1/user/followers/chunk", maxId ? { user_id: userId, max_id: maxId } : { user_id: userId });
  // Formato tupla: [users_array, max_id_string].
  if (Array.isArray(r)) {
    const users = Array.isArray(r[0]) ? (r[0] as HikerUser[]) : [];
    const nextMaxId = typeof r[1] === "string" ? r[1] : "";
    return { users, nextMaxId };
  }
  // Fallback defensivo caso venha objeto.
  const users = Array.isArray(r?.users) ? (r.users as HikerUser[]) : [];
  return { users, nextMaxId: r?.next_max_id ?? r?.max_id ?? "" };
}
