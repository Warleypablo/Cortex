/**
 * Health check COMPLETO do sync do Bitrix (e frescor das demais plataformas).
 * Entry point único para "confere se o sync do bitrix rodou".
 *
 * Verifica:
 *   1. Refresh horário do crm_deal (campos de funil) — rodou hoje?
 *   2. Sync de UTM — está preenchendo, ou travou (dias recentes sem utm_source)?
 *   3. Frescor das demais plataformas (Meta/Google/TikTok/LinkedIn/YouTube).
 * Imprime um VEREDITO no fim. Exit code 1 se houver alerta.
 *
 * Uso: npx tsx scripts/check-bitrix-sync.ts
 */
import "dotenv/config";
import { pool } from "../server/db";

const alertas: string[] = [];
const ok: string[] = [];

async function one(sql: string, params: any[] = []) {
  return (await pool.query(sql, params)).rows[0];
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" HEALTH CHECK — SYNC DO BITRIX");
  console.log("═══════════════════════════════════════════════════════");

  // ── 1. Refresh horário do crm_deal (funil) ───────────────────────────
  // date_modify é wall-clock do portal (UTC+3, tz-naive). "Horas desde" é calculado
  // no SQL contra o relógio do portal (NOW UTC + 3h) pra evitar viés de timezone.
  const deal = await one(
    `SELECT COUNT(*) total,
       TO_CHAR(MAX(date_modify), 'YYYY-MM-DD HH24:MI:SS') ult_modify,
       TO_CHAR(MAX(date_create), 'YYYY-MM-DD HH24:MI:SS') ult_create,
       ROUND(EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC' + INTERVAL '3 hours') - MAX(date_modify))) / 3600, 1) horas_desde,
       COUNT(*) FILTER (WHERE date_modify::date = CURRENT_DATE) modif_hoje,
       COUNT(*) FILTER (WHERE date_create::date = CURRENT_DATE) criados_hoje
     FROM "Bitrix".crm_deal`
  );
  const horasDesdeModify = Number(deal.horas_desde);
  console.log(`\n1) REFRESH DO FUNIL (crm_deal)`);
  console.log(`   Total de deals:      ${deal.total}`);
  console.log(`   Última modificação:  ${deal.ult_modify} (portal)  (há ~${horasDesdeModify.toFixed(1)}h)`);
  console.log(`   Modificados hoje:    ${deal.modif_hoje}`);
  console.log(`   Criados hoje:        ${deal.criados_hoje}`);
  // O refresh roda de hora em hora; se a última modificação passou de ~3h, algo travou.
  if (horasDesdeModify > 3) alertas.push(`Refresh do funil parece parado: última modificação há ~${horasDesdeModify.toFixed(1)}h (esperado < 1h).`);
  else ok.push(`Refresh do funil fresco (última modificação há ~${horasDesdeModify.toFixed(1)}h).`);

  // ── 2. Sync de UTM (atribuição) ──────────────────────────────────────
  const dias = (await pool.query(
    `SELECT created_at::date dia,
       COUNT(*) total,
       COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(utm_source,'')),'') IS NOT NULL) com_utm
     FROM "Bitrix".crm_deal
     WHERE created_at >= CURRENT_DATE - INTERVAL '10 days'
     GROUP BY 1 ORDER BY 1 DESC`
  )).rows.map((r: any) => ({
    dia: String(r.dia).slice(0, 10),
    total: Number(r.total),
    com_utm: Number(r.com_utm),
    pct: Number(r.total) > 0 ? Math.round((Number(r.com_utm) / Number(r.total)) * 100) : 0,
  }));

  console.log(`\n2) SYNC DE UTM (atribuição por dia — últimos 10d)`);
  console.table(dias);

  // Baseline: dias 4–10 atrás (maduros). Recentes: últimos 3 dias com volume relevante.
  const baseline = dias.filter((_, i) => i >= 3 && i <= 9 && dias[i].total >= 15);
  const baseAvg = baseline.length ? baseline.reduce((s, d) => s + d.pct, 0) / baseline.length : 50;
  const recentes = dias.filter((d, i) => i <= 2 && d.total >= 15);
  const stallHard = recentes.filter((d) => d.com_utm === 0);
  const stallSoft = recentes.filter((d) => d.pct < baseAvg * 0.5);

  if (stallHard.length) {
    alertas.push(`UTM TRAVADO: ${stallHard.map((d) => d.dia).join(", ")} com 0 deals atribuídos (baseline ~${baseAvg.toFixed(0)}%). Rodar: npx tsx scripts/run-bitrix-utm-sync.ts`);
  } else if (stallSoft.length) {
    alertas.push(`UTM abaixo do normal em ${stallSoft.map((d) => `${d.dia} (${d.pct}%)`).join(", ")} vs baseline ~${baseAvg.toFixed(0)}%. Possível atraso — checar run-bitrix-utm-sync.`);
  } else {
    ok.push(`Sync de UTM saudável (recentes ~${recentes.length ? Math.round(recentes.reduce((s, d) => s + d.pct, 0) / recentes.length) : baseAvg.toFixed(0)}% vs baseline ~${baseAvg.toFixed(0)}%).`);
  }

  // ── 3. Frescor das demais plataformas ────────────────────────────────
  console.log(`\n3) DEMAIS PLATAFORMAS (último dia de dado / linhas hoje)`);
  const plats: Array<[string, string]> = [
    ["Meta Ads", `SELECT MAX(date_start) d, COUNT(*) FILTER (WHERE data_importacao::date=CURRENT_DATE) hoje FROM meta_ads.meta_insights_daily`],
    ["Google", `SELECT MAX(report_date) d, COUNT(*) FILTER (WHERE synced_at::date=CURRENT_DATE) hoje FROM google.campaign_daily_metrics`],
    ["TikTok", `SELECT MAX(stat_date) d, COUNT(*) FILTER (WHERE synced_at::date=CURRENT_DATE) hoje FROM tiktok.ad_insights_daily`],
    ["LinkedIn", `SELECT MAX(stat_date) d, COUNT(*) FILTER (WHERE synced_at::date=CURRENT_DATE) hoje FROM linkedin.ad_metrics_daily`],
    ["YouTube", `SELECT MAX(report_date) d, COUNT(*) FILTER (WHERE synced_at::date=CURRENT_DATE) hoje FROM youtube.channel_daily_metrics`],
  ];
  const platRows: any[] = [];
  for (const [nome, q] of plats) {
    try {
      const r = await one(q);
      platRows.push({ plataforma: nome, ult_dia: r.d ? String(r.d).slice(0, 10) : "—", linhas_hoje: Number(r.hoje) });
    } catch (e: any) {
      platRows.push({ plataforma: nome, ult_dia: "ERRO", linhas_hoje: e.message.slice(0, 40) });
    }
  }
  console.table(platRows);

  // ── VEREDITO ─────────────────────────────────────────────────────────
  console.log(`\n═══════════════════════════════════════════════════════`);
  if (alertas.length === 0) {
    console.log(` ✅ VEREDITO: TUDO OK`);
    ok.forEach((m) => console.log(`   • ${m}`));
  } else {
    console.log(` ⚠️  VEREDITO: ${alertas.length} ALERTA(S)`);
    alertas.forEach((m) => console.log(`   ✗ ${m}`));
    if (ok.length) {
      console.log(`   (ok:)`);
      ok.forEach((m) => console.log(`   • ${m}`));
    }
  }
  console.log(`═══════════════════════════════════════════════════════`);

  await pool.end();
  process.exit(alertas.length ? 1 : 0);
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
