import crypto from "crypto";

const GRAPH_API_BASE = "https://graph.instagram.com";

function getConfig() {
  const appId = process.env.META_INSTAGRAM_APP_ID;
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET;
  // The main app secret (from App Dashboard > Settings > Basic) is needed for
  // Graph API calls (appsecret_proof, long-lived token exchange)
  const mainAppSecret = process.env.META_APP_SECRET || appSecret;
  const redirectUri = process.env.META_INSTAGRAM_REDIRECT_URI;
  const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("META_INSTAGRAM_APP_ID, META_INSTAGRAM_APP_SECRET and META_INSTAGRAM_REDIRECT_URI must be set");
  }
  return { appId, appSecret, redirectUri, apiVersion, mainAppSecret };
}

function makeAppSecretProof(accessToken: string): string {
  const { mainAppSecret } = getConfig();
  return crypto.createHmac("sha256", mainAppSecret).update(accessToken).digest("hex");
}

export async function callGraphAPI(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {},
  retries = 3
): Promise<any> {
  const { apiVersion } = getConfig();
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}${endpoint}`);
  url.searchParams.set("access_token", accessToken);
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
  const { appId, appSecret, redirectUri, apiVersion, mainAppSecret } = getConfig();

  // Step 1: Exchange code for short-lived token (Instagram Login flow)
  console.log("[Instagram] Step 1: Exchanging code for short-lived token...");
  const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const tokenData = await tokenRes.json();
  console.log("[Instagram] Step 1 response:", JSON.stringify({ has_token: !!tokenData.access_token, user_id: tokenData.user_id, error: tokenData.error_type || tokenData.error_message || null }));
  if (tokenData.error_type || tokenData.error_message) {
    throw new Error(`Token exchange failed: ${tokenData.error_message || tokenData.error_type}`);
  }

  const shortLivedToken = tokenData.access_token;
  const igUserId = String(tokenData.user_id);

  // Step 2: Try to exchange for long-lived token (graceful fallback)
  let finalToken = shortLivedToken;
  let expiresIn = 3600; // default 1 hour for short-lived

  try {
    console.log("[Instagram] Step 2: Exchanging for long-lived token...");
    const longUrl = new URL(`https://graph.instagram.com/${apiVersion}/access_token`);
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortLivedToken);

    const longRes = await fetch(longUrl.toString());
    const longData = await longRes.json();
    console.log("[Instagram] Step 2 response:", JSON.stringify({ has_token: !!longData.access_token, expires_in: longData.expires_in, error: longData.error?.message || null }));

    if (longData.access_token) {
      finalToken = longData.access_token;
      expiresIn = longData.expires_in || 5184000;
      console.log("[Instagram] Long-lived token obtained successfully");
    } else {
      console.warn("[Instagram] Long-lived token exchange failed, using short-lived token");
    }
  } catch (err) {
    console.warn("[Instagram] Long-lived token exchange error, using short-lived token:", err);
  }

  // Step 3: Get Instagram profile info (graceful — don't fail if API rejects)
  console.log("[Instagram] Step 3: Fetching profile for user_id:", igUserId);
  let username = igUserId;
  let accountType = "BUSINESS";
  try {
    const profileUrl = `https://graph.instagram.com/${apiVersion}/me?fields=user_id,username,account_type&access_token=${finalToken}`;
    const profileRes = await fetch(profileUrl);
    const profile = await profileRes.json();
    console.log("[Instagram] Step 3 response:", JSON.stringify({ username: profile.username, error: profile.error?.message || null, code: profile.error?.code || null }));
    if (profile.username) {
      username = profile.username;
      accountType = profile.account_type || "BUSINESS";
    } else {
      console.warn("[Instagram] Profile fetch failed, using user_id as username. App may need Meta App Review for instagram_business_basic permission.");
    }
  } catch (err) {
    console.warn("[Instagram] Profile fetch error, using user_id as username:", err);
  }

  return {
    accessToken: finalToken,
    expiresIn,
    igUserId,
    username,
    accountType,
  };
}

export async function refreshLongLivedToken(currentToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { apiVersion } = getConfig();
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", currentToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error.message}`);

  return { accessToken: data.access_token, expiresIn: data.expires_in || 5184000 };
}

export async function syncProfile(igUserId: string, accessToken: string) {
  const profile = await callGraphAPI(`/me`, accessToken, {
    fields: "user_id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url,account_type",
  });
  return profile;
}

