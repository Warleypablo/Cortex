/**
 * Backfill histórico do Instagram para todas as conexões ativas.
 *
 * Uso:
 *   npx tsx scripts/backfill-instagram-historical.ts            # 60 dias
 *   npx tsx scripts/backfill-instagram-historical.ts --days=30
 *   npx tsx scripts/backfill-instagram-historical.ts --connection-id=2 --days=90
 *
 * Faz ~2 chamadas Graph API por dia por conexão. Para 60 dias × 1 conexão = ~120 calls.
 * Insere/atualiza em cortex_core.instagram_metrics_snapshots via UPSERT.
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';
import { syncProfile, syncInsightsHistorical } from '../server/services/instagramSync';
import { decryptToken } from '../server/utils/encryption';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

function parseArgs(): { connectionId?: number; days: number } {
  const args = process.argv.slice(2);
  let connectionId: number | undefined;
  let days = 60;
  for (const a of args) {
    if (a.startsWith('--days=')) days = parseInt(a.split('=')[1], 10);
    if (a.startsWith('--connection-id=')) connectionId = parseInt(a.split('=')[1], 10);
  }
  return { connectionId, days };
}

async function main() {
  const { connectionId, days } = parseArgs();
  console.log(`[Backfill IG] dias=${days}${connectionId ? ` conexão=${connectionId}` : ' (todas ativas)'}`);

  const where = connectionId ? `id = ${connectionId}` : 'is_active = true';
  const conns = await pool.query(
    `SELECT id, ig_user_id, username, access_token FROM cortex_core.instagram_connections WHERE ${where}`
  );
  if (conns.rows.length === 0) {
    console.log('Nenhuma conexão encontrada.');
    process.exit(0);
  }

  for (const conn of conns.rows) {
    const id = conn.id as number;
    const igUserId = conn.ig_user_id as string;
    const username = conn.username as string;
    let token: string;
    try {
      token = decryptToken(conn.access_token);
    } catch (e: any) {
      console.error(`[Backfill IG] Erro decriptando token de ${username} (id=${id}):`, e.message);
      continue;
    }

    console.log(`\n=== Conexão ${id} (${username}) ===`);
    let profile: any;
    try {
      profile = await syncProfile(igUserId, token);
      console.log(`Perfil: ${profile.username}, ${profile.followers_count} seguidores`);
    } catch (e: any) {
      console.error('Erro buscando perfil:', e.message);
      continue;
    }

    let historical: Awaited<ReturnType<typeof syncInsightsHistorical>>;
    try {
      historical = await syncInsightsHistorical(igUserId, token, days);
    } catch (e: any) {
      console.error('Erro buscando insights:', e.message);
      continue;
    }

    if (historical.length === 0) {
      console.log('Nenhum dado retornado.');
      continue;
    }

    // Reconstrói followers absolutos (follower_count vem como delta diário em time_series)
    const currentFollowers = profile.followers_count || 0;
    let cumulativeDelta = 0;
    const reversed = [...historical].reverse();
    const absoluteFollowers: Record<string, number> = {};
    for (const day of reversed) {
      absoluteFollowers[day.date] = currentFollowers - cumulativeDelta;
      cumulativeDelta += day.followers;
    }

    let inserted = 0;
    for (const day of historical) {
      try {
        await pool.query(
          `INSERT INTO cortex_core.instagram_metrics_snapshots
            (connection_id, metric_date, followers, following, posts_count,
             reach_day, impressions_day, follows_day, unfollows_day, views_day,
             accounts_engaged, total_interactions, likes_day, comments_day,
             saves_day, shares_day, profile_links_taps)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (connection_id, metric_date) DO UPDATE SET
             followers = EXCLUDED.followers,
             reach_day = EXCLUDED.reach_day,
             impressions_day = EXCLUDED.impressions_day,
             follows_day = EXCLUDED.follows_day,
             unfollows_day = EXCLUDED.unfollows_day,
             views_day = EXCLUDED.views_day,
             accounts_engaged = EXCLUDED.accounts_engaged,
             total_interactions = EXCLUDED.total_interactions,
             likes_day = EXCLUDED.likes_day,
             comments_day = EXCLUDED.comments_day,
             saves_day = EXCLUDED.saves_day,
             shares_day = EXCLUDED.shares_day,
             profile_links_taps = EXCLUDED.profile_links_taps,
             recorded_at = NOW()`,
          [
            id,
            day.date,
            absoluteFollowers[day.date] ?? currentFollowers,
            profile.follows_count || 0,
            profile.media_count || 0,
            day.reach,
            day.views,
            day.followsDay,
            day.unfollowsDay,
            day.views,
            day.accountsEngaged,
            day.totalInteractions,
            day.likesDay,
            day.commentsDay,
            day.savesDay,
            day.sharesDay,
            day.profileLinksTaps,
          ]
        );
        inserted++;
      } catch (e: any) {
        console.error(`Erro upsert ${day.date}:`, e.message);
      }
    }
    console.log(`Snapshots upsertados: ${inserted}/${historical.length}`);
  }

  await pool.end();
  console.log('\n[Backfill IG] Finalizado.');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  pool.end().finally(() => process.exit(1));
});
