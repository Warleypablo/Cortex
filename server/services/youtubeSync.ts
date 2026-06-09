/**
 * YouTube sync service.
 *
 * Para cada canal autorizado em `youtube.channels` (com `credential_id`):
 *  - syncChannelMetadata: snapshot atual (subs, views, videoCount) → youtube.channels
 *  - syncVideos:          lista vídeos via uploads playlist → youtube.videos
 *  - syncChannelDailyMetrics: métricas diárias por canal (Analytics API)
 *  - syncVideoDailyMetrics:   métricas diárias por vídeo  (Analytics API)
 *
 * Reaproveita o OAuth client web "Data Central" (GOOGLE_CLIENT_ID/SECRET) e
 * o refresh_token salvo em youtube.credentials.
 */

import { google, youtube_v3, youtubeAnalytics_v2 } from 'googleapis';
import { sql } from 'drizzle-orm';
import { decryptToken } from '../utils/encryption';

interface ChannelRow {
  channel_id: string;
  credential_id: number;
  refresh_token: string; // já decriptado pelo fetchAuthorizedChannels
}

export interface YoutubeSyncResult {
  channelsProcessed: number;
  videosUpserted: number;
  videoDailyRowsUpserted: number;
  channelDailyRowsUpserted: number;
  errors: string[];
}

function getAuthFor(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID/SECRET ausentes — necessários pro YouTube (Data Central)');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

async function logRun(db: any, jobType: string, channelId: string | null, fn: () => Promise<number>): Promise<number> {
  const startRes = await db.execute(sql`
    INSERT INTO youtube.sync_runs (job_type, channel_id, status, started_at)
    VALUES (${jobType}, ${channelId}, 'running', NOW())
    RETURNING id
  `);
  const runId = (startRes as any).rows?.[0]?.id ?? (startRes as any)[0]?.id;
  try {
    const items = await fn();
    await db.execute(sql`
      UPDATE youtube.sync_runs
      SET status = 'success', finished_at = NOW(), items_processed = ${items}
      WHERE id = ${runId}
    `);
    return items;
  } catch (e: any) {
    await db.execute(sql`
      UPDATE youtube.sync_runs
      SET status = 'error', finished_at = NOW(), error_message = ${e.message}
      WHERE id = ${runId}
    `);
    throw e;
  }
}

async function fetchAuthorizedChannels(db: any): Promise<ChannelRow[]> {
  const r = await db.execute(sql`
    SELECT c.channel_id, c.credential_id, cred.refresh_token_enc
    FROM youtube.channels c
    JOIN youtube.credentials cred ON cred.id = c.credential_id
    WHERE cred.active = TRUE
    ORDER BY c.title
  `);
  const rows = ((r as any).rows || r) as Array<{ channel_id: string; credential_id: number; refresh_token_enc: string }>;
  return rows.map((row) => ({
    channel_id: row.channel_id,
    credential_id: row.credential_id,
    refresh_token: decryptToken(row.refresh_token_enc),
  }));
}

// ============================================================
// Channel metadata (snapshot atual)
// ============================================================
export async function syncChannelMetadata(db: any, channel: ChannelRow): Promise<number> {
  return logRun(db, 'channel_metadata', channel.channel_id, async () => {
    const yt = google.youtube({ version: 'v3', auth: getAuthFor(channel.refresh_token) });
    const r = await yt.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: [channel.channel_id],
    });
    const ch = r.data.items?.[0];
    if (!ch) return 0;
    const snippet = ch.snippet || {};
    const stats = ch.statistics || {};
    await db.execute(sql`
      UPDATE youtube.channels SET
        title = ${snippet.title || null},
        custom_url = ${snippet.customUrl || null},
        description = ${snippet.description || null},
        thumbnail_url = ${snippet.thumbnails?.default?.url || null},
        country = ${snippet.country || null},
        published_at = ${snippet.publishedAt ? new Date(snippet.publishedAt) : null},
        subscriber_count = ${stats.subscriberCount ? Number(stats.subscriberCount) : null},
        view_count = ${stats.viewCount ? Number(stats.viewCount) : null},
        video_count = ${stats.videoCount ? Number(stats.videoCount) : null},
        hidden_subscriber_count = ${stats.hiddenSubscriberCount ?? null},
        synced_at = NOW()
      WHERE channel_id = ${channel.channel_id}
    `);
    return 1;
  });
}

