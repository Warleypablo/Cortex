import crypto from "crypto";

const GRAPH_API_BASE = "https://graph.facebook.com";

function getConfig() {
  const appId = process.env.META_INSTAGRAM_APP_ID;
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.META_INSTAGRAM_REDIRECT_URI;
  const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("META_INSTAGRAM_APP_ID, META_INSTAGRAM_APP_SECRET and META_INSTAGRAM_REDIRECT_URI must be set");
  }
  return { appId, appSecret, redirectUri, apiVersion };
}

function makeAppSecretProof(accessToken: string): string {
  const { appSecret } = getConfig();
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

export async function callGraphAPI(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {},
  retries = 3
): Promise<any> {
  const { apiVersion } = getConfig();
  const proof = makeAppSecretProof(accessToken);
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("appsecret_proof", proof);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());

  const appUsage = res.headers.get("X-App-Usage");
  if (appUsage) {
    try {
      const usage = JSON.parse(appUsage);
      if (usage.call_count > 80) {
        console.warn("[Instagram] Rate limit warning: call_count at", usage.call_count, "%");
      }
    } catch {}
  }

  if (res.status === 429 && retries > 0) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "60", 10);
    console.warn(`[Instagram] Rate limited. Retrying in ${retryAfter}s...`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return callGraphAPI(endpoint, accessToken, params, retries - 1);
  }

  const json = await res.json();

  if (json.error) {
    if (retries > 0 && json.error.code !== 190) {
      await new Promise((r) => setTimeout(r, 2000 * (4 - retries)));
      return callGraphAPI(endpoint, accessToken, params, retries - 1);
    }
    throw new Error(`Graph API error: ${json.error.message} (code ${json.error.code})`);
  }

  return json;
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
  igUserId: string;
  username: string;
  accountType: string;
}> {
  const { appId, appSecret, redirectUri, apiVersion } = getConfig();

  // Step 1: Exchange code for short-lived token
  const tokenUrl = new URL(`${GRAPH_API_BASE}/${apiVersion}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(`Token exchange failed: ${tokenData.error.message}`);

  const shortLivedToken = tokenData.access_token;

  // Step 2: Exchange for long-lived token
  const longUrl = new URL(`${GRAPH_API_BASE}/${apiVersion}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", shortLivedToken);

  const longRes = await fetch(longUrl.toString());
  const longData = await longRes.json();
  if (longData.error) throw new Error(`Long-lived token exchange failed: ${longData.error.message}`);

  const longLivedToken = longData.access_token;
  const expiresIn = longData.expires_in || 5184000;

  // Step 3: Get Instagram Business Account ID via Facebook Pages
  const pagesData = await callGraphAPI("/me/accounts", longLivedToken, {
    fields: "id,name,instagram_business_account",
  });

  const page = pagesData.data?.find((p: any) => p.instagram_business_account);
  if (!page?.instagram_business_account?.id) {
    throw new Error("No Instagram Business account found linked to any Facebook Page");
  }

  const igUserId = page.instagram_business_account.id;

  // Step 4: Get Instagram profile info
  const profile = await callGraphAPI(`/${igUserId}`, longLivedToken, {
    fields: "username,account_type",
  });

  return {
    accessToken: longLivedToken,
    expiresIn,
    igUserId,
    username: profile.username,
    accountType: profile.account_type,
  };
}

export async function refreshLongLivedToken(currentToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { appId, appSecret, apiVersion } = getConfig();
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error.message}`);

  return { accessToken: data.access_token, expiresIn: data.expires_in || 5184000 };
}

export async function syncProfile(igUserId: string, accessToken: string) {
  const profile = await callGraphAPI(`/${igUserId}`, accessToken, {
    fields: "id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url,account_type",
  });
  return profile;
}

export async function syncInsights(igUserId: string, accessToken: string, period: string = "day") {
  const metrics = "reach,impressions,follower_count";
  const insights = await callGraphAPI(`/${igUserId}/insights`, accessToken, {
    metric: metrics,
    period,
  });
  return insights.data || [];
}

export async function syncMedia(igUserId: string, accessToken: string, limit: number = 50) {
  const media = await callGraphAPI(`/${igUserId}/media`, accessToken, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  return media.data || [];
}

export async function syncMediaInsights(mediaId: string, accessToken: string, mediaType: string) {
  let metrics = "impressions,reach,likes,comments,saved,shares,total_interactions";
  if (mediaType === "VIDEO" || mediaType === "REELS") {
    metrics += ",plays";
  }
  try {
    const insights = await callGraphAPI(`/${mediaId}/insights`, accessToken, { metric: metrics });
    const result: Record<string, number> = {};
    for (const item of insights.data || []) {
      result[item.name] = item.values?.[0]?.value || 0;
    }
    return result;
  } catch {
    return {};
  }
}

export async function revokeAccess(accessToken: string): Promise<void> {
  const { apiVersion } = getConfig();
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}/me/permissions`);
  url.searchParams.set("access_token", accessToken);
  await fetch(url.toString(), { method: "DELETE" });
}
