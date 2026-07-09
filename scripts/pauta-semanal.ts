/**
 * Gerador da Pauta Semanal de Performance (Growth) — Turbo Partners.
 *
 * Consome as MESMAS fontes de produção do Cortex (NÃO reinventa métrica):
 *   - Orçado: PLAN (abaixo), derivado do planejamento mensal / meta_ads.growth_budgets
 *   - Marketing: meta_ads.meta_insights_daily · google.* · tiktok.* (schema `google`, NÃO `google_ads`)
 *   - Funil/Vendas: mesma lógica do endpoint /api/growth/orcado-realizado/funnel-by-platform
 *     (stage_name='Negócio Ganho', created_at vs data_fechamento, whitelist de source, mql::text='1')
 *   - Sessões: GA4 ao vivo via service account (server/services/ga4Sessions.ts)
 *
 * Preenche a Seção 2 do template HTML (5 canais + 2 consolidados) e grava a instância datada
 * no chief-of-staff. Seções de narrativa (1/3/5) ficam como rascunho pro Ichino editar.
 *
 * Uso:  npx tsx scripts/pauta-semanal.ts [YYYY-MM-DD]   (default: hoje)
 *       SPRINT=2 npx tsx scripts/pauta-semanal.ts
 */
import 'dotenv/config';
import fs from 'fs';
import pg from 'pg';
import { getSessionsByPlatform } from '../server/services/ga4Sessions';

const PAUTA_DIR = '/Users/ichino/Projects/chief-of-staff/01 - Projetos/pauta-semanal';
const TEMPLATE = `${PAUTA_DIR}/_template_pauta-semanal.html`;

// ---------------------------------------------------------------- período
const ref = process.argv[2] ? new Date(process.argv[2] + 'T12:00:00') : new Date();
const Y = ref.getFullYear(), Mo = ref.getMonth(); // 0-based
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = new Date(Y, Mo, 1);
const daysInMonth = new Date(Y, Mo + 1, 0).getDate();
const elapsed = ref.getDate();              // dias corridos do mês (inclui hoje)
const remaining = daysInMonth - elapsed;
const fP = elapsed / daysInMonth;           // fator proporcional (pace)
const fV = daysInMonth / elapsed;           // fator de previsão
const S = ymd(monthStart), E = ymd(ref);
const last7 = new Date(ref); last7.setDate(ref.getDate() - 6);
const S7 = ymd(last7);
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
// rótulo da semana (segunda a domingo que contém `ref`)
const dow = (ref.getDay() + 6) % 7; // 0=segunda
const wkStart = new Date(ref); wkStart.setDate(ref.getDate() - dow);
const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6);
const SEMANA = `${pad(wkStart.getDate())}–${pad(wkEnd.getDate())}/${MESES[wkEnd.getMonth()].slice(0,3).toLowerCase()}`;
const SPRINT = process.env.SPRINT || '—';
const MES_LABEL = `${MESES[Mo]} / ${Y}`;

// ---------------------------------------------------------------- SQL comum (produção)
const MQL = `(mql::text='1' OR LOWER(mql::text)='true')`;
const NMQL = `NOT (mql::text='1' OR LOWER(mql::text)='true')`;
const SRC = `source IN ('CALL','EMAIL','WEB','ADVERTISING','TRADE_SHOW','WEBFORM','OTHER','UC_4VCKGM')`;
const GROWTH_FUNIS = `fnl_ngc ILIKE ANY(ARRAY['creators','crm','comunidade'])`;
// classificação utm→plataforma (recorte do PLATFORM_CASE_SQL_BASIC de server/routes/growth.ts)
const PLAT = `CASE
  WHEN source IN ('UC_4VCKGM','WEB') THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%instagram%' OR LOWER(TRIM(COALESCE(utm_source,'')))='ig' THEN 'instagram'
  WHEN LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%facebook%' OR LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%fb%' OR LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%meta%' THEN 'meta_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%google%' THEN 'google_ads'
  WHEN LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%tiktok%' OR LOWER(TRIM(COALESCE(utm_source,'')))='tt' THEN 'tiktok_ads'
  ELSE 'outros' END`;
const PAID = `(LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%facebook%' OR LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%fb%' OR LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%meta%' OR LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%google%' OR LOWER(TRIM(COALESCE(utm_source,''))) LIKE '%tiktok%' OR LOWER(TRIM(COALESCE(utm_source,'')))='tt')`;

const url = (fs.readFileSync(process.cwd() + '/.env', 'utf8').match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/) || [])[1];
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const q1 = async (sql: string) => (await db.query(sql)).rows[0] as any;
const qN = async (sql: string) => (await db.query(sql)).rows as any[];
const num = (v: any) => (v == null ? 0 : Number(v));

// ---------------------------------------------------------------- pulls
// Marketing Meta por padrão de nome de campanha
const metaMkt = (like: string, a: string, b: string) => q1(`
  SELECT COALESCE(SUM(spend),0) invest, COALESCE(SUM(impressions),0) impr,
         COALESCE(SUM(outbound_clicks),0) oc, COALESCE(SUM(landing_page_views),0) vdp
  FROM meta_ads.meta_insights_daily i JOIN meta_ads.meta_campaigns c ON c.campaign_id=i.campaign_id
  WHERE i.date_start BETWEEN '${a}' AND '${b}' AND LOWER(c.campaign_name) LIKE '${like}'`);
