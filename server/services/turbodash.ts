import jwt from 'jsonwebtoken';
import { db } from '../db';
import { 
  turbodashKpis,
  type TurbodashClientResponse,
  type TurbodashListResponse,
  type TurbodashApiResponse,
  type TurbodashApiListResponse
} from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

const TURBODASH_API_URL = process.env.TURBODASH_API_URL || 'https://app.turbodash.com.br';
const TURBODASH_API_SECRET = process.env.TURBODASH_API_SECRET;
const CACHE_TTL_MINUTES = 15;

// Transform TurboDash API response to internal normalized format
function transformApiResponse(apiData: TurbodashApiResponse): TurbodashClientResponse {
  const { client, period, metrics } = apiData;
  
  return {
    cnpj: client.cnpj,
    nome_cliente: client.name,
    periodo_inicio: period.current.start,
    periodo_fim: period.current.end,
    kpis: {
      faturamento: metrics.revenue.current,
      faturamento_variacao: metrics.revenue.growth,
      investimento: metrics.adSpend.current,
      investimento_variacao: metrics.adSpend.growth,
      roas: metrics.roas.current,
      roas_variacao: metrics.roas.growth,
      compras: metrics.purchases.current,
      compras_variacao: metrics.purchases.growth,
      cpa: metrics.cpa.current,
      cpa_variacao: metrics.cpa.growth,
      ticket_medio: metrics.avgTicket.current,
      ticket_medio_variacao: metrics.avgTicket.growth,
      sessoes: metrics.sessions.current,
      sessoes_variacao: metrics.sessions.growth,
      cps: metrics.cps.current,
      cps_variacao: metrics.cps.growth,
      taxa_conversao: metrics.conversionRate.current,
      taxa_conversao_variacao: metrics.conversionRate.growth,
      taxa_recorrencia: metrics.recurrenceRate.current,
      taxa_recorrencia_variacao: metrics.recurrenceRate.growth,
    },
    ultima_atualizacao: new Date().toISOString(),
  };
}

function generateToken(): string {
  if (!TURBODASH_API_SECRET) {
    throw new Error('TURBODASH_API_SECRET not configured');
  }
  
  return jwt.sign(
    { name: 'turbo-cortex', iat: Math.floor(Date.now() / 1000) },
    TURBODASH_API_SECRET,
    { expiresIn: '1h' }
  );
}

