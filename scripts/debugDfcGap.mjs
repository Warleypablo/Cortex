// Debug DFC gap vs ERP (Conta Azul) — read-only investigation.
// Replicates getDfc() faithfully against PRODUCTION and decomposes the
// difference between "ERP gross received revenue" and "DFC receita".
//
// Usage: node scripts/debugDfcGap.mjs [dataInicio=2026-01-01] [dataFim] [empresa]
import pg from 'pg';
import { readFileSync } from 'fs';

// ---- connection (prod) read from .env `dbUrl=` line, no hardcoded secret ----
const env = readFileSync('.env', 'utf8');
const m = env.match(/^dbUrl=(.+)$/m);
if (!m) { console.error('dbUrl not found in .env'); process.exit(1); }
const connectionString = m[1].trim();
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 4 });

const dataInicio = process.argv[2] || '2026-01-01';
const dataFim = process.argv[3] || undefined;
const empresa = process.argv[4] || undefined;

// =================== helpers copied verbatim from storage.ts ===================
function normalizeCode(code) {
  const parts = code.split('.');
  return parts.map(part => part.padStart(2, '0')).join('.');
}
const CATEGORIA_NOMES_PADRAO = {
  '03':'Receitas Operacionais','04':'Receitas Não Operacionais','05':'Custos Operacionais',
  '06':'Despesas Operacionais','07':'Despesas Não Operacionais','08':'Tributos Após Resultado',
};
function getCategoriaName(code){ return CATEGORIA_NOMES_PADRAO[code] || code; }
function determineLevel(categoriaId){ return categoriaId.split('.').length; }
function determineParent(categoriaId){
  const normalizedId = normalizeCode(categoriaId);
  if (normalizedId.includes('.')) { const parts = normalizedId.split('.'); parts.pop(); return parts.join('.'); }
  const twoDigitPrefix = normalizedId.substring(0,2);
  return (twoDigitPrefix === '03' || twoDigitPrefix === '04') ? 'RECEITAS' : 'DESPESAS';
}
function formatDisplayCode(normalizedCode){
  const level = determineLevel(normalizedCode);
  if (level === 1) return String(parseInt(normalizedCode,10));
  return normalizedCode;
}
function inferIntermediateNames(){ return new Map(); } // names irrelevant for totals

function buildHierarchy(items, meses, categoriaNamesMap){
  const nodeMap = new Map();
  nodeMap.set('RECEITAS',{categoriaId:'RECEITAS',nivel:0,parentId:null,children:[],valuesByMonth:{}});
  nodeMap.set('DESPESAS',{categoriaId:'DESPESAS',nivel:0,parentId:null,children:[],valuesByMonth:{}});
  const categoriasByNormalizedId = new Map();
  for (const item of items){
    const normalizedId = normalizeCode(item.categoriaId);
    if (!categoriasByNormalizedId.has(normalizedId)) categoriasByNormalizedId.set(normalizedId,{items:[]});
    categoriasByNormalizedId.get(normalizedId).items.push(item);
  }
  for (const [normalizedId,data] of categoriasByNormalizedId){
    const nivel = determineLevel(normalizedId);
    const parentId = determineParent(normalizedId);
    if (!nodeMap.has(normalizedId)) nodeMap.set(normalizedId,{categoriaId:normalizedId,nivel,parentId,children:[],valuesByMonth:{}});
    const node = nodeMap.get(normalizedId);
    for (const item of data.items){ node.valuesByMonth[item.mes] = (node.valuesByMonth[item.mes]||0)+item.valorTotal; }
  }
  const allNormalizedIds = new Set(categoriasByNormalizedId.keys());
  for (const normalizedId of allNormalizedIds){
    let currentId = normalizedId;
    while (currentId.includes('.')){
      const parts = currentId.split('.'); parts.pop(); const parentNormalizedId = parts.join('.');
      if (!nodeMap.has(parentNormalizedId)){
        const parentLevel = determineLevel(parentNormalizedId); const parentParentId = determineParent(parentNormalizedId);
        nodeMap.set(parentNormalizedId,{categoriaId:parentNormalizedId,nivel:parentLevel,parentId:parentParentId,children:[],valuesByMonth:{}});
      }
      currentId = parentNormalizedId;
    }
  }
  for (const [id,node] of nodeMap){ if (node.parentId && nodeMap.has(node.parentId)){ const parent = nodeMap.get(node.parentId); if (!parent.children.includes(id)) parent.children.push(id); } }
  function aggregate(nodeId){
    const node = nodeMap.get(nodeId); if (!node) return;
    if (node.children.length>0){
      for (const c of node.children) aggregate(c);
      for (const mes of meses){ let total=0; for (const c of node.children){ const ch=nodeMap.get(c); if(ch) total+=ch.valuesByMonth[mes]||0; } node.valuesByMonth[mes]=total; }
    }
  }
  aggregate('RECEITAS'); aggregate('DESPESAS');
  return { nodes: Array.from(nodeMap.values()), meses, rootIds:['RECEITAS','DESPESAS'] };
}