const googleMkt = (a: string, b: string) => q1(`
  SELECT COALESCE(SUM(m.cost_micros)/1e6,0) invest, COALESCE(SUM(m.impressions),0) impr, COALESCE(SUM(m.clicks),0) clicks
  FROM google.ad_daily_metrics m JOIN google.ads a2 ON a2.ad_id=m.ad_id JOIN google.campaigns cp ON cp.campaign_id=a2.campaign_id
  WHERE m.report_date BETWEEN '${a}' AND '${b}' AND LOWER(cp.name) LIKE '%creator%'`);
const tiktokMkt = (a: string, b: string) => q1(`
  SELECT COALESCE(SUM(m.spend),0) invest, COALESCE(SUM(m.impressions),0) impr, COALESCE(SUM(m.clicks),0) clicks, COALESCE(SUM(m.landing_page_views),0) vdp
  FROM tiktok.ad_metrics_daily m JOIN tiktok.ad_campaigns cp ON cp.campaign_id=m.campaign_id
  WHERE m.stat_date BETWEEN '${a}' AND '${b}' AND LOWER(cp.campaign_name) LIKE '%creator%'`);
// Funil (lead journey) — por plataforma OU agregado, com splits MQL/NMQL
const journey = (where: string, a: string, b: string, groupByPlat = false) => qN(`
  SELECT ${groupByPlat ? `${PLAT} platform,` : ``}
    COUNT(*) leads, SUM(CASE WHEN ${MQL} THEN 1 ELSE 0 END) mqls,
    SUM(CASE WHEN data_reuniao_agendada IS NOT NULL THEN 1 ELSE 0 END) ra,
    SUM(CASE WHEN data_reuniao_agendada IS NOT NULL AND ${MQL} THEN 1 ELSE 0 END) ra_mq,
    SUM(CASE WHEN data_reuniao_agendada IS NOT NULL AND ${NMQL} THEN 1 ELSE 0 END) ra_nmq,
    SUM(CASE WHEN data_reuniao_realizada IS NOT NULL THEN 1 ELSE 0 END) rr,
    SUM(CASE WHEN data_reuniao_realizada IS NOT NULL AND ${MQL} THEN 1 ELSE 0 END) rr_mq,
    SUM(CASE WHEN data_reuniao_realizada IS NOT NULL AND ${NMQL} THEN 1 ELSE 0 END) rr_nmq
  FROM "Bitrix".crm_deal
  WHERE created_at>='${a}'::date AND created_at<='${b}'::date+INTERVAL '1 day' AND ${SRC} ${where}
  ${groupByPlat ? 'GROUP BY platform' : ''}`);
const wins = (where: string) => q1(`
  SELECT SUM(CASE WHEN stage_name='Negócio Ganho' THEN 1 ELSE 0 END) vendas,
    SUM(CASE WHEN stage_name='Negócio Ganho' AND ${MQL} THEN 1 ELSE 0 END) v_mq,
    SUM(CASE WHEN stage_name='Negócio Ganho' AND ${NMQL} THEN 1 ELSE 0 END) v_nmq,
    COUNT(DISTINCT CASE WHEN stage_name='Negócio Ganho' THEN COALESCE(company_name,contact_name,title) END) clientes,
    SUM(CASE WHEN stage_name='Negócio Ganho' THEN COALESCE(valor_pontual,0) ELSE 0 END) pont,
    SUM(CASE WHEN stage_name='Negócio Ganho' THEN COALESCE(valor_recorrente,0) ELSE 0 END) rec,
    SUM(CASE WHEN stage_name='Negócio Ganho' THEN
      CASE WHEN produtos IS NULL OR produtos='' OR produtos='[]' THEN 1
      ELSE COALESCE(array_length(string_to_array(REPLACE(REPLACE(produtos,'[',''),']',''),','),1),1) END ELSE 0 END) contratos
  FROM "Bitrix".crm_deal
  WHERE data_fechamento>='${S}'::date AND data_fechamento<='${E}'::date AND stage_name='Negócio Ganho' AND ${SRC} ${where}`);

// ---------------------------------------------------------------- format / compute
const isN = (v: any) => v == null || Number.isNaN(v) || !isFinite(v);
const nf = (n: any, d = 0) => isN(n) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = (n: any) => isN(n) ? '—' : 'R$ ' + nf(n, 0);
const pct = (n: any) => isN(n) ? '—' : nf(n, 1) + '%';
const sgn = (n: any, f: (x: number) => string) => isN(n) ? '—' : (n >= 0 ? '+' : '−') + f(Math.abs(n));
const c = (v: string, cl = '') => `<td class="r${cl ? ' ' + cl : ''}">${v}</td>`;
const R = (a: number, b: number) => a / b * 100;

