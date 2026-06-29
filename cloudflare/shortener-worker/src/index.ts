/**
 * Encurtador da Turbo — Cloudflare Worker (Fase 3).
 *
 * Responde em marketing.turbopartners.com.br/<slug> e:
 *   1. lê o slug no KV (slug -> target_url, escrito pelo Cortex ao criar o link)
 *   2. redireciona 302 pro destino, com a UTM intacta
 *   3. dispara o clique pro Cortex (POST /api/clicks) SEM atrasar o redirect
 *
 * O Cortex é a fonte de verdade do cadastro; o KV é só o cache de redirect na borda.
 * Ver docs/encurtador-links-plano.md.
 */

export interface Env {
  // KV namespace: chave = slug, valor = URL longa de destino (com UTM).
  LINKS: KVNamespace;
  // Endpoint do Cortex que recebe o clique (ex: https://cortex.turbopartners.com.br/api/clicks).
  CORTEX_CLICKS_URL: string;
  // Pra onde mandar quem cai na raiz ou num slug inexistente.
  FALLBACK_URL: string;
  // Segredo compartilhado com o Cortex (header x-click-secret). Configurado via `wrangler secret put`.
  CLICK_INGEST_SECRET: string;
}

// Paths que não são slug de link — não tenta resolver no KV.
const NON_SLUG = new Set(["", "favicon.ico", "robots.txt", "apple-touch-icon.png", "health"]);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const slug = decodeURIComponent(url.pathname.replace(/^\/+/, "").split("/")[0] || "").toLowerCase();

    if (NON_SLUG.has(slug)) {
      return Response.redirect(env.FALLBACK_URL, 302);
    }

    const target = await env.LINKS.get(slug);
    if (!target) {
      // Slug desconhecido → manda pro site em vez de deixar a pessoa num 404.
      return Response.redirect(env.FALLBACK_URL, 302);
    }

    // Loga o clique sem segurar o redirect (best-effort).
    ctx.waitUntil(logClick(slug, request, env));

    return Response.redirect(target, 302);
  },
};

async function logClick(slug: string, request: Request, env: Env): Promise<void> {
  if (!env.CORTEX_CLICKS_URL || !env.CLICK_INGEST_SECRET) return;
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const ipHash = ip ? await sha256(ip) : null;
    const cf = (request as any).cf as { country?: string } | undefined;

    await fetch(env.CORTEX_CLICKS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-click-secret": env.CLICK_INGEST_SECRET,
      },
      body: JSON.stringify({
        slug,
        country: cf?.country ?? null,
        ipHash,
        userAgent: request.headers.get("User-Agent"),
        referrer: request.headers.get("Referer"),
      }),
    });
  } catch {
    // engole — registrar clique nunca pode quebrar o redirect
  }
}

// Hash do IP (privacidade) — SHA-256 truncado em 64 chars hex.
async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
}
