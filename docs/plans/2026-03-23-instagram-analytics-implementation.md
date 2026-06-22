# Instagram Analytics (Fase 1) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar conexão OAuth com Instagram (Meta Graph API) ao Cortex, com coleta manual de métricas de perfil e posts por cliente.

**Architecture:** Módulo integrado ao monolito Express existente. Novas tabelas no schema `cortex_core` via Drizzle. OAuth flow com Meta Graph API v21.0. Tokens criptografados com AES-256-GCM. Frontend mínimo com tela de gerenciamento de conexões.

**Tech Stack:** Express, Drizzle ORM, PostgreSQL (Cloud SQL), React + Tailwind + shadcn/ui, Meta Graph API v21.0, Node.js crypto (AES-256-GCM)

**Design doc:** `docs/plans/2026-03-23-instagram-analytics-design.md`

---

### Task 1: Schema — Definir tabelas no Drizzle

**Files:**
- Modify: `shared/schema.ts:3063` (após última definição)

**Step 1: Adicionar tabelas de Instagram ao schema**

Adicionar após a linha 3063 (final do arquivo):

```typescript
// ── Instagram Analytics ─────────────────────────────────────────────────────

export const instagramConnections = cortexCoreSchema.table("instagram_connections", {
  id: serial("id").primaryKey(),
  clienteCnpj: text("cliente_cnpj").notNull(),
  igUserId: text("ig_user_id").notNull(),
  username: text("username").notNull(),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  accountType: text("account_type"),
  scopes: text("scopes").array(),
  connectedBy: text("connected_by"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ig_conn_cnpj").on(table.clienteCnpj),
  index("idx_ig_conn_active").on(table.isActive),
]);

export const insertInstagramConnectionSchema = createInsertSchema(instagramConnections)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InstagramConnection = typeof instagramConnections.$inferSelect;
export type InsertInstagramConnection = z.infer<typeof insertInstagramConnectionSchema>;

export const instagramMetricsSnapshots = cortexCoreSchema.table("instagram_metrics_snapshots", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  metricDate: date("metric_date").notNull(),
  followers: integer("followers"),
  following: integer("following"),
  postsCount: integer("posts_count"),
  reachDay: integer("reach_day"),
  impressionsDay: integer("impressions_day"),
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_ig_metrics_conn_date").on(table.connectionId, table.metricDate),
]);

export const insertInstagramMetricsSnapshotSchema = createInsertSchema(instagramMetricsSnapshots)
  .omit({ id: true, recordedAt: true });
export type InstagramMetricsSnapshot = typeof instagramMetricsSnapshots.$inferSelect;
export type InsertInstagramMetricsSnapshot = z.infer<typeof insertInstagramMetricsSnapshotSchema>;

export const instagramPostMetrics = cortexCoreSchema.table("instagram_post_metrics", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").notNull(),
  igMediaId: text("ig_media_id").notNull(),
  mediaType: text("media_type"),
  caption: text("caption"),
  permalink: text("permalink"),
  thumbnailUrl: text("thumbnail_url"),
  postedAt: timestamp("posted_at"),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  saves: integer("saves").default(0),
  shares: integer("shares").default(0),
  impressions: integer("impressions").default(0),
  reach: integer("reach").default(0),
  plays: integer("plays").default(0),
  totalInteractions: integer("total_interactions").default(0),
  lastSyncedAt: timestamp("last_synced_at"),
}, (table) => [
  uniqueIndex("idx_ig_post_media_id").on(table.igMediaId),
  index("idx_ig_post_conn").on(table.connectionId),
]);

export const insertInstagramPostMetricsSchema = createInsertSchema(instagramPostMetrics)
  .omit({ id: true });
export type InstagramPostMetrics = typeof instagramPostMetrics.$inferSelect;
export type InsertInstagramPostMetrics = z.infer<typeof insertInstagramPostMetricsSchema>;
```

**Step 2: Push schema para o banco**

Run: `npm run db:push`
Expected: Tabelas criadas sem erros

**Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat(instagram): add Drizzle schema for connections, metrics snapshots and post metrics"
```

---

### Task 2: Utilitário de criptografia de tokens

**Files:**
- Create: `server/utils/encryption.ts`

**Step 1: Criar utilitário de criptografia AES-256-GCM**

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.INSTAGRAM_ENCRYPTION_KEY;
  if (!key) throw new Error("INSTAGRAM_ENCRYPTION_KEY not configured");
  return Buffer.from(key, "hex");
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !tagHex || !encryptedHex) throw new Error("Invalid encrypted token format");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
```

**Step 2: Commit**

```bash
git add server/utils/encryption.ts
git commit -m "feat(instagram): add AES-256-GCM encryption utility for token storage"
```

---

### Task 3: Serviço de integração com Meta Graph API

**Files:**
- Create: `server/services/instagramSync.ts`

**Step 1: Criar serviço com chamadas à Graph API**

Referência de pattern: `server/services/metaAdsSync.ts`

```typescript
import crypto from "crypto";
import { encryptToken, decryptToken } from "../utils/encryption";

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

interface GraphAPIResponse {
  data?: any;
  error?: { message: string; type: string; code: number };
  paging?: { cursors: { before: string; after: string }; next?: string };
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

  // Check rate limit usage
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

  const json: GraphAPIResponse = await res.json();

  if (json.error) {
    if (retries > 0 && json.error.code !== 190) {
      // 190 = invalid/expired token, don't retry
      await new Promise((r) => setTimeout(r, 2000 * (4 - retries)));
      return callGraphAPI(endpoint, accessToken, params, retries - 1);
    }
    throw new Error(`Graph API error: ${json.error.message} (code ${json.error.code})`);
  }

  return json;
}

// --- OAuth Token Exchange ---

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
  const expiresIn = longData.expires_in || 5184000; // default 60 days

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
  const { apiVersion } = getConfig();
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", getConfig().appId);
  url.searchParams.set("client_secret", getConfig().appSecret);
  url.searchParams.set("fb_exchange_token", currentToken);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(`Token refresh failed: ${data.error.message}`);

  return { accessToken: data.access_token, expiresIn: data.expires_in || 5184000 };
}

// --- Sync Functions ---

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
    // Some media types may not support all metrics
    return {};
  }
}

export async function revokeAccess(accessToken: string): Promise<void> {
  const { apiVersion } = getConfig();
  const url = new URL(`${GRAPH_API_BASE}/${apiVersion}/me/permissions`);
  url.searchParams.set("access_token", accessToken);
  await fetch(url.toString(), { method: "DELETE" });
}
```

**Step 2: Commit**

```bash
git add server/services/instagramSync.ts
git commit -m "feat(instagram): add Graph API service with OAuth, sync and rate limiting"
```

---

### Task 4: Rotas do backend

**Files:**
- Create: `server/routes/instagram.ts`
- Modify: `server/routes.ts:49` (adicionar import)
- Modify: `server/routes.ts:7525` (registrar rotas)

**Step 1: Criar arquivo de rotas**