// ============================================================
// Videos (lista + snapshot de counters cumulativos)
// ============================================================
export async function syncVideos(db: any, channel: ChannelRow): Promise<number> {
  return logRun(db, 'videos', channel.channel_id, async () => {
    const auth = getAuthFor(channel.refresh_token);
    const yt = google.youtube({ version: 'v3', auth });

    // Pega a uploads playlist do canal
    const chR = await yt.channels.list({ part: ['contentDetails'], id: [channel.channel_id] });
    const uploadsPlaylistId = chR.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return 0;

    // Lista todos os videoIds da uploads playlist (paginado)
    const videoIds: string[] = [];
    let pageToken: string | undefined;
    do {
      const pr = await yt.playlistItems.list({
        part: ['contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken,
      });
      for (const it of pr.data.items || []) {
        const vid = it.contentDetails?.videoId;
        if (vid) videoIds.push(vid);
      }
      pageToken = pr.data.nextPageToken || undefined;
    } while (pageToken);

    // Em batches de 50, busca detalhes dos vídeos
    let upserts = 0;
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const vr = await yt.videos.list({
        part: ['snippet', 'contentDetails', 'statistics'],
        id: batch,
      });
      for (const v of vr.data.items || []) {
        const sn = v.snippet || {};
        const st = v.statistics || {};
        const cd = v.contentDetails || {};
        await db.execute(sql`
          INSERT INTO youtube.videos (
            video_id, channel_id, title, description, published_at, thumbnail_url,
            duration_seconds, tags, category_id, default_language, live_broadcast_content,
            view_count, like_count, comment_count, favorite_count, synced_at
          ) VALUES (
            ${v.id!},
            ${channel.channel_id},
            ${sn.title || null},
            ${sn.description || null},
            ${sn.publishedAt ? new Date(sn.publishedAt) : null},
            ${sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || null},
            ${cd.duration ? parseIsoDurationSeconds(cd.duration) : null},
            ${sn.tags ? JSON.stringify(sn.tags) : null}::jsonb,
            ${sn.categoryId || null},
            ${sn.defaultLanguage || null},
            ${sn.liveBroadcastContent || null},
            ${st.viewCount ? Number(st.viewCount) : null},
            ${st.likeCount ? Number(st.likeCount) : null},
            ${st.commentCount ? Number(st.commentCount) : null},
            ${st.favoriteCount ? Number(st.favoriteCount) : null},
            NOW()
          )
          ON CONFLICT (video_id) DO UPDATE
            SET title = EXCLUDED.title,
                description = EXCLUDED.description,
                thumbnail_url = EXCLUDED.thumbnail_url,
                duration_seconds = EXCLUDED.duration_seconds,
                tags = EXCLUDED.tags,
                category_id = EXCLUDED.category_id,
                view_count = EXCLUDED.view_count,
                like_count = EXCLUDED.like_count,
                comment_count = EXCLUDED.comment_count,
                favorite_count = EXCLUDED.favorite_count,
                synced_at = NOW()
        `);
        upserts++;
      }
    }
    return upserts;
  });
}

// ============================================================
// Channel daily metrics (Analytics API)
// ============================================================
export async function syncChannelDailyMetrics(
  db: any,
  channel: ChannelRow,
  startDate: string,
  endDate: string,
): Promise<number> {
  return logRun(db, 'channel_daily_metrics', channel.channel_id, async () => {
    const analytics = google.youtubeAnalytics({ version: 'v2', auth: getAuthFor(channel.refresh_token) });
    const r = await analytics.reports.query({
      ids: `channel==${channel.channel_id}`,
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares',
      dimensions: 'day',
    });
    const rows = r.data.rows || [];
    for (const row of rows) {
      const [day, views, mw, avgDur, subG, subL, likes, comments, shares] = row as any[];
      await db.execute(sql`
        INSERT INTO youtube.channel_daily_metrics (
          channel_id, report_date, views, estimated_minutes_watched, average_view_duration,
          subscribers_gained, subscribers_lost, likes, comments, shares, synced_at
        ) VALUES (
          ${channel.channel_id}, ${day}, ${views}, ${mw}, ${avgDur},
          ${subG}, ${subL}, ${likes}, ${comments}, ${shares}, NOW()
        )
        ON CONFLICT (channel_id, report_date) DO UPDATE
          SET views = EXCLUDED.views,
              estimated_minutes_watched = EXCLUDED.estimated_minutes_watched,
              average_view_duration = EXCLUDED.average_view_duration,
              subscribers_gained = EXCLUDED.subscribers_gained,
              subscribers_lost = EXCLUDED.subscribers_lost,
              likes = EXCLUDED.likes,
              comments = EXCLUDED.comments,
              shares = EXCLUDED.shares,
              synced_at = NOW()
      `);
    }
    return rows.length;
  });
}

