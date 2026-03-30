import type { Express } from "express";
import crypto from "crypto";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import type { IStorage } from "../storage";
import {
  instagramConnections,
  instagramMetricsSnapshots,
  instagramPostMetrics,
} from "../../shared/schema";
import { encryptToken, decryptToken } from "../utils/encryption";
import {
  exchangeCodeForToken,
  syncProfile,
  syncInsights,
  syncMedia,
  syncMediaInsights,
  revokeAccess,
  callGraphAPI,
} from "../services/instagramSync";

export function registerInstagramRoutes(app: Express, db: any, _storage: IStorage) {
  // ─── OAuth routes (no /api prefix — accessible without auth) ─────────

  /**
   * GET /auth/instagram?clienteCnpj=XXX
   * Build Meta OAuth URL, store CSRF state in session, redirect to Facebook
   */
  app.get("/auth/instagram", (req, res) => {
    try {
      const clienteCnpj = req.query.clienteCnpj as string;
      if (!clienteCnpj) {
        return res.status(400).json({ error: "clienteCnpj query parameter is required" });
      }

      const appId = process.env.META_INSTAGRAM_APP_ID;
      const redirectUri = process.env.META_INSTAGRAM_REDIRECT_URI;
      if (!appId || !redirectUri) {
        return res.status(500).json({ error: "Instagram OAuth not configured" });
      }

      const csrf = crypto.randomBytes(32).toString("hex");
      const userId = (req as any).user?.id || "anonymous";

      // Store CSRF in session for validation on callback
      (req.session as any).instagramOAuthState = csrf;

      const statePayload = JSON.stringify({ csrf, cnpj: clienteCnpj, userId });
      const state = Buffer.from(statePayload).toString("base64url");

      const scopes = [
        "instagram_business_basic",
        "instagram_business_manage_insights",
      ].join(",");

      // Use Instagram Login flow (not Facebook Login)
      const authUrl = new URL("https://www.instagram.com/oauth/authorize");
      authUrl.searchParams.set("client_id", appId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", scopes);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("force_reauth", "true");

      return res.redirect(authUrl.toString());
    } catch (err: any) {
      console.error("[Instagram OAuth] Error building auth URL:", err);
      return res.status(500).json({ error: "Failed to initiate OAuth" });
    }
  });

  /**
   * GET /auth/instagram/callback
   * Receive code from Facebook, exchange for token, save connection to DB
   */
  app.get("/auth/instagram/callback", async (req, res) => {
    const customDomain = process.env.CUSTOM_DOMAIN;
    const frontendUrl = customDomain
      ? `https://${customDomain}`
      : process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || "";
    const frontendPath = "/growth/instagram";

    try {
      const code = req.query.code as string;
      const stateParam = req.query.state as string;
      const errorParam = req.query.error as string;

      if (errorParam) {
        console.error("[Instagram OAuth] User denied access:", errorParam);
        return res.redirect(`${frontendUrl}${frontendPath}?error=access_denied`);
      }

      if (!code || !stateParam) {
        return res.redirect(`${frontendUrl}${frontendPath}?error=missing_params`);
      }

      // Decode and validate state
      let stateData: { csrf: string; cnpj: string; userId: string };
      try {
        stateData = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
      } catch {
        return res.redirect(`${frontendUrl}${frontendPath}?error=invalid_state`);
      }

      const sessionCsrf = (req.session as any).instagramOAuthState;
      if (!sessionCsrf || sessionCsrf !== stateData.csrf) {
        console.error("[Instagram OAuth] CSRF mismatch");
        return res.redirect(`${frontendUrl}${frontendPath}?error=csrf_mismatch`);
      }

      // Clear CSRF from session
      delete (req.session as any).instagramOAuthState;

      // Exchange code for token
      const tokenResult = await exchangeCodeForToken(code);

      const expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000);

      // Upsert connection (by igUserId + cnpj)
      const existing = await db
        .select()
        .from(instagramConnections)
        .where(
          and(
            eq(instagramConnections.igUserId, tokenResult.igUserId),
            eq(instagramConnections.clienteCnpj, stateData.cnpj),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(instagramConnections)
          .set({
            accessToken: encryptToken(tokenResult.accessToken),
            tokenExpiresAt: expiresAt,
            username: tokenResult.username,
            accountType: tokenResult.accountType,
            isActive: true,
            connectedBy: stateData.userId,
            updatedAt: new Date(),
          })
          .where(eq(instagramConnections.id, existing[0].id));
      } else {
        await db.insert(instagramConnections).values({
          clienteCnpj: stateData.cnpj,
          igUserId: tokenResult.igUserId,
          username: tokenResult.username,
          accessToken: encryptToken(tokenResult.accessToken),
          tokenExpiresAt: expiresAt,
          accountType: tokenResult.accountType,
          scopes: [
            "instagram_business_basic",
            "instagram_business_manage_insights",
          ],
          connectedBy: stateData.userId,
          isActive: true,
        });
      }

      console.log(`[Instagram OAuth] Connection saved for @${tokenResult.username} (CNPJ: ${stateData.cnpj})`);
      return res.redirect(`${frontendUrl}${frontendPath}?connected=true&username=${tokenResult.username}`);
    } catch (err: any) {
      console.error("[Instagram OAuth] Callback error:", err.message || err);
      const errorMsg = encodeURIComponent(err.message || "token_exchange_failed");
      return res.redirect(`${frontendUrl}${frontendPath}?error=${errorMsg}`);
    }
  });

  // ─── API routes (protected by global isAuthenticated middleware) ──────

  /**
   * GET /api/instagram/connections
   * List active connections (optional ?cnpj filter)
   */
  app.get("/api/instagram/connections", async (req, res) => {
    try {
      const cnpj = req.query.cnpj as string;

      const conditions = [eq(instagramConnections.isActive, true)];
      if (cnpj) {
        conditions.push(eq(instagramConnections.clienteCnpj, cnpj));
      }

      const rows = await db
        .select({
          id: instagramConnections.id,
          clienteCnpj: instagramConnections.clienteCnpj,
          igUserId: instagramConnections.igUserId,
          username: instagramConnections.username,
          tokenExpiresAt: instagramConnections.tokenExpiresAt,
          accountType: instagramConnections.accountType,
          scopes: instagramConnections.scopes,
          connectedBy: instagramConnections.connectedBy,
          isActive: instagramConnections.isActive,
          createdAt: instagramConnections.createdAt,
          updatedAt: instagramConnections.updatedAt,
        })
        .from(instagramConnections)
        .where(and(...conditions))
        .orderBy(desc(instagramConnections.createdAt));

      return res.json(rows);
    } catch (err: any) {
      console.error("[Instagram] Error listing connections:", err);
      return res.status(500).json({ error: "Failed to list connections" });
    }
  });

  /**
   * GET /api/instagram/connections/:id
   * Connection detail (excludes accessToken)
   */
  app.get("/api/instagram/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

      const rows = await db
        .select({
          id: instagramConnections.id,
          clienteCnpj: instagramConnections.clienteCnpj,
          igUserId: instagramConnections.igUserId,
          username: instagramConnections.username,
          tokenExpiresAt: instagramConnections.tokenExpiresAt,
          accountType: instagramConnections.accountType,
          scopes: instagramConnections.scopes,
          connectedBy: instagramConnections.connectedBy,
          isActive: instagramConnections.isActive,
          createdAt: instagramConnections.createdAt,
          updatedAt: instagramConnections.updatedAt,
        })
        .from(instagramConnections)
        .where(eq(instagramConnections.id, id))
        .limit(1);

      if (rows.length === 0) return res.status(404).json({ error: "Connection not found" });
      return res.json(rows[0]);
    } catch (err: any) {
      console.error("[Instagram] Error fetching connection:", err);
      return res.status(500).json({ error: "Failed to fetch connection" });
    }
  });

  /**
   * GET /api/instagram/connections/:id/status
   * Validate token: check expiry + test API call
   */
  app.get("/api/instagram/connections/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

      const rows = await db
        .select()
        .from(instagramConnections)
        .where(eq(instagramConnections.id, id))
        .limit(1);

      if (rows.length === 0) return res.status(404).json({ error: "Connection not found" });

      const conn = rows[0];
      const now = new Date();
      const expiresAt = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt) : null;
      const isExpired = expiresAt ? expiresAt <= now : false;
      const daysUntilExpiry = expiresAt
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let apiValid = false;
      if (!isExpired) {
        try {
          const token = decryptToken(conn.accessToken);
          await callGraphAPI(`/${conn.igUserId}`, token, { fields: "id" });
          apiValid = true;
        } catch {
          apiValid = false;
        }
      }

      return res.json({
        id: conn.id,
        username: conn.username,
        isActive: conn.isActive,
        tokenExpired: isExpired,
        daysUntilExpiry,
        apiValid,
        status: !conn.isActive ? "inactive" : isExpired ? "expired" : apiValid ? "healthy" : "error",
      });
    } catch (err: any) {
      console.error("[Instagram] Error checking status:", err);
      return res.status(500).json({ error: "Failed to check connection status" });
    }
  });

  /**
   * DELETE /api/instagram/connections/:id
   * Revoke token at Meta + soft delete
   */
  app.delete("/api/instagram/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

      const rows = await db
        .select()
        .from(instagramConnections)
        .where(eq(instagramConnections.id, id))
        .limit(1);

      if (rows.length === 0) return res.status(404).json({ error: "Connection not found" });

      const conn = rows[0];

      // Attempt to revoke at Meta (best-effort)
      try {
        const token = decryptToken(conn.accessToken);
        await revokeAccess(token);
      } catch (revokeErr: any) {
        console.warn("[Instagram] Token revocation failed (continuing with soft delete):", revokeErr.message);
      }

      // Soft delete
      await db
        .update(instagramConnections)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(instagramConnections.id, id));

      console.log(`[Instagram] Connection ${id} (@${conn.username}) soft deleted`);
      return res.json({ success: true, message: "Connection removed" });
    } catch (err: any) {
      console.error("[Instagram] Error deleting connection:", err);
      return res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  /**
   * POST /api/instagram/connections/:id/sync
   * Full sync: profile + insights snapshot + media + per-post insights
   */
  app.post("/api/instagram/connections/:id/sync", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

      const rows = await db
        .select()
        .from(instagramConnections)
        .where(and(eq(instagramConnections.id, id), eq(instagramConnections.isActive, true)))
        .limit(1);

      if (rows.length === 0) return res.status(404).json({ error: "Connection not found or inactive" });

      const conn = rows[0];
      const token = decryptToken(conn.accessToken);
      const today = new Date().toISOString().split("T")[0];

      // 1. Sync profile
      const profile = await syncProfile(conn.igUserId, token);

      // Update connection username if changed
      if (profile.username && profile.username !== conn.username) {
        await db
          .update(instagramConnections)
          .set({ username: profile.username, updatedAt: new Date() })
          .where(eq(instagramConnections.id, id));
      }

      // 2. Sync insights
      let reachDay = 0;
      let impressionsDay = 0;
      let profileViews = 0;
      let websiteClicks = 0;
      try {
        const insights = await syncInsights(conn.igUserId, token);
        for (const metric of insights) {
          if (metric.name === "reach") reachDay = metric.values?.[0]?.value || 0;
          if (metric.name === "impressions") impressionsDay = metric.values?.[0]?.value || 0;
          if (metric.name === "profile_views") profileViews = metric.values?.[0]?.value || 0;
          if (metric.name === "website_clicks") websiteClicks = metric.values?.[0]?.value || 0;
        }
      } catch (insightsErr: any) {
        console.warn("[Instagram] Insights sync partial failure:", insightsErr.message);
      }

      // 3. Upsert metrics snapshot
      await db
        .insert(instagramMetricsSnapshots)
        .values({
          connectionId: id,
          metricDate: today,
          followers: profile.followers_count || 0,
          following: profile.follows_count || 0,
          postsCount: profile.media_count || 0,
          reachDay,
          impressionsDay,
          profileViews,
          websiteClicks,
        })
        .onConflictDoUpdate({
          target: [instagramMetricsSnapshots.connectionId, instagramMetricsSnapshots.metricDate],
          set: {
            followers: sql`EXCLUDED.followers`,
            following: sql`EXCLUDED.following`,
            postsCount: sql`EXCLUDED.posts_count`,
            reachDay: sql`EXCLUDED.reach_day`,
            impressionsDay: sql`EXCLUDED.impressions_day`,
            profileViews: sql`EXCLUDED.profile_views`,
            websiteClicks: sql`EXCLUDED.website_clicks`,
            recordedAt: sql`NOW()`,
          },
        });

      // 4. Sync media
      const mediaItems = await syncMedia(conn.igUserId, token);
      let postsUpserted = 0;

      for (const item of mediaItems) {
        // 5. Get per-post insights
        const postInsights = await syncMediaInsights(item.id, token, item.media_type);

        await db
          .insert(instagramPostMetrics)
          .values({
            connectionId: id,
            igMediaId: item.id,
            mediaType: item.media_type,
            caption: item.caption || null,
            permalink: item.permalink,
            thumbnailUrl: item.thumbnail_url || null,
            postedAt: item.timestamp ? new Date(item.timestamp) : null,
            likes: postInsights.likes ?? item.like_count ?? 0,
            comments: postInsights.comments ?? item.comments_count ?? 0,
            saves: postInsights.saved ?? 0,
            shares: postInsights.shares ?? 0,
            impressions: postInsights.impressions ?? 0,
            reach: postInsights.reach ?? 0,
            plays: postInsights.plays ?? 0,
            totalInteractions: postInsights.total_interactions ?? 0,
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [instagramPostMetrics.igMediaId],
            set: {
              likes: sql`EXCLUDED.likes`,
              comments: sql`EXCLUDED.comments`,
              saves: sql`EXCLUDED.saves`,
              shares: sql`EXCLUDED.shares`,
              impressions: sql`EXCLUDED.impressions`,
              reach: sql`EXCLUDED.reach`,
              plays: sql`EXCLUDED.plays`,
              totalInteractions: sql`EXCLUDED.total_interactions`,
              lastSyncedAt: sql`EXCLUDED.last_synced_at`,
              caption: sql`EXCLUDED.caption`,
              thumbnailUrl: sql`EXCLUDED.thumbnail_url`,
            },
          });

        postsUpserted++;
      }

      // Update connection timestamp
      await db
        .update(instagramConnections)
        .set({ updatedAt: new Date() })
        .where(eq(instagramConnections.id, id));

      console.log(`[Instagram] Sync complete for @${conn.username}: profile + ${postsUpserted} posts`);
      return res.json({
        success: true,
        profile: {
          username: profile.username,
          followers: profile.followers_count,
          following: profile.follows_count,
          posts: profile.media_count,
        },
        metricsSnapshot: { reachDay, impressionsDay, profileViews, websiteClicks },
        postsUpserted,
      });
    } catch (err: any) {
      console.error("[Instagram] Sync error:", err);
      return res.status(500).json({ error: `Sync failed: ${err.message}` });
    }
  });

  /**
   * GET /api/instagram/connections/:id/profile
   * Latest snapshot + connection info
   */
  app.get("/api/instagram/connections/:id/profile", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

      const connRows = await db
        .select({
          id: instagramConnections.id,
          clienteCnpj: instagramConnections.clienteCnpj,
          igUserId: instagramConnections.igUserId,
          username: instagramConnections.username,
          accountType: instagramConnections.accountType,
          isActive: instagramConnections.isActive,
          createdAt: instagramConnections.createdAt,
          updatedAt: instagramConnections.updatedAt,
        })
        .from(instagramConnections)
        .where(eq(instagramConnections.id, id))
        .limit(1);

      if (connRows.length === 0) return res.status(404).json({ error: "Connection not found" });

      const latestSnapshot = await db
        .select()
        .from(instagramMetricsSnapshots)
        .where(eq(instagramMetricsSnapshots.connectionId, id))
        .orderBy(desc(instagramMetricsSnapshots.metricDate))
        .limit(1);

      return res.json({
        connection: connRows[0],
        latestMetrics: latestSnapshot[0] || null,
      });
    } catch (err: any) {
      console.error("[Instagram] Error fetching profile:", err);
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  /**
   * GET /api/instagram/connections/:id/metrics
   * Historical snapshots (last 90 days by default, configurable via ?days=N)
   */
  app.get("/api/instagram/connections/:id/metrics", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

      const days = parseInt(req.query.days as string, 10) || 90;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      const sinceDateStr = sinceDate.toISOString().split("T")[0];

      const rows = await db
        .select()
        .from(instagramMetricsSnapshots)
        .where(
          and(
            eq(instagramMetricsSnapshots.connectionId, id),
            gte(instagramMetricsSnapshots.metricDate, sinceDateStr),
          ),
        )
        .orderBy(instagramMetricsSnapshots.metricDate);

      return res.json(rows);
    } catch (err: any) {
      console.error("[Instagram] Error fetching metrics:", err);
      return res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  /**
   * GET /api/instagram/connections/:id/posts
   * Posts with metrics (limit param, default 50)
   */
  app.get("/api/instagram/connections/:id/posts", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);

      const rows = await db
        .select()
        .from(instagramPostMetrics)
        .where(eq(instagramPostMetrics.connectionId, id))
        .orderBy(desc(instagramPostMetrics.postedAt))
        .limit(limit);

      return res.json(rows);
    } catch (err: any) {
      console.error("[Instagram] Error fetching posts:", err);
      return res.status(500).json({ error: "Failed to fetch posts" });
    }
  });
}
