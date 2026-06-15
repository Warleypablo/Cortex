import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../server/db';
import { getSessionsByPlatform, getGa4SourceMediumDiagnostic } from '../server/services/ga4Sessions';

const ACCOUNT = 'act_1331413260627780';
const START = '2026-06-01';
const END = '2026-06-06';

async function main() {
  const r = await db.execute(sql`
    SELECT
      COALESCE(SUM(outbound_clicks), 0)::bigint AS outbound_clicks,
      COALESCE(SUM(landing_page_views), 0)::bigint AS lpv
    FROM meta_ads.meta_insights_daily
    WHERE date_start >= ${START}::date AND date_start <= ${END}::date
      AND account_id = ${ACCOUNT}
  `);
  const m = r.rows[0] as any;
  const outboundClicks = parseInt(m.outbound_clicks) || 0;
  const lpv = parseInt(m.lpv) || 0;

  const ga4 = await getSessionsByPlatform(new Date(START), new Date(END));
  const diag = await getGa4SourceMediumDiagnostic(new Date(START), new Date(END));

  const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—');

  // Linhas que caem em meta_ads — separar paga (medium cpc/paid) de orgânica
  const metaRows = diag.rows.filter((x) => x.bucket === 'meta_ads');
  const isPaidMedium = (md: string) => /cpc|ppc|paid/i.test(md);
  const metaPaga = metaRows.filter((x) => isPaidMedium(x.medium)).reduce((a, x) => a + x.sessions, 0);
  const metaOrg = metaRows.filter((x) => !isPaidMedium(x.medium)).reduce((a, x) => a + x.sessions, 0);

  console.log('\n=== Meta — Junho (01–06/2026) ===');
  console.log('Cliques de saída (Meta):', outboundClicks);
  console.log('Landing Page Views (pixel):', lpv);
  console.log('Sessões GA4 meta_ads (TOTAL):', ga4.byPlatform.meta_ads);
  console.log('  ├─ paga (cpc/paid):', metaPaga);
  console.log('  └─ orgânica (resto):', metaOrg);

  console.log('\n=== Connect Rate (chegou ÷ cliques de saída) ===');
  console.log('Pixel              :', pct(lpv, outboundClicks));
  console.log('GA4 (total bucket) :', pct(ga4.byPlatform.meta_ads, outboundClicks));
  console.log('GA4 (só paga)      :', pct(metaPaga, outboundClicks));

  console.log('\n=== Detalhe source/medium do bucket meta_ads ===');
  for (const x of metaRows.sort((a, b) => b.sessions - a.sessions)) {
    console.log(`  ${x.source} / ${x.medium}: ${x.sessions} sess`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