// ============================================================
// Video daily metrics (Analytics API, dimensão video × day)
// ============================================================
export async function syncVideoDailyMetrics(
  db: any,
  channel: ChannelRow,
  startDate: string,
  endDate: string,
): Promise<number> {
  return logRun(db, 'video_daily_metrics', channel.channel_id, async () => {
    const analytics = google.youtubeAnalytics({ version: 'v2', auth: getAuthFor(channel.refresh_token) });
    // YouTube Analytics retorna no máximo ~10k rows por chamada — paginação por startIndex
    let upserts = 0;
    let startIndex = 1;
    const maxRows = 10000;
    while (true) {
      const r = await analytics.reports.query({
        ids: `channel==${channel.channel_id}`,
        startDate,
        endDate,
        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost,cardClicks,cardImpressions',
        dimensions: 'video,day',
        maxResults: maxRows,
        startIndex,
      });
      const rows = r.data.rows || [];
      if (rows.length === 0) break;
      for (const row of rows) {
        const [videoId, day, views, mw, avgDur, avgPct, likes, comments, shares, subG, subL, cardClicks, cardImps] = row as any[];
        await db.execute(sql`
          INSERT INTO youtube.video_daily_metrics (
            video_id, channel_id, report_date, views, estimated_minutes_watched,
            average_view_duration, average_view_percentage, likes, comments, shares,
            subscribers_gained, subscribers_lost, card_clicks, card_impressions, synced_at
          ) VALUES (
            ${videoId}, ${channel.channel_id}, ${day}, ${views}, ${mw},
            ${avgDur}, ${avgPct}, ${likes}, ${comments}, ${shares},
            ${subG}, ${subL}, ${cardClicks}, ${cardImps}, NOW()
          )
          ON CONFLICT (video_id, report_date) DO UPDATE
            SET views = EXCLUDED.views,
                estimated_minutes_watched = EXCLUDED.estimated_minutes_watched,
                average_view_duration = EXCLUDED.average_view_duration,
                average_view_percentage = EXCLUDED.average_view_percentage,
                likes = EXCLUDED.likes,
                comments = EXCLUDED.comments,
                shares = EXCLUDED.shares,
                subscribers_gained = EXCLUDED.subscribers_gained,
                subscribers_lost = EXCLUDED.subscribers_lost,
                card_clicks = EXCLUDED.card_clicks,
                card_impressions = EXCLUDED.card_impressions,
                synced_at = NOW()
        `);
        upserts++;
      }
      if (rows.length < maxRows) break;
      startIndex += rows.length;
    }
    return upserts;
  });
}

// ============================================================
// Driver: sincroniza todos os canais autorizados
// ============================================================
export async function syncAllChannels(
  db: any,
  opts: { startDate: string; endDate: string; skipVideos?: boolean } = {
    startDate: defaultStartDate(),
    endDate: today(),
  },
): Promise<YoutubeSyncResult> {
  const result: YoutubeSyncResult = {
    channelsProcessed: 0,
    videosUpserted: 0,
    videoDailyRowsUpserted: 0,
    channelDailyRowsUpserted: 0,
    errors: [],
  };
  const channels = await fetchAuthorizedChannels(db);
  for (const ch of channels) {
    try {
      await syncChannelMetadata(db, ch);
      if (!opts.skipVideos) {
        result.videosUpserted += await syncVideos(db, ch);
      }
      result.channelDailyRowsUpserted += await syncChannelDailyMetrics(db, ch, opts.startDate, opts.endDate);
      result.videoDailyRowsUpserted += await syncVideoDailyMetrics(db, ch, opts.startDate, opts.endDate);
      result.channelsProcessed++;
      // Atualiza last_used_at da credential
      await db.execute(sql`
        UPDATE youtube.credentials SET last_used_at = NOW() WHERE id = ${ch.credential_id}
      `);
    } catch (e: any) {
      result.errors.push(`${ch.channel_id}: ${e.message}`);
    }
  }
  return result;
}

// ============================================================
// Helpers
// ============================================================
function parseIsoDurationSeconds(iso: string): number | null {
  // ex: PT1H2M30S → 3750
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10);
  const mm = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + mm * 60 + s;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