async function fetchFromTurbodash<T>(endpoint: string): Promise<T> {
  const token = generateToken();
  
  const response = await fetch(`${TURBODASH_API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TurboDash API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

function isCacheStale(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return true;
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSyncedAt.getTime()) / (1000 * 60);
  return diffMinutes > CACHE_TTL_MINUTES;
}

export async function getKPIsByCNPJ(cnpj: string, forceRefresh = false): Promise<TurbodashClientResponse | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  const cached = await db
    .select()
    .from(turbodashKpis)
    .where(eq(turbodashKpis.cnpj, cnpjLimpo))
    .orderBy(desc(turbodashKpis.lastSyncedAt))
    .limit(1);
  
  if (cached.length > 0 && !forceRefresh && !isCacheStale(cached[0].lastSyncedAt)) {
    const c = cached[0];
    return {
      cnpj: c.cnpj,
      nome_cliente: c.clienteNome || '',
      periodo_inicio: c.periodoInicio,
      periodo_fim: c.periodoFim,
      kpis: {
        faturamento: Number(c.faturamento) || 0,
        faturamento_variacao: Number(c.faturamentoVariacao) || 0,
        investimento: Number(c.investimento) || 0,
        investimento_variacao: Number(c.investimentoVariacao) || 0,
        roas: Number(c.roas) || 0,
        roas_variacao: Number(c.roasVariacao) || 0,
        compras: c.compras || 0,
        compras_variacao: Number(c.comprasVariacao) || 0,
        cpa: Number(c.cpa) || 0,
        cpa_variacao: Number(c.cpaVariacao) || 0,
        ticket_medio: Number(c.ticketMedio) || 0,
        ticket_medio_variacao: Number(c.ticketMedioVariacao) || 0,
        sessoes: c.sessoes || 0,
        sessoes_variacao: Number(c.sessoesVariacao) || 0,
        cps: Number(c.cps) || 0,
        cps_variacao: Number(c.cpsVariacao) || 0,
        taxa_conversao: Number(c.taxaConversao) || 0,
        taxa_conversao_variacao: Number(c.taxaConversaoVariacao) || 0,
        taxa_recorrencia: Number(c.taxaRecorrencia) || 0,
        taxa_recorrencia_variacao: Number(c.taxaRecorrenciaVariacao) || 0,
      },
      ultima_atualizacao: c.lastSyncedAt?.toISOString() || new Date().toISOString(),
    };
  }
  
  if (!TURBODASH_API_SECRET) {
    console.warn('[TurboDash] API secret not configured, returning cached data only');
    return cached.length > 0 ? {
      cnpj: cached[0].cnpj,
      nome_cliente: cached[0].clienteNome || '',
      periodo_inicio: cached[0].periodoInicio,
      periodo_fim: cached[0].periodoFim,
      kpis: {
        faturamento: Number(cached[0].faturamento) || 0,
        faturamento_variacao: Number(cached[0].faturamentoVariacao) || 0,
        investimento: Number(cached[0].investimento) || 0,
        investimento_variacao: Number(cached[0].investimentoVariacao) || 0,
        roas: Number(cached[0].roas) || 0,
        roas_variacao: Number(cached[0].roasVariacao) || 0,
        compras: cached[0].compras || 0,
        compras_variacao: Number(cached[0].comprasVariacao) || 0,
        cpa: Number(cached[0].cpa) || 0,
        cpa_variacao: Number(cached[0].cpaVariacao) || 0,
        ticket_medio: Number(cached[0].ticketMedio) || 0,
        ticket_medio_variacao: Number(cached[0].ticketMedioVariacao) || 0,
        sessoes: cached[0].sessoes || 0,
        sessoes_variacao: Number(cached[0].sessoesVariacao) || 0,
        cps: Number(cached[0].cps) || 0,
        cps_variacao: Number(cached[0].cpsVariacao) || 0,
        taxa_conversao: Number(cached[0].taxaConversao) || 0,
        taxa_conversao_variacao: Number(cached[0].taxaConversaoVariacao) || 0,
        taxa_recorrencia: Number(cached[0].taxaRecorrencia) || 0,
        taxa_recorrencia_variacao: Number(cached[0].taxaRecorrenciaVariacao) || 0,
      },
      ultima_atualizacao: cached[0].lastSyncedAt?.toISOString() || new Date().toISOString(),
    } : null;
  }
  
  try {
    // Fetch from TurboDash API using new format
    const apiData = await fetchFromTurbodash<TurbodashApiResponse>(`/api/internal/metrics/${cnpjLimpo}`);
    
    // Transform to internal normalized format
    const data = transformApiResponse(apiData);
    
    await saveKPIToCache(data);
    
    return data;
  } catch (error) {
    console.error('[TurboDash] Error fetching KPIs:', error);
    
    if (cached.length > 0) {
      await db
        .update(turbodashKpis)
        .set({ syncStatus: 'error' })
        .where(eq(turbodashKpis.id, cached[0].id));
    }
    
    return cached.length > 0 ? {
      cnpj: cached[0].cnpj,
      nome_cliente: cached[0].clienteNome || '',
      periodo_inicio: cached[0].periodoInicio,
      periodo_fim: cached[0].periodoFim,
      kpis: {
        faturamento: Number(cached[0].faturamento) || 0,
        faturamento_variacao: Number(cached[0].faturamentoVariacao) || 0,
        investimento: Number(cached[0].investimento) || 0,
        investimento_variacao: Number(cached[0].investimentoVariacao) || 0,
        roas: Number(cached[0].roas) || 0,
        roas_variacao: Number(cached[0].roasVariacao) || 0,
        compras: cached[0].compras || 0,
        compras_variacao: Number(cached[0].comprasVariacao) || 0,
        cpa: Number(cached[0].cpa) || 0,
        cpa_variacao: Number(cached[0].cpaVariacao) || 0,
        ticket_medio: Number(cached[0].ticketMedio) || 0,
        ticket_medio_variacao: Number(cached[0].ticketMedioVariacao) || 0,
        sessoes: cached[0].sessoes || 0,
        sessoes_variacao: Number(cached[0].sessoesVariacao) || 0,
        cps: Number(cached[0].cps) || 0,
        cps_variacao: Number(cached[0].cpsVariacao) || 0,
        taxa_conversao: Number(cached[0].taxaConversao) || 0,
        taxa_conversao_variacao: Number(cached[0].taxaConversaoVariacao) || 0,
        taxa_recorrencia: Number(cached[0].taxaRecorrencia) || 0,
        taxa_recorrencia_variacao: Number(cached[0].taxaRecorrenciaVariacao) || 0,
      },
      ultima_atualizacao: cached[0].lastSyncedAt?.toISOString() || new Date().toISOString(),
    } : null;
  }
}

export async function getAllKPIs(forceRefresh = false): Promise<TurbodashListResponse> {
  const cached = await db
    .select()
    .from(turbodashKpis)
    .orderBy(desc(turbodashKpis.faturamento));
  
  const hasStaleData = cached.some(c => isCacheStale(c.lastSyncedAt));
  
  if (!forceRefresh && !hasStaleData && cached.length > 0) {
    return {
      total: cached.length,
      periodo_inicio: cached[0]?.periodoInicio || new Date().toISOString().split('T')[0],
      periodo_fim: cached[0]?.periodoFim || new Date().toISOString().split('T')[0],
      clientes: cached.map(c => ({
        cnpj: c.cnpj,
        nome_cliente: c.clienteNome || '',
        periodo_inicio: c.periodoInicio,
        periodo_fim: c.periodoFim,
        kpis: {
          faturamento: Number(c.faturamento) || 0,
          faturamento_variacao: Number(c.faturamentoVariacao) || 0,
          investimento: Number(c.investimento) || 0,
          investimento_variacao: Number(c.investimentoVariacao) || 0,
          roas: Number(c.roas) || 0,
          roas_variacao: Number(c.roasVariacao) || 0,
          compras: c.compras || 0,
          compras_variacao: Number(c.comprasVariacao) || 0,
          cpa: Number(c.cpa) || 0,
          cpa_variacao: Number(c.cpaVariacao) || 0,
          ticket_medio: Number(c.ticketMedio) || 0,
          ticket_medio_variacao: Number(c.ticketMedioVariacao) || 0,
          sessoes: c.sessoes || 0,
          sessoes_variacao: Number(c.sessoesVariacao) || 0,
          cps: Number(c.cps) || 0,
          cps_variacao: Number(c.cpsVariacao) || 0,
          taxa_conversao: Number(c.taxaConversao) || 0,
          taxa_conversao_variacao: Number(c.taxaConversaoVariacao) || 0,
          taxa_recorrencia: Number(c.taxaRecorrencia) || 0,
          taxa_recorrencia_variacao: Number(c.taxaRecorrenciaVariacao) || 0,
        },
        ultima_atualizacao: c.lastSyncedAt?.toISOString() || new Date().toISOString(),
      })),
    };
  }
  
  if (!TURBODASH_API_SECRET) {
    console.warn('[TurboDash] API secret not configured, returning cached data only');
    return {
      total: cached.length,
      periodo_inicio: cached[0]?.periodoInicio || new Date().toISOString().split('T')[0],
      periodo_fim: cached[0]?.periodoFim || new Date().toISOString().split('T')[0],
      clientes: cached.map(c => ({
        cnpj: c.cnpj,
        nome_cliente: c.clienteNome || '',
        periodo_inicio: c.periodoInicio,
        periodo_fim: c.periodoFim,
        kpis: {
          faturamento: Number(c.faturamento) || 0,
          faturamento_variacao: Number(c.faturamentoVariacao) || 0,
          investimento: Number(c.investimento) || 0,
          investimento_variacao: Number(c.investimentoVariacao) || 0,
          roas: Number(c.roas) || 0,
          roas_variacao: Number(c.roasVariacao) || 0,
          compras: c.compras || 0,
          compras_variacao: Number(c.comprasVariacao) || 0,
          cpa: Number(c.cpa) || 0,
          cpa_variacao: Number(c.cpaVariacao) || 0,
          ticket_medio: Number(c.ticketMedio) || 0,
          ticket_medio_variacao: Number(c.ticketMedioVariacao) || 0,
          sessoes: c.sessoes || 0,
          sessoes_variacao: Number(c.sessoesVariacao) || 0,
          cps: Number(c.cps) || 0,
          cps_variacao: Number(c.cpsVariacao) || 0,
          taxa_conversao: Number(c.taxaConversao) || 0,
          taxa_conversao_variacao: Number(c.taxaConversaoVariacao) || 0,
          taxa_recorrencia: Number(c.taxaRecorrencia) || 0,
          taxa_recorrencia_variacao: Number(c.taxaRecorrenciaVariacao) || 0,
        },
        ultima_atualizacao: c.lastSyncedAt?.toISOString() || new Date().toISOString(),
      })),
    };
  }
  
  try {
    // Fetch list of all clients from TurboDash API
    // API can return either a structured response or an array
    const rawData = await fetchFromTurbodash<TurbodashApiListResponse | TurbodashApiResponse[]>('/api/internal/metrics');
    
    let clientes: TurbodashClientResponse[];
    let periodStart: string;
    let periodEnd: string;
    let total: number;
    
    if (Array.isArray(rawData)) {
      // API returned a simple array
      clientes = rawData.map(transformApiResponse);
      const firstCliente = clientes[0];
      periodStart = firstCliente?.periodo_inicio || new Date().toISOString().split('T')[0];
      periodEnd = firstCliente?.periodo_fim || new Date().toISOString().split('T')[0];
      total = clientes.length;
    } else {
      // API returned a structured response
      clientes = rawData.clients.map(transformApiResponse);
      periodStart = rawData.period?.current.start || clientes[0]?.periodo_inicio || new Date().toISOString().split('T')[0];
      periodEnd = rawData.period?.current.end || clientes[0]?.periodo_fim || new Date().toISOString().split('T')[0];
      total = rawData.total ?? clientes.length;
    }
    
    // Cache each client's data
    for (const cliente of clientes) {
      await saveKPIToCache(cliente);
    }
    
    return {
      total,
      periodo_inicio: periodStart,
      periodo_fim: periodEnd,
      clientes,
    };
  } catch (error) {
    console.error('[TurboDash] Error fetching KPI list:', error);
    return {
      total: cached.length,
      periodo_inicio: cached[0]?.periodoInicio || new Date().toISOString().split('T')[0],
      periodo_fim: cached[0]?.periodoFim || new Date().toISOString().split('T')[0],
      clientes: cached.map(c => ({
        cnpj: c.cnpj,
        nome_cliente: c.clienteNome || '',
        periodo_inicio: c.periodoInicio,
        periodo_fim: c.periodoFim,
        kpis: {
          faturamento: Number(c.faturamento) || 0,
          faturamento_variacao: Number(c.faturamentoVariacao) || 0,
          investimento: Number(c.investimento) || 0,
          investimento_variacao: Number(c.investimentoVariacao) || 0,
          roas: Number(c.roas) || 0,
          roas_variacao: Number(c.roasVariacao) || 0,
          compras: c.compras || 0,
          compras_variacao: Number(c.comprasVariacao) || 0,
          cpa: Number(c.cpa) || 0,
          cpa_variacao: Number(c.cpaVariacao) || 0,
          ticket_medio: Number(c.ticketMedio) || 0,
          ticket_medio_variacao: Number(c.ticketMedioVariacao) || 0,
          sessoes: c.sessoes || 0,
          sessoes_variacao: Number(c.sessoesVariacao) || 0,
          cps: Number(c.cps) || 0,
          cps_variacao: Number(c.cpsVariacao) || 0,
          taxa_conversao: Number(c.taxaConversao) || 0,
          taxa_conversao_variacao: Number(c.taxaConversaoVariacao) || 0,
          taxa_recorrencia: Number(c.taxaRecorrencia) || 0,
          taxa_recorrencia_variacao: Number(c.taxaRecorrenciaVariacao) || 0,
        },
        ultima_atualizacao: c.lastSyncedAt?.toISOString() || new Date().toISOString(),
      })),
    };
  }
}

async function saveKPIToCache(data: TurbodashClientResponse): Promise<void> {
  const cnpjLimpo = data.cnpj.replace(/\D/g, '');
  
  const clienteIdCortex = await findClienteIdByCNPJ(cnpjLimpo);
  
  const existing = await db
    .select()
    .from(turbodashKpis)
    .where(eq(turbodashKpis.cnpj, cnpjLimpo))
    .limit(1);
  
  const kpiData = {
    cnpj: cnpjLimpo,
    clienteNome: data.nome_cliente,
    clienteIdCortex,
    periodoInicio: data.periodo_inicio,
    periodoFim: data.periodo_fim,
    faturamento: String(data.kpis.faturamento),
    faturamentoVariacao: String(data.kpis.faturamento_variacao),
    investimento: String(data.kpis.investimento),
    investimentoVariacao: String(data.kpis.investimento_variacao),
    roas: String(data.kpis.roas),
    roasVariacao: String(data.kpis.roas_variacao),
    compras: data.kpis.compras,
    comprasVariacao: String(data.kpis.compras_variacao),
    cpa: String(data.kpis.cpa),
    cpaVariacao: String(data.kpis.cpa_variacao),
    ticketMedio: String(data.kpis.ticket_medio),
    ticketMedioVariacao: String(data.kpis.ticket_medio_variacao),
    sessoes: data.kpis.sessoes,
    sessoesVariacao: String(data.kpis.sessoes_variacao),
    cps: String(data.kpis.cps),
    cpsVariacao: String(data.kpis.cps_variacao),
    taxaConversao: String(data.kpis.taxa_conversao),
    taxaConversaoVariacao: String(data.kpis.taxa_conversao_variacao),
    taxaRecorrencia: String(data.kpis.taxa_recorrencia),
    taxaRecorrenciaVariacao: String(data.kpis.taxa_recorrencia_variacao),
    syncStatus: 'fresh' as const,
    lastSyncedAt: new Date(),
  };
  
  if (existing.length > 0) {
    await db
      .update(turbodashKpis)
      .set(kpiData)
      .where(eq(turbodashKpis.id, existing[0].id));
  } else {
    await db.insert(turbodashKpis).values(kpiData);
  }
}

async function findClienteIdByCNPJ(cnpj: string): Promise<number | null> {
  try {
    const result = await db.execute(
      sql`SELECT id FROM caz_clientes WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '') = ${cnpj} LIMIT 1`
    );
    const rows = result.rows as { id: number }[];
    return rows[0]?.id || null;
  } catch (error) {
    console.error('[TurboDash] Error finding cliente by CNPJ:', error);
    return null;
  }
}

export async function verifyTurbodashCNPJ(cnpj: string): Promise<{ existe: boolean; nome_cliente?: string }> {
  if (!TURBODASH_API_SECRET) {
    return { existe: false };
  }
  
  try {
    const data = await fetchFromTurbodash<{ existe: boolean; cnpj: string; nome_cliente?: string }>(
      `/api/clientes/verificar/${cnpj.replace(/\D/g, '')}`
    );
    return data;
  } catch (error) {
    console.error('[TurboDash] Error verifying CNPJ:', error);
    return { existe: false };
  }
}

export async function initTurbodashTable(): Promise<void> {
  try {
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS staging`);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staging.turbodash_kpis (
        id SERIAL PRIMARY KEY,
        cnpj VARCHAR(20) NOT NULL,
        cliente_nome VARCHAR(255),
        cliente_id_cortex INTEGER,
        periodo_inicio DATE NOT NULL,
        periodo_fim DATE NOT NULL,
        faturamento DECIMAL(18, 2),
        faturamento_variacao DECIMAL(8, 2),
        investimento DECIMAL(18, 2),
        investimento_variacao DECIMAL(8, 2),
        roas DECIMAL(10, 4),
        roas_variacao DECIMAL(8, 2),
        compras INTEGER,
        compras_variacao DECIMAL(8, 2),
        cpa DECIMAL(12, 2),
        cpa_variacao DECIMAL(8, 2),
        ticket_medio DECIMAL(12, 2),
        ticket_medio_variacao DECIMAL(8, 2),
        sessoes INTEGER,
        sessoes_variacao DECIMAL(8, 2),
        cps DECIMAL(12, 2),
        cps_variacao DECIMAL(8, 2),
        taxa_conversao DECIMAL(8, 4),
        taxa_conversao_variacao DECIMAL(8, 2),
        taxa_recorrencia DECIMAL(8, 4),
        taxa_recorrencia_variacao DECIMAL(8, 2),
        sync_status VARCHAR(20) NOT NULL DEFAULT 'fresh',
        last_synced_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_turbodash_kpis_cnpj ON staging.turbodash_kpis(cnpj)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_turbodash_kpis_cliente_id ON staging.turbodash_kpis(cliente_id_cortex)`);
    
    console.log('[TurboDash] Table initialized');
  } catch (error) {
    console.error('[TurboDash] Error initializing table (non-blocking):', error);
  }
}