```typescript
import type { Express } from "express";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import type { IStorage } from "../storage";
import {
  instagramConnections,
  instagramMetricsSnapshots,
  instagramPostMetrics,
} from "../../shared/schema";
import { encryptToken, decryptToken } from "../utils/encryption";
import {
  exchangeCodeForToken,
  refreshLongLivedToken,
  syncProfile,
  syncInsights,
  syncMedia,
  syncMediaInsights,
  revokeAccess,
  callGraphAPI,
} from "../services/instagramSync";

export function registerInstagramRoutes(app: Express, db: any, _storage: IStorage) {
  // --- OAuth Routes (registered BEFORE isAuthenticated in routes.ts) ---
  // These are handled via separate mounting — see routes.ts integration

  // --- API Routes (protected by isAuthenticated) ---

  // List connections
  app.get("/api/instagram/connections", async (req, res) => {
    try {
      const cnpj = req.query.cnpj as string | undefined;
      const conditions = [eq(instagramConnections.isActive, true)];
      if (cnpj) conditions.push(eq(instagramConnections.clienteCnpj, cnpj));

      const connections = await db
        .select({
          id: instagramConnections.id,
          clienteCnpj: instagramConnections.clienteCnpj,
          igUserId: instagramConnections.igUserId,
          username: instagramConnections.username,
          accountType: instagramConnections.accountType,
          tokenExpiresAt: instagramConnections.tokenExpiresAt,
          connectedBy: instagramConnections.connectedBy,
          isActive: instagramConnections.isActive,
          createdAt: instagramConnections.createdAt,
          updatedAt: instagramConnections.updatedAt,
        })
        .from(instagramConnections)
        .where(and(...conditions))
        .orderBy(desc(instagramConnections.createdAt));

      res.json(connections);
    } catch (err: any) {
      console.error("[Instagram] Error listing connections:", err.message);
      res.status(500).json({ error: "Failed to list connections" });
    }
  });

  // Get connection detail
  app.get("/api/instagram/connections/:id", async (req, res) => {
    try {
      const [conn] = await db
        .select()
        .from(instagramConnections)
        .where(eq(instagramConnections.id, parseInt(req.params.id)));
      if (!conn) return res.status(404).json({ error: "Connection not found" });
      const { accessToken, ...safe } = conn;
      res.json(safe);
    } catch (err: any) {
      console.error("[Instagram] Error getting connection:", err.message);
      res.status(500).json({ error: "Failed to get connection" });
    }
  });

  // Check token status
  app.get("/api/instagram/connections/:id/status", async (req, res) => {
    try {
      const [conn] = await db
        .select()
        .from(instagramConnections)
        .where(eq(instagramConnections.id, parseInt(req.params.id)));
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      const now = new Date();
      const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) : null;
      let status: "valid" | "expiring_soon" | "expired" | "unknown" = "unknown";

      if (expiresAt) {
        const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry <= 0) status = "expired";
        else if (daysUntilExpiry <= 7) status = "expiring_soon";
        else status = "valid";
      }

      // Optionally validate token with a lightweight API call
      if (status !== "expired") {
        try {
          const token = decryptToken(conn.accessToken);
          await callGraphAPI(`/${conn.igUserId}`, token, { fields: "id" });
          if (status === "unknown") status = "valid";
        } catch {
          status = "expired";
        }
      }

      res.json({ status, expiresAt, username: conn.username });
    } catch (err: any) {
      console.error("[Instagram] Error checking status:", err.message);
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  // Disconnect (soft delete + revoke)
  app.delete("/api/instagram/connections/:id", async (req, res) => {
    try {
      const [conn] = await db
        .select()
        .from(instagramConnections)
        .where(eq(instagramConnections.id, parseInt(req.params.id)));
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      try {
        const token = decryptToken(conn.accessToken);
        await revokeAccess(token);
      } catch (err) {
        console.warn("[Instagram] Failed to revoke token at Meta, proceeding with local disconnect");
      }

      await db
        .update(instagramConnections)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(instagramConnections.id, conn.id));

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Instagram] Error disconnecting:", err.message);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // Sync (manual trigger)
  app.post("/api/instagram/connections/:id/sync", async (req, res) => {
    try {
      const [conn] = await db
        .select()
        .from(instagramConnections)
        .where(eq(instagramConnections.id, parseInt(req.params.id)));
      if (!conn) return res.status(404).json({ error: "Connection not found" });

      const token = decryptToken(conn.accessToken);

      // 1. Sync profile
      const profile = await syncProfile(conn.igUserId, token);

      // 2. Save metrics snapshot
      const today = new Date().toISOString().split("T")[0];
      let reachDay = 0;
      let impressionsDay = 0;

      try {
        const insights = await syncInsights(conn.igUserId, token, "day");
        for (const metric of insights) {
          if (metric.name === "reach") reachDay = metric.values?.[0]?.value || 0;
          if (metric.name === "impressions") impressionsDay = metric.values?.[0]?.value || 0;
        }
      } catch (err) {
        console.warn("[Instagram] Insights not available (may need 100+ followers)");
      }

      await db
        .insert(instagramMetricsSnapshots)
        .values({
          connectionId: conn.id,
          metricDate: today,
          followers: profile.followers_count || 0,
          following: profile.follows_count || 0,
          postsCount: profile.media_count || 0,
          reachDay,
          impressionsDay,
        })
        .onConflictDoUpdate({
          target: [instagramMetricsSnapshots.connectionId, instagramMetricsSnapshots.metricDate],
          set: {
            followers: profile.followers_count || 0,
            following: profile.follows_count || 0,
            postsCount: profile.media_count || 0,
            reachDay,
            impressionsDay,
            recordedAt: new Date(),
          },
        });

      // 3. Sync media + per-post insights
      const mediaList = await syncMedia(conn.igUserId, token, 50);
      let syncedPosts = 0;

      for (const post of mediaList) {
        const postInsights = await syncMediaInsights(post.id, token, post.media_type);

        await db
          .insert(instagramPostMetrics)
          .values({
            connectionId: conn.id,
            igMediaId: post.id,
            mediaType: post.media_type,
            caption: post.caption || null,
            permalink: post.permalink,
            thumbnailUrl: post.thumbnail_url || null,
            postedAt: post.timestamp ? new Date(post.timestamp) : null,
            likes: post.like_count || postInsights.likes || 0,
            comments: post.comments_count || postInsights.comments || 0,
            saves: postInsights.saved || 0,
            shares: postInsights.shares || 0,
            impressions: postInsights.impressions || 0,
            reach: postInsights.reach || 0,
            plays: postInsights.plays || 0,
            totalInteractions: postInsights.total_interactions || 0,
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: instagramPostMetrics.igMediaId,
            set: {
              likes: post.like_count || postInsights.likes || 0,
              comments: post.comments_count || postInsights.comments || 0,
              saves: postInsights.saved || 0,
              shares: postInsights.shares || 0,
              impressions: postInsights.impressions || 0,
              reach: postInsights.reach || 0,
              plays: postInsights.plays || 0,
              totalInteractions: postInsights.total_interactions || 0,
              lastSyncedAt: new Date(),
            },
          });

        syncedPosts++;
      }

      // Update connection timestamp
      await db
        .update(instagramConnections)
        .set({ updatedAt: new Date() })
        .where(eq(instagramConnections.id, conn.id));

      res.json({
        success: true,
        profile: { username: profile.username, followers: profile.followers_count },
        metrics: { reachDay, impressionsDay },
        postsSynced: syncedPosts,
      });
    } catch (err: any) {
      console.error("[Instagram] Sync error:", err.message);
      res.status(500).json({ error: `Sync failed: ${err.message}` });
    }
  });

  // Get profile data (latest snapshot)
  app.get("/api/instagram/connections/:id/profile", async (req, res) => {
    try {
      const [snapshot] = await db
        .select()
        .from(instagramMetricsSnapshots)
        .where(eq(instagramMetricsSnapshots.connectionId, parseInt(req.params.id)))
        .orderBy(desc(instagramMetricsSnapshots.metricDate))
        .limit(1);

      const [conn] = await db
        .select({
          username: instagramConnections.username,
          accountType: instagramConnections.accountType,
          igUserId: instagramConnections.igUserId,
        })
        .from(instagramConnections)
        .where(eq(instagramConnections.id, parseInt(req.params.id)));

      res.json({ connection: conn || null, latestSnapshot: snapshot || null });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get profile" });
    }
  });

  // Get metrics history
  app.get("/api/instagram/connections/:id/metrics", async (req, res) => {
    try {
      const snapshots = await db
        .select()
        .from(instagramMetricsSnapshots)
        .where(eq(instagramMetricsSnapshots.connectionId, parseInt(req.params.id)))
        .orderBy(desc(instagramMetricsSnapshots.metricDate))
        .limit(90);

      res.json(snapshots);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get metrics" });
    }
  });

  // Get posts
  app.get("/api/instagram/connections/:id/posts", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 25;
      const posts = await db
        .select()
        .from(instagramPostMetrics)
        .where(eq(instagramPostMetrics.connectionId, parseInt(req.params.id)))
        .orderBy(desc(instagramPostMetrics.postedAt))
        .limit(limit);

      res.json(posts);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get posts" });
    }
  });

  // --- OAuth Flow ---

  // Initiate OAuth
  app.get("/auth/instagram", (req, res) => {
    try {
      const clienteCnpj = req.query.clienteCnpj as string;
      if (!clienteCnpj) return res.status(400).json({ error: "clienteCnpj is required" });

      const config = {
        appId: process.env.META_INSTAGRAM_APP_ID!,
        redirectUri: process.env.META_INSTAGRAM_REDIRECT_URI!,
        apiVersion: process.env.META_GRAPH_API_VERSION || "v21.0",
      };

      // State = CSRF token + clienteCnpj + userId
      const stateData = {
        csrf: crypto.randomBytes(16).toString("hex"),
        cnpj: clienteCnpj,
        userId: (req as any).user?.id || "unknown",
      };
      const state = Buffer.from(JSON.stringify(stateData)).toString("base64url");

      // Store state in session for validation
      (req.session as any).instagramOAuthState = stateData.csrf;

      const scopes = [
        "instagram_basic",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ].join(",");

      const authUrl = `https://www.facebook.com/${config.apiVersion}/dialog/oauth?client_id=${config.appId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;

      res.redirect(authUrl);
    } catch (err: any) {
      console.error("[Instagram] OAuth init error:", err.message);
      res.status(500).json({ error: "Failed to initiate OAuth" });
    }
  });

  // OAuth Callback
  app.get("/auth/instagram/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;
      const frontendUrl = process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || "";

      if (error) {
        return res.redirect(`${frontendUrl}/growth/instagram?error=${error}`);
      }

      if (!code || !state) {
        return res.redirect(`${frontendUrl}/growth/instagram?error=missing_params`);
      }

      // Decode state
      const stateData = JSON.parse(Buffer.from(state as string, "base64url").toString());

      // Validate CSRF
      const savedCsrf = (req.session as any).instagramOAuthState;
      if (savedCsrf && savedCsrf !== stateData.csrf) {
        return res.redirect(`${frontendUrl}/growth/instagram?error=csrf_mismatch`);
      }
      delete (req.session as any).instagramOAuthState;

      // Exchange code for token
      const tokenResult = await exchangeCodeForToken(code as string);

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenResult.expiresIn);

      // Save connection
      await db.insert(instagramConnections).values({
        clienteCnpj: stateData.cnpj,
        igUserId: tokenResult.igUserId,
        username: tokenResult.username,
        accessToken: encryptToken(tokenResult.accessToken),
        tokenExpiresAt: expiresAt,
        accountType: tokenResult.accountType,
        scopes: ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement", "business_management"],
        connectedBy: stateData.userId,
        isActive: true,
      });

      res.redirect(`${frontendUrl}/growth/instagram?success=true&username=${tokenResult.username}`);
    } catch (err: any) {
      console.error("[Instagram] OAuth callback error:", err.message);
      const frontendUrl = process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || "";
      res.redirect(`${frontendUrl}/growth/instagram?error=${encodeURIComponent(err.message)}`);
    }
  });
}
```

**Step 2: Adicionar import e registro em routes.ts**

Em `server/routes.ts`, adicionar import após linha 49:
```typescript
import { registerInstagramRoutes } from "./routes/instagram";
```

Adicionar registro após linha 7525 (após `registerGrowthRoutes`):
```typescript
  // Instagram Module
  registerInstagramRoutes(app, db, storage);