// linha de VOLUME (acumula): %ating ÷ orçado total; desvio vs pace proporcional; previsão + recálculo
const vol = (label: string, orc: number | null, real: number, real7: number | null, o: { cls?: string; m?: boolean; od?: string } = {}) => {
  const F = o.m ? money : (x: any) => nf(x);
  if (orc == null) return `<tr${o.cls ? ` class="${o.cls}"` : ''}><td>${label}</td><td class="r">—</td>${c(F(real))}${c(F(real7))}<td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>`;
  const mp = orc * fP, at = real / orc * 100, dv = real - mp, pv = real * fV, rc = (orc - real) / remaining;
  return `<tr${o.cls ? ` class="${o.cls}"` : ''}><td>${label}</td>` + c(o.od ?? F(orc)) + c(F(real)) + c(F(real7))
    + c(pct(at)) + c(sgn(dv, F)) + c(F(pv)) + c(isN(rc) ? '—' : F(rc) + '/d') + `</tr>`;
};
// Semáforo do % Atingido (lógica do Cortex GrowthOrcadoRealizado): normal ≥100 verde/≥80 amarelo/<80 vermelho;
// custo invertido ≤100 verde/≤120 amarelo/>120 vermelho. Só aplicado em taxa/custo (não em volume).
// Faixa amarela = até 5% fora da meta; além disso, vermelho.
const tier = (v: number | null, cost?: boolean): 'good' | 'warn' | 'bad' | null =>
  isN(v) ? null : (cost ? ((v as number) <= 100 ? 'good' : (v as number) <= 105 ? 'warn' : 'bad')
                        : ((v as number) >= 100 ? 'good' : (v as number) >= 95 ? 'warn' : 'bad'));
const pctCell = (v: number | null, cost?: boolean) => {
  const t = tier(v, cost);
  return t == null ? c('—') : `<td class="r"><span class="pv c-${t}">${pct(v)}<span class="bar bg-${t}"></span></span></td>`;
};
// linha de TAXA/CUSTO (não acumula): %ating colorido (semáforo) + desvio colorido (verde/vermelho); recálculo n/a
const rate = (label: string, orc: number | null, real: number | null, real7: number | null, o: { cost?: boolean; m?: boolean; cls?: string; ind?: boolean; od?: string } = {}) => {
  const F = o.m ? money : (x: any) => pct(x);
  const at = orc == null || isN(real) ? null : (real as number) / orc * 100;
  const good = orc == null || isN(real) ? null : (o.cost ? (real as number) <= orc : (real as number) >= orc);
  const dv = orc == null || isN(real) ? null : (real as number) - orc;
  const dvTxt = dv == null ? '—' : (o.m ? sgn(dv, money) : sgn(dv, (x) => nf(x, 1) + 'pp'));
  const dvCls = good == null ? '' : (good ? 'v-good' : 'v-bad');
  const t = tier(at, o.cost);                          // cor por resultado → Realizado (mês) + % Atingido
  const realCls = t ? `c-${t}` : '';
  const at7 = orc == null || isN(real7) ? null : (real7 as number) / orc * 100;  // 7d vs meta → mesma cor
  const t7 = tier(at7, o.cost);
  const real7Cls = t7 ? `c-${t7}` : '';
  const lab = o.ind ? `<td style="padding-left:28px;color:var(--muted)">${label}</td>` : `<td>${label}</td>`;
  return `<tr${o.cls ? ` class="${o.cls}"` : ''}>` + lab + `<td class="r${(!o.m) ? ' pctval' : ''}">${o.od ?? (orc == null ? '—' : F(orc))}</td>`
    + c(F(real), realCls) + c(F(real7), real7Cls) + pctCell(at, o.cost) + c(dvTxt, dvCls) + c(isN(real) ? '—' : F(real)) + c('—') + `</tr>`;
};
// contagem sem meta (Orçado —)
const cnt = (label: string, real: number, real7: number | null, note = '') =>
  `<tr><td>${label}${note ? ` <small style="color:var(--muted)">${note}</small>` : ''}</td><td class="r">—</td>` + c(nf(real)) + c(nf(real7)) + '<td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>';
const subMoney = (label: string, v: number) =>
  `<tr><td style="padding-left:28px;color:var(--muted)">${label}</td><td class="r">—</td>` + c(money(v)) + c('—') + '<td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>';

const HEAD = `<tr><th>Métrica</th><th class="r">Orçado</th><th class="r">Realizado <small style="font-weight:400;text-transform:none">(mês)</small></th><th class="r">Últimos 7d</th><th class="r">% ating.</th><th class="r">Desvio</th><th class="r">Previsão <small style="font-weight:400;text-transform:none">fim mês</small></th><th class="r">Recálculo <small style="font-weight:400;text-transform:none">meta</small></th></tr>`;

// ---------------------------------------------------------------- PLAN (orçado mensal — atualizar quando o plano mudar)
const PLAN: any = {
  meta:  { invest:126000, cpm:75, impr:1680000, ctr:0.80, connect:85.0, txpag:16.0, txpagM:7.2, txpagN:8.8, txsess:10.0, txsessM:4.5, txsessN:5.5, leads:1822, cpl:69, mqls:820, pmql:45.0, cpmql:154, ra:13.5, noshow:12.0, rrv:25.0, neg:54, cacn:2333, fat:465000, ticket:8614 },
  tt:    { invest:5000, cpm:30, impr:166667, ctr:0.70, connect:75.0, sess:875, txsess:10.0, txsessM:2.5, txsessN:7.5, leads:88, cpl:57, mqls:22, pmql:25.0, cpmql:227, ra:10.2, noshow:12.0, rrv:25.0, neg:2, cacn:2500, fat:17000, ticket:8614 },
  gg:    { invest:5000, impr:48400, cpc:0.78, cliques:5128, sess:8082, txsess:0.45, leads:36, cpl:111, mqls:11, pmql:30.8, cpmql:364, ra:11.1, noshow:12.0, rrv:25.0, neg:1, cacn:4000, fat:9000, ticket:8614 },
  crm:   { invest:5000, cpm:70, impr:78571, ctr:0.70, connect:80.0, txsess:5.0, leads:22, cpl:250, mqls:7, pmql:30.0, cpmql:833 },
  com:   { invest:5000, cpm:80, impr:62500, ctr:0.70, connect:80.0 },
  inbound:{ invest:165000, sess:34600, txsess:5.1, txsessM:2.0, txsessN:3.2, leads:2461, cpl:67, mqls:1052, pmql:38.7, cpmql:157, ra:17, raM:30, raN:12, noshow:5.0, rrv:23, rrvM:24, rrvN:22, neg:88, contr:121, cacn:1875, cacc:1364, fat:799000, ticket:9080, fun:5.1, funM:2.0, funN:3.2 },
  paga:  { invest:165000, sess:28000, txsess:5.7, txsessM:2.2, txsessN:3.6, leads:2021, cpl:82, mqls:880, pmql:43.5, cpmql:188, ra:13.1, raM:22.8, raN:7.1, noshow:5.0, rrv:30, rrvM:24, rrvN:23.6, neg:78, contr:105, cacn:2115, cacc:1570, fat:663000, ticket:8500, fun:5.7, funM:2.2, funN:3.6 },
};

