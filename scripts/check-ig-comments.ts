import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';
import { decryptToken } from '../server/utils/encryption';

const VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const BASE = 'https://graph.instagram.com';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function graph(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}/${VERSION}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  return res.json();
}

async function main() {
  const conns = await pool.query(`
    SELECT id, username, ig_user_id, access_token
    FROM cortex_core.instagram_connections
    WHERE is_active = true
    ORDER BY updated_at DESC
  `);
  console.log(`Conexões ativas: ${conns.rows.length}`);
  if (conns.rows.length === 0) { await pool.end(); return; }

  for (const conn of conns.rows) {
    console.log(`\n========== @${conn.username} (ig_user_id=${conn.ig_user_id}) ==========`);
    let token: string;
    try {
      token = decryptToken(conn.access_token);
    } catch (e: any) {
      console.log('  ✗ Falha ao descriptografar token:', e.message);
      continue;
    }

    // 1) buscar mídias recentes com comentários
    const media = await graph('/me/media', token, {
      fields: 'id,caption,media_type,permalink,timestamp,comments_count',
      limit: '25',
    });
    if (media.error) { console.log('  ✗ /me/media erro:', JSON.stringify(media.error)); continue; }

    const withComments = (media.data || []).filter((m: any) => (m.comments_count || 0) > 0);
    console.log(`  Mídias retornadas: ${media.data?.length || 0} | com comentários: ${withComments.length}`);
    if (withComments.length === 0) { console.log('  (nenhuma mídia com comentários pra testar)'); continue; }

    // 2) testar o endpoint de comentários em até 2 mídias
    for (const m of withComments.slice(0, 2)) {
      console.log(`\n  --- Mídia ${m.id} (${m.comments_count} comentários) ${m.permalink || ''} ---`);
      const comments = await graph(`/${m.id}/comments`, token, {
        fields: 'id,text,timestamp,username,from{id,username},like_count,replies{username,text}',
        limit: '25',
      });
      if (comments.error) {
        console.log('  ✗ /comments erro:', JSON.stringify(comments.error));
        // tentar versão mínima sem from{}
        const minimal = await graph(`/${m.id}/comments`, token, { fields: 'id,text,timestamp,username', limit: '10' });
        if (minimal.error) console.log('  ✗ /comments (mínimo) erro:', JSON.stringify(minimal.error));
        else {
          const sample = (minimal.data || []).slice(0, 5);
          const comNome = sample.filter((c: any) => c.username).length;
          console.log(`  ✓ (mínimo) ${sample.length} comentários, com username: ${comNome}`);
          console.log('  amostra:', JSON.stringify(sample, null, 2));
        }
        continue;
      }
      const data = comments.data || [];
      const comUsername = data.filter((c: any) => c.username).length;
      const comFrom = data.filter((c: any) => c.from?.username || c.from?.id).length;
      console.log(`  ✓ ${data.length} comentários | com .username: ${comUsername} | com .from: ${comFrom}`);
      console.log('  amostra (até 5):', JSON.stringify(data.slice(0, 5), null, 2));
    }
  }
  await pool.end();
}

main().catch((err) => {
  console.error('Erro:', err);
  pool.end().finally(() => process.exit(1));
});