```

**IMPORTANTE:** As rotas OAuth (`/auth/instagram` e `/auth/instagram/callback`) estão no mesmo arquivo mas são registradas pelo Express em ordem. Como `app.use("/api", isAuthenticated)` está na linha 425 e essas rotas não começam com `/api`, elas ficam acessíveis sem autenticação — que é correto para o callback do Meta. Porém, a rota `/auth/instagram` (initiate) precisa de sessão para o state CSRF. Como `registerInstagramRoutes` é chamado após a linha 7525 (depois do middleware), as rotas `/auth/instagram*` precisam ser montadas ANTES do middleware. Solução: montar as rotas OAuth antes da linha 425 (ver Step 2).

Na verdade, revisar: registrar `registerInstagramRoutes` na linha ~423 (antes do `app.use("/api", isAuthenticated)`), junto com `registerPortalCreatorRoutes`. As rotas `/api/instagram/*` dentro da função ainda serão protegidas pelo middleware global pois usam prefixo `/api`.

**Step 3: Commit**

```bash
git add server/routes/instagram.ts server/routes.ts
git commit -m "feat(instagram): add OAuth flow, sync endpoints and data API routes"
```

---

### Task 5: Navegação e permissões

**Files:**
- Modify: `shared/nav-config.ts:77` (permission key)
- Modify: `shared/nav-config.ts:249` (route mapping)
- Modify: `shared/nav-config.ts:456` (nav item)

**Step 1: Adicionar permission key**

Em `shared/nav-config.ts`, dentro do objeto `GROWTH` (após linha 77, antes do `}`):
```typescript
    INSTAGRAM: 'growth.instagram',
```

**Step 2: Adicionar route-to-permission mapping**

Após linha 249 (após `FUNIL_CONVERSAO`):
```typescript
  '/growth/instagram': PERMISSION_KEYS.GROWTH.INSTAGRAM,
```

**Step 3: Adicionar item no menu**

Após linha 456 (após item Keywords, antes do `]` do Growth):
```typescript
        { title: 'Instagram', url: '/growth/instagram', icon: 'Instagram', permissionKey: PERMISSION_KEYS.GROWTH.INSTAGRAM },
```

**Step 4: Commit**

```bash
git add shared/nav-config.ts
git commit -m "feat(instagram): add navigation, permissions and sidebar entry"
```

---

### Task 6: Frontend — Página de conexões

**Files:**
- Create: `client/src/pages/InstagramConexoes.tsx`
- Modify: `client/src/App.tsx:82` (lazy import)
- Modify: `client/src/App.tsx:349` (route)

**Step 1: Adicionar lazy import em App.tsx**

Após linha 82 (após `MetaAds`):
```typescript
const InstagramConexoes = lazyWithRetry(() => import("@/pages/InstagramConexoes"));
```

**Step 2: Adicionar Route em App.tsx**

Após linha 349 (após rotas do growth):
```typescript
      <Route path="/growth/instagram">{() => <ProtectedRoute path="/growth/instagram" component={InstagramConexoes} />}</Route>
```

**Step 3: Criar página InstagramConexoes.tsx**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Instagram, RefreshCw, Unlink, Plus, ExternalLink, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Connection {
  id: number;
  clienteCnpj: string;
  igUserId: string;
  username: string;
  accountType: string | null;
  tokenExpiresAt: string | null;
  connectedBy: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Cliente {
  cnpj: string;
  nome: string;
}

function getTokenStatus(expiresAt: string | null): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (!expiresAt) return { label: "Desconhecido", variant: "secondary" };
  const now = new Date();
  const exp = new Date(expiresAt);
  const daysLeft = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysLeft <= 0) return { label: "Expirado", variant: "destructive" };
  if (daysLeft <= 7) return { label: `Expira em ${Math.ceil(daysLeft)}d`, variant: "secondary" };
  return { label: "Válido", variant: "default" };
}

export default function InstagramConexoes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedCnpj, setSelectedCnpj] = useState<string>("");
  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const { data: connections = [], isLoading } = useQuery<Connection[]>({
    queryKey: ["/api/instagram/connections"],
  });

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ["/api/clientes/lista"],
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      setSyncingId(connectionId);
      const res = await fetch(`/api/instagram/connections/${connectionId}/sync`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Sincronização concluída", description: `${data.postsSynced} posts sincronizados` });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/connections"] });
      setSyncingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
      setSyncingId(null);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const res = await fetch(`/api/instagram/connections/${connectionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Conta desconectada" });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/connections"] });
      setDisconnectId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
      setDisconnectId(null);
    },
  });

  const handleConnect = () => {
    if (!selectedCnpj) return;
    window.location.href = `/auth/instagram?clienteCnpj=${encodeURIComponent(selectedCnpj)}`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Instagram className="h-7 w-7 text-pink-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Instagram</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400">Gerenciar conexões de contas de clientes</p>
          </div>
        </div>
        <Button onClick={() => setShowConnectDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Conexão
        </Button>
      </div>

      {/* Connection List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : connections.length === 0 ? (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Instagram className="h-12 w-12 text-gray-300 dark:text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Nenhuma conta conectada</h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
              Conecte a conta Instagram de um cliente para começar a coletar métricas.
            </p>
            <Button onClick={() => setShowConnectDialog(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Conectar conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((conn) => {
            const tokenStatus = getTokenStatus(conn.tokenExpiresAt);
            const isSyncing = syncingId === conn.id;
            const clienteNome = clientes.find((c) => c.cnpj === conn.clienteCnpj)?.nome || conn.clienteCnpj;

            return (
              <Card key={conn.id} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400">
                      <Instagram className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">@{conn.username}</span>
                        <Badge variant={tokenStatus.variant}>
                          {tokenStatus.variant === "default" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {tokenStatus.variant === "secondary" && <Clock className="h-3 w-3 mr-1" />}
                          {tokenStatus.variant === "destructive" && <AlertCircle className="h-3 w-3 mr-1" />}
                          {tokenStatus.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">
                        {clienteNome} · Última sync: {conn.updatedAt ? new Date(conn.updatedAt).toLocaleDateString("pt-BR") : "Nunca"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate(conn.id)}
                      disabled={isSyncing}
                      className="gap-1.5"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Sincronizando..." : "Sincronizar"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDisconnectId(conn.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 gap-1.5"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                      Desconectar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Connect Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Conectar Instagram</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-zinc-400">
              Selecione o cliente cuja conta Instagram será conectada.
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedCnpj} onValueChange={setSelectedCnpj}>
            <SelectTrigger className="bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700">
              <SelectValue placeholder="Selecione um cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.cnpj} value={c.cnpj}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConnect} disabled={!selectedCnpj} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Conectar via Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <AlertDialog open={disconnectId !== null} onOpenChange={() => setDisconnectId(null)}>
        <AlertDialogContent className="bg-white dark:bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Desconectar conta?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-zinc-400">
              O acesso será revogado e os dados não serão mais sincronizados. Os dados já coletados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectId && disconnectMutation.mutate(disconnectId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add client/src/pages/InstagramConexoes.tsx client/src/App.tsx
git commit -m "feat(instagram): add connections management page with OAuth flow UI"
```

---

### Task 7: Endpoint de lista de clientes (se não existir)

**Files:**
- Verify: `server/routes/clientes.ts` — checar se existe endpoint `GET /api/clientes/lista` que retorna `{cnpj, nome}`

**Step 1: Verificar se o endpoint existe**

Grep por `clientes/lista` ou endpoint equivalente que retorne lista simples de clientes.

**Step 2: Se não existir, adicionar**

Em `server/routes/clientes.ts`, adicionar:
```typescript
app.get("/api/clientes/lista", async (req, res) => {
  const result = await db
    .select({ cnpj: cupClientes.cnpj, nome: cupClientes.nome })
    .from(cupClientes)
    .where(isNotNull(cupClientes.cnpj))
    .orderBy(cupClientes.nome);
  res.json(result);
});
```

**Step 3: Commit (se necessário)**

```bash
git add server/routes/clientes.ts
git commit -m "feat(clientes): add simple list endpoint for client dropdown"
```

---

### Task 8: Variáveis de ambiente e documentação

**Files:**
- Modify: `.env` (local — adicionar variáveis)

**Step 1: Adicionar variáveis necessárias ao .env local**

```env
# Instagram Analytics (Meta Graph API)
META_INSTAGRAM_APP_ID=
META_INSTAGRAM_APP_SECRET=
META_INSTAGRAM_REDIRECT_URI=http://localhost:3000/auth/instagram/callback
META_GRAPH_API_VERSION=v21.0
INSTAGRAM_ENCRYPTION_KEY=
```

Gerar encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Step 2: Commit**

Não commitar .env. Verificar se .gitignore já ignora .env.

---

### Task 9: Teste end-to-end manual

**Step 1: Reiniciar dev server**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

**Step 2: Verificar que as tabelas foram criadas**

Acessar o banco e confirmar que existem:
- `cortex_core.instagram_connections`
- `cortex_core.instagram_metrics_snapshots`
- `cortex_core.instagram_post_metrics`

**Step 3: Acessar a página no browser**

Navegar para `/growth/instagram` e verificar:
- [ ] Página carrega sem erros
- [ ] Estado vazio aparece corretamente
- [ ] Dark mode e light mode funcionam
- [ ] Botão "Nova Conexão" abre o dialog
- [ ] Dropdown de clientes carrega
- [ ] Item aparece no sidebar sob Growth

**Step 4: Testar OAuth (requer Meta App configurado)**

- [ ] Selecionar cliente e clicar "Conectar via Meta"
- [ ] Redirect para Facebook OAuth funciona
- [ ] Callback salva conexão no banco
- [ ] Conexão aparece na lista
- [ ] Botão "Sincronizar" coleta dados
- [ ] Botão "Desconectar" remove conexão

**Step 5: Commit final se houver ajustes**

```bash
git add -A
git commit -m "fix(instagram): adjustments from manual testing"
```