// ---------------------------------------------------------------- MAIN
async function main() {
  await db.connect();

  const [
    mMkt, mMkt7, gMkt, gMkt7, tMkt, tMkt7,
    crmMkt, crmMkt7, comMkt,
    funMtd, fun7, crmFun, crmFun7,
    inbFun, inbFun7, pgFun, pgFun7,
    inbW, pgW, mW,
  ] = await Promise.all([
    metaMkt('%creators%', S, E), metaMkt('%creators%', S7, E),
    googleMkt(S, E), googleMkt(S7, E), tiktokMkt(S, E), tiktokMkt(S7, E),
    metaMkt('%[crm]%', S, E), metaMkt('%[crm]%', S7, E), metaMkt('%comunidade%', S, E),
    journey(`AND fnl_ngc ILIKE 'creators'`, S, E, true), journey(`AND fnl_ngc ILIKE 'creators'`, S7, E, true),
    journey(`AND fnl_ngc ILIKE 'crm'`, S, E), journey(`AND fnl_ngc ILIKE 'crm'`, S7, E),
    journey(`AND ${GROWTH_FUNIS}`, S, E), journey(`AND ${GROWTH_FUNIS}`, S7, E),
    journey(`AND ${GROWTH_FUNIS} AND ${PAID}`, S, E), journey(`AND ${GROWTH_FUNIS} AND ${PAID}`, S7, E),
    wins(`AND ${GROWTH_FUNIS}`), wins(`AND ${GROWTH_FUNIS} AND ${PAID}`), wins(`AND fnl_ngc ILIKE 'creators' AND ${PLAT}='meta_ads'`),
  ]);

  const ga = await getSessionsByPlatform(new Date(S), new Date(E));
  const ga7 = await getSessionsByPlatform(new Date(S7), new Date(E));
  await db.end();

  const byPlat = (arr: any[]) => arr.reduce((o, r) => (o[r.platform] = r, o), {} as any);
  const F = byPlat(funMtd), F7 = byPlat(fun7);
  const g = (o: any, p: string, k: string) => num(o[p]?.[k]);
  const sumPaid = (o: any) => o.meta_ads?.google_ads; // placeholder (não usado)

  // ---- CREATORS · META
  const meta = (() => {
    const d = { invest: num(mMkt.invest), invest7: num(mMkt7.invest), impr: num(mMkt.impr), impr7: num(mMkt7.impr), oc: num(mMkt.oc), vdp: num(mMkt.vdp), vdp7: num(mMkt7.vdp),
      sess: ga.byPlatform.meta_ads, sess7: ga7.byPlatform.meta_ads,
      leads: g(F,'meta_ads','leads'), leads7: g(F7,'meta_ads','leads'), mqls: g(F,'meta_ads','mqls'), mqls7: g(F7,'meta_ads','mqls'),
      ra: g(F,'meta_ads','ra'), rr: g(F,'meta_ads','rr'), vendas: num(mW.vendas), pont: num(mW.pont), rec: num(mW.rec) };
    const P = PLAN.meta, nmq = d.leads - d.mqls, nmq7 = d.leads7 - d.mqls7, fat = d.pont + d.rec;
    return [
      `<tr class="grp"><td colspan="8">▸ Marketing</td></tr>`,
      vol('Investimento', P.invest, d.invest, d.invest7, { m: true }),
      rate('CPM', P.cpm, d.invest/d.impr*1000, d.invest7/d.impr7*1000, { cost: true, m: true }),
      vol('Impressões', P.impr, d.impr, d.impr7, {}),
      rate('CTR de saída', P.ctr, R(d.oc,d.impr), R(num(mMkt7.oc),d.impr7), {}),
      cnt('Visualizações de Página', d.vdp, d.vdp7, 'Meta pixel'),
      cnt('Sessões', d.sess, d.sess7, 'GA4'),
      rate('Connect Rate', P.connect, R(d.vdp,d.oc), R(d.vdp7,num(mMkt7.oc)), {}),
      rate('Tx Conversão da página · VdP', P.txpag, R(d.leads,d.vdp), R(d.leads7,d.vdp7), {}),
      rate('└ MQL', P.txpagM, R(d.mqls,d.vdp), R(d.mqls7,d.vdp7), { ind: true }),
      rate('└ NMQL', P.txpagN, R(nmq,d.vdp), R(nmq7,d.vdp7), { ind: true }),
      rate('Taxa de conversão de sessões', P.txsess, R(d.leads,d.sess), R(d.leads7,d.sess7), {}),
      rate('└ MQL', P.txsessM, R(d.mqls,d.sess), R(d.mqls7,d.sess7), { ind: true }),
      rate('└ NMQL', P.txsessN, R(nmq,d.sess), R(nmq7,d.sess7), { ind: true }),
      vol('Leads', P.leads, d.leads, d.leads7, { cls: 'sub' }),
      rate('CPL', P.cpl, d.invest/d.leads, d.invest7/d.leads7, { cost: true, m: true, cls: 'northstar' }),
      vol('MQLs', P.mqls, d.mqls, d.mqls7, { cls: 'sub' }),
      rate('% MQLs', P.pmql, R(d.mqls,d.leads), R(d.mqls7,d.leads7), {}),
      rate('CPMQL', P.cpmql, d.invest/d.mqls, d.invest7/d.mqls7, { cost: true, m: true, cls: 'northstar' }),
      `<tr class="grp"><td colspan="8">▸ Pré-vendas / Vendas <span style="font-weight:400;color:var(--muted);font-size:11px">· janela curta (dia ${elapsed}/${daysInMonth}) — RA/RR/vendas ainda maturando; 7d n/a</span></td></tr>`,
      rate('% Reunião Agendada', P.ra, R(d.ra,d.leads), null, {}),
      rate('CPRA', null, d.ra?d.invest/d.ra:null, null, { m: true }),
      rate('% No-show', P.noshow, d.ra?R(d.ra-d.rr,d.ra):null, null, { cost: true }),
      rate('CPRR', null, d.rr?d.invest/d.rr:null, null, { m: true }),
      rate('% RR→Venda', P.rrv, d.rr?R(d.vendas,d.rr):null, null, {}),
      vol('Negócios Ganhos', P.neg, d.vendas, null, {}),
      rate('CAC - Negócios', P.cacn, d.vendas?d.invest/d.vendas:null, null, { cost: true, m: true }),
      vol('Faturamento Total', P.fat, fat, null, { m: true }),
      subMoney('└ Recorrente', d.rec), subMoney('└ Pontual', d.pont),
      rate('Ticket Médio Geral', P.ticket, d.vendas?fat/d.vendas:null, null, { m: true }),
    ].join('\n');
  })();

  // ---- CREATORS · TIKTOK
  const tt = (() => {
    const d = { invest: num(tMkt.invest), invest7: num(tMkt7.invest), impr: num(tMkt.impr), impr7: num(tMkt7.impr), clicks: num(tMkt.clicks), clicks7: num(tMkt7.clicks), vdp: num(tMkt.vdp), vdp7: num(tMkt7.vdp),
      sess: ga.byPlatform.tiktok_ads, sess7: ga7.byPlatform.tiktok_ads,
      leads: g(F,'tiktok_ads','leads'), leads7: g(F7,'tiktok_ads','leads'), mqls: g(F,'tiktok_ads','mqls'), mqls7: g(F7,'tiktok_ads','mqls'), ra: g(F,'tiktok_ads','ra'), rr: g(F,'tiktok_ads','rr') };
    const P = PLAN.tt, nmq = d.leads-d.mqls, nmq7 = d.leads7-d.mqls7;
    return [
      `<tr class="grp"><td colspan="8">▸ Marketing <small style="color:var(--muted)">(métricas de TikTok)</small></td></tr>`,
      vol('Investimento', P.invest, d.invest, d.invest7, { m: true }),
      rate('CPM', P.cpm, d.invest/d.impr*1000, d.invest7/d.impr7*1000, { cost: true, m: true }),
      vol('Impressões', P.impr, d.impr, d.impr7, {}),
      rate('CTR de saída', P.ctr, R(d.clicks,d.impr), R(d.clicks7,d.impr7), {}),
      rate('Connect Rate', P.connect, R(d.vdp,d.clicks), R(d.vdp7,d.clicks7), {}),
      cnt('Sessões', d.sess, d.sess7, 'GA4'),
      rate('Taxa de conversão de sessões', P.txsess, R(d.leads,d.sess), R(d.leads7,d.sess7), {}),
      rate('└ MQL', P.txsessM, R(d.mqls,d.sess), R(d.mqls7,d.sess7), { ind: true }),
      rate('└ NMQL', P.txsessN, R(nmq,d.sess), R(nmq7,d.sess7), { ind: true }),
      vol('Leads', P.leads, d.leads, d.leads7, { cls: 'sub' }),
      rate('CPL', P.cpl, d.invest/d.leads, d.invest7/d.leads7, { cost: true, m: true, cls: 'northstar' }),
      vol('MQLs', P.mqls, d.mqls, d.mqls7, { cls: 'sub' }),
      rate('% MQLs', P.pmql, R(d.mqls,d.leads), R(d.mqls7,d.leads7), {}),
      rate('CPMQL', P.cpmql, d.invest/d.mqls, d.invest7/d.mqls7, { cost: true, m: true, cls: 'northstar' }),
      `<tr class="grp"><td colspan="8">▸ Pré-vendas / Vendas <span style="font-weight:400;color:var(--muted);font-size:11px">· volume baixo — ${d.leads} leads no mês</span></td></tr>`,
      rate('% Reunião Agendada', P.ra, R(d.ra,d.leads), null, {}),
      rate('% No-show', P.noshow, d.ra?R(d.ra-d.rr,d.ra):null, null, { cost: true }),
      rate('% RR→Venda', P.rrv, d.rr?R(0,d.rr):null, null, {}),
      vol('Negócios Ganhos', P.neg, 0, null, {}),
      vol('Faturamento Total', P.fat, 0, null, { m: true }),
      rate('Ticket Médio Geral', P.ticket, null, null, { m: true }),
    ].join('\n');
  })();

  // ---- CREATORS · GOOGLE (Search)
  const gg = (() => {
    const d = { invest: num(gMkt.invest), invest7: num(gMkt7.invest), impr: num(gMkt.impr), impr7: num(gMkt7.impr), clicks: num(gMkt.clicks), clicks7: num(gMkt7.clicks),
      sess: ga.byPlatform.google_ads, sess7: ga7.byPlatform.google_ads,
      leads: g(F,'google_ads','leads'), leads7: g(F7,'google_ads','leads'), mqls: g(F,'google_ads','mqls'), mqls7: g(F7,'google_ads','mqls'), ra: g(F,'google_ads','ra'), rr: g(F,'google_ads','rr') };
    const P = PLAN.gg;
    return [
      `<tr class="grp"><td colspan="8">▸ Marketing <small style="color:var(--muted)">(Search — métricas de Google)</small></td></tr>`,
      vol('Investimento', P.invest, d.invest, d.invest7, { m: true }),
      rate('CPM', null, d.invest/d.impr*1000, d.invest7/d.impr7*1000, { m: true }),
      vol('Impressões', P.impr, d.impr, d.impr7, {}),
      rate('CTR de saída', null, R(d.clicks,d.impr), R(d.clicks7,d.impr7), {}),
      rate('CPC (clique de busca)', P.cpc, d.invest/d.clicks, d.invest7/d.clicks7, { cost: true, m: true }),
      vol('Cliques', P.cliques, d.clicks, d.clicks7, {}),
      cnt('Sessões', d.sess, d.sess7, 'GA4'),
      rate('Taxa de conversão de sessões', P.txsess, R(d.leads,d.sess), R(d.leads7,d.sess7), {}),
      vol('Leads', P.leads, d.leads, d.leads7, { cls: 'sub' }),
      rate('CPL', P.cpl, d.invest/d.leads, d.invest7/d.leads7, { cost: true, m: true, cls: 'northstar' }),
      vol('MQLs', P.mqls, d.mqls, d.mqls7, { cls: 'sub' }),
      rate('% MQLs', P.pmql, R(d.mqls,d.leads), R(d.mqls7,d.leads7), {}),
      rate('CPMQL', P.cpmql, d.invest/d.mqls, d.invest7/d.mqls7, { cost: true, m: true, cls: 'northstar' }),
      `<tr class="grp"><td colspan="8">▸ Pré-vendas / Vendas <span style="font-weight:400;color:var(--muted);font-size:11px">· volume baixo — ${d.leads} leads no mês</span></td></tr>`,
      rate('% Reunião Agendada', P.ra, R(d.ra,d.leads), null, {}),
      rate('% No-show', P.noshow, d.ra?R(d.ra-d.rr,d.ra):null, null, { cost: true }),
      rate('% RR→Venda', P.rrv, d.rr?R(0,d.rr):null, null, {}),
      vol('Negócios Ganhos', P.neg, 0, null, {}),
      vol('Faturamento Total', P.fat, 0, null, { m: true }),
      rate('Ticket Médio Geral', P.ticket, null, null, { m: true }),
    ].join('\n');
  })();

  // ---- CRM · META (pré-lançamento)
  const crm = (() => {
    const d = { invest: num(crmMkt.invest), invest7: num(crmMkt7.invest), impr: num(crmMkt.impr), impr7: num(crmMkt7.impr), oc: num(crmMkt.oc), vdp: num(crmMkt.vdp), vdp7: num(crmMkt7.vdp),
      leads: num(crmFun.leads), leads7: num(crmFun7.leads), mqls: num(crmFun.mqls), ra: num(crmFun.ra) };
    const P = PLAN.crm;
    return [
      `<tr class="grp"><td colspan="8">▸ Marketing <span style="font-weight:400;color:var(--muted);font-size:11px">· pré-lançamento — ${d.leads} lead(s), campanha de teste</span></td></tr>`,
      vol('Investimento', P.invest, d.invest, d.invest7, { m: true }),
      rate('CPM', P.cpm, d.invest/d.impr*1000, d.invest7/d.impr7*1000, { cost: true, m: true }),
      vol('Impressões', P.impr, d.impr, d.impr7, {}),
      rate('CTR de saída', P.ctr, R(d.oc,d.impr), null, {}),
      cnt('Visualizações de Página', d.vdp, d.vdp7, 'Meta pixel'),
      `<tr><td>Sessões <small style="color:var(--muted)">(GA4)</small></td><td class="r">—</td><td class="r" style="color:var(--muted)">s/ dado</td><td class="r" style="color:var(--muted)">s/ dado</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>`,
      rate('Connect Rate', P.connect, R(d.vdp,d.oc), null, {}),
      vol('Leads', P.leads, d.leads, null, { cls: 'sub' }),
      rate('CPL', P.cpl, d.leads?d.invest/d.leads:null, null, { cost: true, m: true, cls: 'northstar' }),
      vol('MQLs', P.mqls, d.mqls, null, { cls: 'sub' }),
      rate('% MQLs', P.pmql, d.leads?R(d.mqls,d.leads):null, null, {}),
      rate('CPMQL', PLAN.crm.cpmql, d.mqls?d.invest/d.mqls:null, null, { cost: true, m: true, cls: 'northstar' }),
      `<tr class="grp"><td colspan="8">▸ Pré-vendas / Vendas <span style="font-weight:400;color:var(--muted);font-size:11px">· sem volume</span></td></tr>`,
      rate('% Reunião Agendada', 9.1, d.leads?R(d.ra,d.leads):null, null, {}),
      vol('Negócios Ganhos', null, 0, null, {}),
      vol('Faturamento Total', null, 0, null, { m: true }),
    ].join('\n');
  })();

  // ---- COMUNIDADE · META (inativo)
  const com = (() => {
    const inv = num(comMkt.invest);
    const P = PLAN.com;
    return [
      `<tr class="grp"><td colspan="8">▸ Marketing <span style="font-weight:400;color:var(--muted);font-size:11px">· ${inv > 0 ? '' : 'canal não ativo em ' + MESES[Mo].toLowerCase() + ' — R$ 0 de investimento'}</span></td></tr>`,
      vol('Investimento', P.invest, inv, 0, { m: true }),
      rate('CPM', P.cpm, inv ? inv/num(comMkt.impr)*1000 : null, null, { cost: true, m: true }),
      vol('Impressões', P.impr, num(comMkt.impr), 0, {}),
      `<tr><td>Leads</td><td class="r">—</td><td class="r">0</td><td class="r">0</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>`,
      `<tr class="grp"><td colspan="8">▸ Pré-vendas / Vendas <span style="font-weight:400;color:var(--muted);font-size:11px">· inativo</span></td></tr>`,
      `<tr><td>Negócios Ganhos</td><td class="r">—</td><td class="r">0</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td></tr>`,
    ].join('\n');
  })();

  // ---- CONSOLIDADOS
  const INV_PAID = num(mMkt.invest) + num(gMkt.invest) + num(tMkt.invest) + num(crmMkt.invest);
  const INV_PAID7 = num(mMkt7.invest) + num(gMkt7.invest) + num(tMkt7.invest) + num(crmMkt7.invest);
  const consolidado = (scope: 'inbound' | 'paga', fun: any, fun7v: any, W: any) => {
    const P = PLAN[scope];
    const leads = num(fun.leads), leads7 = num(fun7v.leads), mq = num(fun.mqls), mq7 = num(fun7v.mqls), nmq = leads - mq, nmq7 = leads7 - mq7;
    const ra = num(fun.ra), rr = num(fun.rr), ra_mq = num(fun.ra_mq), ra_nmq = num(fun.ra_nmq), rr_mq = num(fun.rr_mq), rr_nmq = num(fun.rr_nmq);
    const ven = num(W.vendas), v_mq = num(W.v_mq), v_nmq = num(W.v_nmq), contr = num(W.contratos), fat = num(W.pont) + num(W.rec);
    const sess = scope === 'inbound' ? ga.byPlatform && Object.values(ga.byPlatform).reduce((a: any, b: any) => a + b, 0) : (ga.byPlatform.meta_ads + ga.byPlatform.google_ads + ga.byPlatform.tiktok_ads);
    const sess7v = scope === 'inbound' ? Object.values(ga7.byPlatform).reduce((a: any, b: any) => a + b, 0) : (ga7.byPlatform.meta_ads + ga7.byPlatform.google_ads + ga7.byPlatform.tiktok_ads);
    const note = scope === 'inbound' ? 'GA4 · todos os sources' : 'GA4 · só mídia paga';
    return [
      `<tr class="grp"><td colspan="8">▸ Métricas de Marketing</td></tr>`,
      vol('Investimento', P.invest, INV_PAID, INV_PAID7, { m: true }),
      cnt('Sessões', sess as number, sess7v as number, note),
      rate('Tx Conversão de Sessões', P.txsess, R(leads, sess as number), R(leads7, sess7v as number), {}),
      rate('└ MQL', P.txsessM, R(mq, sess as number), R(mq7, sess7v as number), { ind: true }),
      rate('└ NMQL', P.txsessN, R(nmq, sess as number), R(nmq7, sess7v as number), { ind: true }),
      vol('Leads', P.leads, leads, leads7, {}),
      rate('CPL', P.cpl, INV_PAID/leads, INV_PAID7/leads7, { cost: true, m: true, cls: 'northstar' }),
      vol('MQLs', P.mqls, mq, mq7, {}),
      rate('% MQLs', P.pmql, R(mq, leads), R(mq7, leads7), {}),
      rate('CPMQL', P.cpmql, INV_PAID/mq, INV_PAID7/mq7, { cost: true, m: true, cls: 'northstar' }),
      `<tr class="grp"><td colspan="8">▸ Pré-vendas / Vendas <span style="font-weight:400;color:var(--muted);font-size:11px">· janela curta (dia ${elapsed}/${daysInMonth})</span></td></tr>`,
      rate('% Reunião Agendada', P.ra, R(ra, leads), R(num(fun7v.ra), leads7), {}),
      rate('└ MQL', P.raM, R(ra_mq, mq), R(num(fun7v.ra_mq), mq7), { ind: true }),
      rate('└ NMQL', P.raN, R(ra_nmq, nmq), R(num(fun7v.ra_nmq), nmq7), { ind: true }),
      rate('% No-show', P.noshow, ra ? R(ra - rr, ra) : null, null, { cost: true }),
      rate('└ MQL', P.noshow, ra_mq ? R(ra_mq - rr_mq, ra_mq) : null, null, { cost: true, ind: true }),
      rate('└ NMQL', P.noshow, ra_nmq ? R(ra_nmq - rr_nmq, ra_nmq) : null, null, { cost: true, ind: true }),
      rate('% RR→Venda', P.rrv, rr ? R(ven, rr) : null, null, {}),
      rate('└ MQL', P.rrvM, rr_mq ? R(v_mq, rr_mq) : null, null, { ind: true }),
      rate('└ NMQL', P.rrvN, rr_nmq ? R(v_nmq, rr_nmq) : null, null, { ind: true }),
      vol('Negócios Ganhos', P.neg, ven, null, {}),
      vol('Contratos Ganhos', P.contr, contr, null, {}),
      rate('CAC - Negócios', P.cacn, ven ? INV_PAID/ven : null, null, { cost: true, m: true }),
      rate('CAC - Contrato', P.cacc, contr ? INV_PAID/contr : null, null, { cost: true, m: true }),
      vol('Faturamento Total', P.fat, fat, null, { m: true }),
      subMoney('└ Recorrente', num(W.rec)), subMoney('└ Pontual', num(W.pont)),
      rate('Ticket Médio Geral', P.ticket, ven ? fat/ven : null, null, { m: true }),
      rate('Taxa de Conversão do Funil', P.fun, R(ven, leads), null, {}),
      rate('└ MQL', P.funM, R(v_mq, mq), null, { ind: true }),
      rate('└ NMQL', P.funN, R(v_nmq, nmq), null, { ind: true }),
    ].join('\n');
  };
  const inbound = consolidado('inbound', inbFun[0], inbFun7[0], inbW);
  const paga = consolidado('paga', pgFun[0], pgFun7[0], pgW);

  // ---------------------------------------------------------------- render no template
  let h = fs.readFileSync(TEMPLATE, 'utf8');
  h = h.replaceAll('{{semana}}', SEMANA).replaceAll('{{n_sprint}}', SPRINT).replaceAll('{{mes}}', MES_LABEL);
  // consolidados: troca só a <table> (mantém cards de meta do topo)
  const repTable = (afterId: string, rowsHtml: string) => {
    const p = h.indexOf(afterId); const ts = h.indexOf('<table>', p); const te = h.indexOf('</table>', ts);
    h = h.slice(0, ts) + '<table>\n' + HEAD + '\n' + rowsHtml + '\n' + h.slice(te);
  };
  repTable('id="nz-inbound"', inbound);
  repTable('id="nz-paga"', paga);
  // canais: troca o smpanel inteiro
  const repPanel = (startMk: string, endMk: string, active: boolean, id: string, rowsHtml: string) => {
    const a = h.indexOf(startMk); const b = h.indexOf(endMk, a + 1);
    const block = `<div class="smpanel${active ? ' active' : ''}" id="${id}">\n<div style="overflow-x:auto">\n<table>\n${HEAD}\n${rowsHtml}\n</table>\n</div>\n</div>\n`;
    h = h.slice(0, a) + block + h.slice(b);
  };
  repPanel('<div class="smpanel active" id="nzc-meta">', '<div class="smpanel" id="nzc-tt">', true, 'nzc-meta', meta);
  repPanel('<div class="smpanel" id="nzc-tt">', '<div class="smpanel" id="nzc-gg">', false, 'nzc-tt', tt);
  repPanel('<div class="smpanel" id="nzc-gg">', '<div class="smpanel" id="nzc-crm">', false, 'nzc-gg', gg);
  repPanel('<div class="smpanel" id="nzc-crm">', '<div class="smpanel" id="nzc-com">', false, 'nzc-crm', crm);
  repPanel('<div class="smpanel" id="nzc-com">', '\n</div>\n\n</section>', false, 'nzc-com', com);

  const outfile = `${PAUTA_DIR}/${E}_pauta-semanal.html`;
  // Preserva a narrativa (seções 1/3/4/5/6) se já existe instância da mesma data —
  // só a Seção 2 (números) é reescrita. Torna "rodar → editar" não-destrutivo.
  let preserved = false;
  if (fs.existsSync(outfile)) {
    const old = fs.readFileSync(outfile, 'utf8');
    const range = (html: string, n: number): [number, number] | null => {
      const mi = html.indexOf(`<h2><span class="n">${n}</span>`);
      if (mi < 0) return null;
      const s = html.lastIndexOf('<section', mi);
      const e = html.indexOf('</section>', mi);
      return (s < 0 || e < 0) ? null : [s, e + '</section>'.length];
    };
    for (const n of [6, 5, 4, 3, 1]) {              // reverso: splices não deslocam índices ainda não processados
      const ro = range(old, n), rn = range(h, n);
      if (ro && rn) h = h.slice(0, rn[0]) + old.slice(ro[0], ro[1]) + h.slice(rn[1]);
    }
    preserved = true;
  }
  fs.writeFileSync(outfile, h);
  if (preserved) console.log('  ↺ narrativa preservada da instância anterior (seções 1/3/4/5/6)');
  console.log(`✓ Pauta gerada: ${outfile}`);
  console.log(`  Período MTD ${S}→${E} (dia ${elapsed}/${daysInMonth}) · 7d ${S7}→${E} · semana ${SEMANA} · sprint ${SPRINT}`);
  console.log(`  Inbound: ${num(inbFun[0].leads)} leads · ${num(inbW.vendas)} vendas · Mídia paga invest R$${nf(INV_PAID)}`);
}

main().catch((e) => { console.error('ERRO:', e?.message || e); process.exit(1); });