export async function syncInsights(igUserId: string, accessToken: string, period: string = "day") {
  console.log("[Instagram] Fetching insights for user:", igUserId);
  const allData: any[] = [];

  // Group 1: Core metrics (known to work)
  try {
    const r1 = await callGraphAPI(`/me/insights`, accessToken, {
      metric: "reach,follower_count,views",
      period,
      metric_type: "total_value",
    });
    if (r1.data) allData.push(...r1.data);
    console.log("[Instagram] Core insights:", r1.data?.map((d: any) => d.name) || []);
  } catch (err: any) {
    console.error("[Instagram] Core insights error:", err.message);
  }

  // Group 2: Engagement metrics
  try {
    const r2 = await callGraphAPI(`/me/insights`, accessToken, {
      metric: "accounts_engaged,total_interactions,likes,comments,saves,shares",
      period,
      metric_type: "total_value",
    });
    if (r2.data) allData.push(...r2.data);
    console.log("[Instagram] Engagement insights:", r2.data?.map((d: any) => d.name) || []);
  } catch (err: any) {
    console.error("[Instagram] Engagement insights error:", err.message);
  }

  // Group 3: Follows and profile actions
  try {
    const r3 = await callGraphAPI(`/me/insights`, accessToken, {
      metric: "follows_and_unfollows,profile_links_taps",
      period,
      metric_type: "total_value",
    });
    if (r3.data) allData.push(...r3.data);
    console.log("[Instagram] Follows/profile insights:", r3.data?.map((d: any) => d.name) || []);
  } catch (err: any) {
    console.error("[Instagram] Follows/profile insights error:", err.message);
  }

  console.log("[Instagram] Total insights collected:", allData.length, "metrics");
  return allData;
}

// Fetch historical daily insights for a date range.
// Graph API v21 only supports time_series for `reach` and `follower_count` — the rest
// (views, total_interactions, accounts_engaged, follows_and_unfollows, profile_links_taps,
// likes, comments, saves, shares) only return values via `total_value` for a single-day
// since/until window. So we make ONE time_series call for reach/followers covering the
// whole range, then loop day-by-day for the others.
type IgDayData = { reach: number; views: number; followers: number; followsDay: number; unfollowsDay: number; accountsEngaged: number; totalInteractions: number; likesDay: number; commentsDay: number; savesDay: number; sharesDay: number; profileLinksTaps: number };

function emptyDay(): IgDayData {
  return { reach: 0, views: 0, followers: 0, followsDay: 0, unfollowsDay: 0, accountsEngaged: 0, totalInteractions: 0, likesDay: 0, commentsDay: 0, savesDay: 0, sharesDay: 0, profileLinksTaps: 0 };
}

export async function syncInsightsHistorical(
  igUserId: string,
  accessToken: string,
  sinceDaysAgo: number = 30
): Promise<Array<{ date: string } & IgDayData>> {
  const now = new Date();
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - sinceDaysAgo);
  since.setUTCHours(0, 0, 0, 0);
  // Subtract 48h for data lag (IG aggregates take ~2 days to settle)
  const until = new Date(now);
  until.setUTCDate(until.getUTCDate() - 2);
  until.setUTCHours(23, 59, 59, 999);

  if (until <= since) return [];

  const dailyMap: Record<string, IgDayData> = {};

  // Step 1 — single time_series call for reach + follower_count (only metrics that support it)
  try {
    const sinceTs = Math.floor(since.getTime() / 1000);
    const untilTs = Math.floor(until.getTime() / 1000);
    const ts = await callGraphAPI(`/me/insights`, accessToken, {
      metric: "reach,follower_count",
      period: "day",
      metric_type: "time_series",
      since: String(sinceTs),
      until: String(untilTs),
    });
    for (const metric of ts.data || []) {
      for (const point of metric.values || []) {
        const date = point.end_time?.split("T")[0];
        if (!date) continue;
        if (!dailyMap[date]) dailyMap[date] = emptyDay();
        if (metric.name === "reach") dailyMap[date].reach = point.value || 0;
        if (metric.name === "follower_count") dailyMap[date].followers = point.value || 0;
      }
    }
  } catch (err: any) {
    console.error("[Instagram] Historical reach/followers error:", err.message);
  }

  // Step 2 — loop day-by-day for total_value metrics
  const dayMs = 24 * 60 * 60 * 1000;
  let dayCount = 0;
  for (let t = since.getTime(); t <= until.getTime(); t += dayMs) {
    const dayStart = new Date(t);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(t);
    dayEnd.setUTCHours(23, 59, 59, 999);
    const dateKey = dayStart.toISOString().split("T")[0];
    if (!dailyMap[dateKey]) dailyMap[dateKey] = emptyDay();
    const sinceTs = Math.floor(dayStart.getTime() / 1000);
    const untilTs = Math.floor(dayEnd.getTime() / 1000);

    // Group A — engagement
    try {
      const r = await callGraphAPI(`/me/insights`, accessToken, {
        metric: "views,accounts_engaged,total_interactions,likes,comments,saves,shares",
        period: "day",
        metric_type: "total_value",
        since: String(sinceTs),
        until: String(untilTs),
      });
      for (const m of r.data || []) {
        const v = m.total_value?.value ?? 0;
        if (m.name === "views") dailyMap[dateKey].views = v;
        if (m.name === "accounts_engaged") dailyMap[dateKey].accountsEngaged = v;
        if (m.name === "total_interactions") dailyMap[dateKey].totalInteractions = v;
        if (m.name === "likes") dailyMap[dateKey].likesDay = v;
        if (m.name === "comments") dailyMap[dateKey].commentsDay = v;
        if (m.name === "saves") dailyMap[dateKey].savesDay = v;
        if (m.name === "shares") dailyMap[dateKey].sharesDay = v;
      }
    } catch (err: any) {
      console.warn("[Instagram] Historical engagement error", dateKey, err.message);
    }

    // Group B — follows + profile link taps
    try {
      const r = await callGraphAPI(`/me/insights`, accessToken, {
        metric: "follows_and_unfollows,profile_links_taps",
        period: "day",
        metric_type: "total_value",
        since: String(sinceTs),
        until: String(untilTs),
      });
      for (const m of r.data || []) {
        const v = m.total_value?.value ?? 0;
        if (m.name === "follows_and_unfollows") {
          if (v >= 0) { dailyMap[dateKey].followsDay = v; dailyMap[dateKey].unfollowsDay = 0; }
          else { dailyMap[dateKey].followsDay = 0; dailyMap[dateKey].unfollowsDay = Math.abs(v); }
        }
        if (m.name === "profile_links_taps") dailyMap[dateKey].profileLinksTaps = v;
      }
    } catch (err: any) {
      console.warn("[Instagram] Historical follows/taps error", dateKey, err.message);
    }

    dayCount++;
  }

  const results = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  console.log("[Instagram] Historical insights:", results.length, "days,", dayCount, "API loops");
  return results;
}