// =================== getDfc replication ===================
async function run(){
  // categorias map (verbatim query)
  const categoriasReais = await pool.query(`SELECT nome FROM "Conta Azul".caz_categorias WHERE nome IS NOT NULL`);
  const categoriaNamesMap = new Map();
  for (const row of categoriasReais.rows){
    const fullName = row.nome || '';
    const match = fullName.match(/^([^\s\t]+)[\s\t]+(.+)$/);
    if (match){ categoriaNamesMap.set(normalizeCode(match[1]), match[2]); }
  }

  const whereClauses = ["p.tipo_evento IN ('RECEITA', 'DESPESA')", "p.status = 'QUITADO'"];
  if (empresa && empresa !== 'todas') whereClauses.push(`p.empresa = '${empresa.replace(/'/g,"''")}'`);
  const dataMinima = '2025-01-01';
  const dataInicioOriginal = (dataInicio && dataInicio >= dataMinima) ? dataInicio : dataMinima;
  const d = new Date(dataInicioOriginal + 'T00:00:00'); d.setMonth(d.getMonth()-6);
  const dataInicioHistorico = d.toISOString().split('T')[0];
  const dataInicioQuery = dataInicioHistorico >= dataMinima ? dataInicioHistorico : dataMinima;
  whereClauses.push(`p.data_quitacao >= '${dataInicioQuery}'`);
  if (dataFim) whereClauses.push(`p.data_quitacao <= '${dataFim}'`);
  const whereClause = whereClauses.join(' AND ');

  const parcelas = await pool.query(`
    SELECT p.id, p.status, p.descricao,
      (COALESCE(p.valor_pago::numeric,0) - COALESCE(p.desconto::numeric,0)) as valor_pago,
      COALESCE(p.valor_pago::numeric,0) as valor_pago_bruto,
      COALESCE(p.desconto::numeric,0) as desconto,
      p.categoria_id, p.categoria_nome, p.valor_categoria, p.data_quitacao, p.tipo_evento
    FROM "Conta Azul".caz_parcelas p
    WHERE ${whereClause} ORDER BY p.data_quitacao`);

  const mesInicioOriginal = dataInicioOriginal.substring(0,7);
  const dfcMap = new Map(); const mesesSet = new Set();

  // instrumentation buckets (RECEITA, VISIBLE months only)
  const B = { totalGrossReceita:0, countedGross:0, countedNet:0,
    lost_invalid_format:0, lost_05_08:0, lost_other_prefix:0,
    n_invalid:0, n_05_08:0, n_other:0 };
  const lostByCat = new Map(); // detail of lost (gross) by raw category
  // per-month buckets
  const PM = new Map(); // mes -> {gross, net, lost_invalid, lost_05_08, lost_other}
  const pm = (mes)=>{ if(!PM.has(mes)) PM.set(mes,{gross:0,net:0,lost_invalid:0,lost_05_08:0,lost_other:0}); return PM.get(mes); };

  for (const row of parcelas.rows){
    let categoriaNomes = (row.categoria_nome||'').split(';').map(s=>s.trim()).filter(Boolean);
    const valorCategorias = (row.valor_categoria||'').split(';').map(s=>s.trim()).filter(Boolean);
    const tipoEvento = row.tipo_evento||''; const tipoEventoNormalized = tipoEvento.toUpperCase().trim();
    const valorPagoRaw = parseFloat(row.valor_pago||'0'); const valorBase = Number.isFinite(valorPagoRaw)?valorPagoRaw:0;
    const grossRaw = parseFloat(row.valor_pago_bruto||'0'); const grossBase = Number.isFinite(grossRaw)?grossRaw:0;
    if (categoriaNomes.length===0){ const fb = tipoEventoNormalized==='DESPESA'?'06.99':'03.99'; categoriaNomes=[`${fb} Outros`]; }
    const dataQuitacao = new Date(row.data_quitacao); const mes = dataQuitacao.toISOString().substring(0,7);
    mesesSet.add(mes);
    const somaValorCategorias = valorCategorias.reduce((a,v)=>a+parseFloat(v||'0'),0);
    const isVisible = mes >= mesInicioOriginal;
    const isReceitaParcela = tipoEventoNormalized === 'RECEITA';
    if (isVisible && isReceitaParcela){ B.totalGrossReceita += grossBase; pm(mes).gross += grossBase; }

    for (let i=0;i<categoriaNomes.length;i++){
      const fullCategoriaNome = categoriaNomes[i];
      let valor, gross;
      if (categoriaNomes.length===1){ valor=valorBase; gross=grossBase; }
      else {
        const vca = parseFloat(valorCategorias[i]||'0');
        if (somaValorCategorias>0){ const p=vca/somaValorCategorias; valor=valorBase*p; gross=grossBase*p; }
        else { valor=valorBase/categoriaNomes.length; gross=grossBase/categoriaNomes.length; }
      }
      const codeMatch = fullCategoriaNome.match(/^([\d.]+)\s+(.+)$/);
      if (!codeMatch){
        if (isVisible && isReceitaParcela){ B.lost_invalid_format+=gross; B.n_invalid++; pm(mes).lost_invalid+=gross; lostByCat.set('[invalid] '+fullCategoriaNome,(lostByCat.get('[invalid] '+fullCategoriaNome)||0)+gross); }
        continue;
      }
      const categoriaId = codeMatch[1];
      const twoDigitPrefix = categoriaId.substring(0,2);
      const isCategoriaReceita = (twoDigitPrefix==='03'||twoDigitPrefix==='04');
      const isCategoriaDespesa = (twoDigitPrefix==='05'||twoDigitPrefix==='06'||twoDigitPrefix==='07'||twoDigitPrefix==='08');
      const hasMismatch = (isCategoriaReceita && tipoEventoNormalized==='DESPESA') || (isCategoriaDespesa && tipoEventoNormalized==='RECEITA');
      if (hasMismatch){
        if (isVisible && isReceitaParcela){ B.lost_05_08+=gross; B.n_05_08++; pm(mes).lost_05_08+=gross; lostByCat.set(fullCategoriaNome,(lostByCat.get(fullCategoriaNome)||0)+gross); }
        continue;
      }
      const key = `${categoriaId}|${codeMatch[2]}`;
      if (!dfcMap.has(key)) dfcMap.set(key,new Map());
      const cm = dfcMap.get(key); cm.set(mes,(cm.get(mes)||0)+valor);

      // bucket for RECEITA parcelas in visible months
      if (isVisible && isReceitaParcela){
        const normTop = normalizeCode(categoriaId).substring(0,2);
        if (normTop==='03'||normTop==='04'){ B.countedGross+=gross; B.countedNet+=valor; pm(mes).net+=valor; }
        else { B.lost_other_prefix+=gross; B.n_other++; pm(mes).lost_other+=gross; lostByCat.set(fullCategoriaNome,(lostByCat.get(fullCategoriaNome)||0)+gross); }
      }
    }
  }

  const items=[];
  for (const [key,mm] of dfcMap){ const [categoriaId,categoriaNome]=key.split('|'); for (const [mes,v] of mm) items.push({categoriaId,categoriaNome,mes,valorTotal:v}); }
  const todosOsMeses = Array.from(mesesSet).sort();
  const result = buildHierarchy(items, todosOsMeses, categoriaNamesMap);
  const mesesVisiveis = result.meses.filter(m=>m>=mesInicioOriginal);

  // authoritative DFC receita = frontend computation
  const receitasNode = result.nodes.find(n=>n.categoriaId==='RECEITAS');
  const despesasNode = result.nodes.find(n=>n.categoriaId==='DESPESAS');
  let dfcReceita=0, dfcDespesa=0;
  for (const mes of mesesVisiveis){ dfcReceita += receitasNode?.valuesByMonth[mes]||0; dfcDespesa += despesasNode?.valuesByMonth[mes]||0; }

  // ---- baseline ERP candidates (simple, per visible period) ----
  const filt = (extra='') => `tipo_evento='RECEITA' ${extra} AND data_quitacao::date >= '${dataInicioOriginal}'${dataFim?` AND data_quitacao::date <= '${dataFim}'`:''}${(empresa&&empresa!=='todas')?` AND empresa='${empresa.replace(/'/g,"''")}'`:''}`;
  const q = async (s)=> (await pool.query(s)).rows[0];
  const grossQuit = await q(`SELECT COALESCE(SUM(valor_pago::numeric),0) v, COUNT(*) n FROM "Conta Azul".caz_parcelas WHERE ${filt("AND status='QUITADO'")}`);
  const liqQuit = await q(`SELECT COALESCE(SUM(valor_liquido::numeric),0) v FROM "Conta Azul".caz_parcelas WHERE ${filt("AND status='QUITADO'")}`);
  const byStatus = (await pool.query(`SELECT status, COALESCE(SUM(valor_pago::numeric),0) v, COUNT(*) n FROM "Conta Azul".caz_parcelas WHERE ${filt()} GROUP BY status ORDER BY 2 DESC`)).rows;

  const fmt = (x)=> Number(x).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  console.log('\n==================== DFC GAP DEBUG ====================');
  console.log(`Período: ${dataInicioOriginal} ${dataFim?'até '+dataFim:'(sem fim)'} | empresa: ${empresa||'todas'}`);
  console.log(`Meses visíveis: ${mesesVisiveis.join(', ')}`);
  console.log('\n--- DFC (código real) ---');
  console.log(`DFC RECEITA (autoritativo, nó RECEITAS):  R$ ${fmt(dfcReceita)}`);
  console.log(`DFC DESPESA (nó DESPESAS):                R$ ${fmt(dfcDespesa)}`);
  console.log('\n--- Baselines ERP (RECEITA, período visível) ---');
  console.log(`Σ valor_pago (status=QUITADO, todas cats): R$ ${fmt(grossQuit.v)}  [n=${grossQuit.n}]  <-- candidato ERP`);
  console.log(`Σ valor_liquido (QUITADO):                 R$ ${fmt(liqQuit.v)}`);
  console.log('\n--- Receita por status (valor_pago) ---');
  for (const r of byStatus) console.log(`  ${r.status.padEnd(18)} R$ ${fmt(r.v).padStart(15)}  [n=${r.n}]`);
  console.log('\n--- DECOMPOSIÇÃO DO GAP (RECEITA QUITADO, meses visíveis) ---');
  console.log(`Σ valor_pago bruto (controle):             R$ ${fmt(B.totalGrossReceita)}`);
  console.log(`  (=) Receita classificada 03/04 [gross]:  R$ ${fmt(B.countedGross)}`);
  console.log(`  (-) desconto sobre receita contada:      R$ ${fmt(B.countedGross - B.countedNet)}`);
  console.log(`  (=) DFC receita contada [net]:           R$ ${fmt(B.countedNet)}   (deve ≈ DFC autoritativo)`);
  console.log(`  PERDAS (gross) por categoria não-receita:`);
  console.log(`    • formato inválido (sem código):       R$ ${fmt(B.lost_invalid_format)}  [${B.n_invalid} cats]`);
  console.log(`    • prefixo despesa 05-08 (hasMismatch):  R$ ${fmt(B.lost_05_08)}  [${B.n_05_08} cats]`);
  console.log(`    • prefixo ≠03/04 (vai p/ DESPESAS):     R$ ${fmt(B.lost_other_prefix)}  [${B.n_other} cats]`);
  const gapVsGross = Number(grossQuit.v) - dfcReceita;
  console.log(`\nGAP (Σvalor_pago QUITADO − DFC receita):    R$ ${fmt(gapVsGross)}`);
  console.log(`Soma das perdas + desconto:                R$ ${fmt(B.lost_invalid_format + B.lost_05_08 + B.lost_other_prefix + (B.countedGross-B.countedNet))}`);
  console.log('\n--- TABELA POR MÊS (gross = Σvalor_pago QUITADO; DFC = receita contada; gap = gross−DFC) ---');
  console.log('  mês       gross           DFC(net)        gap        desconto   perda05-08  perda≠0304  perdaInval');
  for (const mes of Array.from(PM.keys()).sort()){
    const r = PM.get(mes);
    const desconto = r.gross - r.lost_invalid - r.lost_05_08 - r.lost_other - r.net;
    const gap = r.gross - r.net;
    console.log(`  ${mes}  ${fmt(r.gross).padStart(14)}  ${fmt(r.net).padStart(14)}  ${fmt(gap).padStart(9)}  ${fmt(desconto).padStart(9)}  ${fmt(r.lost_05_08).padStart(9)}  ${fmt(r.lost_other).padStart(9)}  ${fmt(r.lost_invalid).padStart(9)}`);
  }
  if (lostByCat.size){
    console.log('\n--- Detalhe das categorias perdidas (gross) ---');
    for (const [k,v] of Array.from(lostByCat.entries()).sort((a,b)=>b[1]-a[1])) console.log(`    R$ ${fmt(v).padStart(14)}  ${k}`);
  }
  console.log('======================================================\n');
  await pool.end();
}
run().catch(e=>{ console.error(e); process.exit(1); });