export async function syncMedia(igUserId: string, accessToken: string, limit: number = 50) {
  console.log("[Instagram] Fetching media for user:", igUserId);
  const media = await callGraphAPI(`/me/media`, accessToken, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
  console.log("[Instagram] Media response: ", media.data?.length || 0, "items");
  return media.data || [];
}

export async function syncMediaInsights(mediaId: string, accessToken: string, mediaType: string) {
  // v22.0+: impressions → views, plays deprecated
  let metrics = "reach,likes,comments,saved,shares,total_interactions,views";
  try {
    const insights = await callGraphAPI(`/${mediaId}/insights`, accessToken, { metric: metrics }, 0);
    const result: Record<string, number> = {};
    for (const item of insights.data || []) {
      result[item.name] = item.values?.[0]?.value || 0;
    }
    return result;
  } catch {
    return {};
  }
}

// CRM Instagram — busca comentários nominais de uma mídia (com paginação).
// Degrada gracioso: se o escopo/superfície não permitir username, retorna o que vier.
export type IgComment = {
  id: string;
  text?: string;
  timestamp?: string;
  username?: string;
  fromId?: string;
};

export async function fetchMediaComments(
  mediaId: string,
  accessToken: string,
  maxComments: number = 300
): Promise<IgComment[]> {
  const out: IgComment[] = [];
  const fields = "id,text,timestamp,username,from{id,username}";
  try {
    let resp: any = await callGraphAPI(`/${mediaId}/comments`, accessToken, { fields, limit: "50" }, 1);
    while (resp) {
      for (const c of resp.data || []) {
        out.push({
          id: c.id,
          text: c.text,
          timestamp: c.timestamp,
          username: c.username || c.from?.username || undefined,
          fromId: c.from?.id || undefined,
        });
      }
      if (out.length >= maxComments) break;
      const after = resp.paging?.cursors?.after;
      if (!after || !resp.paging?.next) break;
      resp = await callGraphAPI(`/${mediaId}/comments`, accessToken, { fields, limit: "50", after }, 1);
    }
  } catch (err: any) {
    console.warn(`[crm-instagram] fetchMediaComments falhou para ${mediaId}:`, err.message);
  }
  return out;
}

// CRM Instagram — contexto de perfil de um comentarista via Business Discovery.
// Best-effort: só funciona para contas Business/Creator e pode não estar disponível
// na superfície Instagram Login API. Retorna null em qualquer falha.
export type IgProfileContext = {
  bio?: string;
  followersCount?: number;
  profilePictureUrl?: string;
  lastMediaPermalink?: string;
};

export async function fetchBusinessProfile(
  selfIgUserId: string,
  targetUsername: string,
  accessToken: string
): Promise<IgProfileContext | null> {
  try {
    const res = await callGraphAPI(`/${selfIgUserId}`, accessToken, {
      fields: `business_discovery.username(${targetUsername}){followers_count,biography,profile_picture_url,media.limit(1){permalink}}`,
    }, 0);
    const bd = res?.business_discovery;
    if (!bd) return null;
    return {
      bio: bd.biography,
      followersCount: bd.followers_count,
      profilePictureUrl: bd.profile_picture_url,
      lastMediaPermalink: bd.media?.data?.[0]?.permalink,
    };
  } catch {
    return null;
  }
}

export async function revokeAccess(accessToken: string): Promise<void> {
  const { apiVersion } = getConfig();
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}/me/permissions`);
  url.searchParams.set("access_token", accessToken);
  await fetch(url.toString(), { method: "DELETE" });
}
