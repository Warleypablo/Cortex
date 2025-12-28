import { db } from '../db';
import { 
  turbodashKpis,
  type TurbodashClientResponse,
  type TurbodashListResponse,
  type TurbodashApiResponse,
  type TurbodashApiListResponse
} from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

// Internal API configuration - uses INTERNAL_API_TOKEN for authentication
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:5000';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;
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

async function fetchFromInternalAPI<T>(endpoint: string): Promise<T> {
  if (!INTERNAL_API_TOKEN) {
    throw new Error('INTERNAL_API_TOKEN not configured');
  }
  
  const response = await fetch(`${INTERNAL_API_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${INTERNAL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Internal API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

function isCacheStale(lastSyncedAt: Date | null): boolean {
  if (!lastSyncedAt) return true;
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSyncedAt.getTime()) / (1000 * 60);
  return diffMinutes > CACHE_TTL_MINUTES;
}

// Demo data for when table doesn't exist or no data available
function getDemoKPIs(cnpj: string): TurbodashClientResponse {
  return {
    cnpj,
    nome_cliente: 'Cliente Demo',
    periodo_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    periodo_fim: new Date().toISOString().split('T')[0],
    kpis: {
      faturamento: 125000,
      faturamento_variacao: 12.5,
      investimento: 15000,
      investimento_variacao: -5.2,
      roas: 8.33,
      roas_variacao: 18.7,
      compras: 450,
      compras_variacao: 8.3,
      cpa: 33.33,
      cpa_variacao: -12.1,
      ticket_medio: 277.78,
      ticket_medio_variacao: 3.8,
      sessoes: 12500,
      sessoes_variacao: 15.2,
      cps: 1.2,
      cps_variacao: -17.4,
      taxa_conversao: 3.6,
      taxa_conversao_variacao: -5.9,
      taxa_recorrencia: 28.5,
      taxa_recorrencia_variacao: 4.2,
    },
    ultima_atualizacao: new Date().toISOString(),
    is_demo: true,
  };
}

export async function getKPIsByCNPJ(cnpj: string, forceRefresh = false): Promise<TurbodashClientResponse | null> {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  
  let cached: any[] = [];
  try {
    // Use raw SQL to properly access staging schema
    const result = await db.execute(sql`
      SELECT * FROM staging.turbodash_kpis 
      WHERE cnpj = ${cnpjLimpo}
      ORDER BY last_synced_at DESC
      LIMIT 1
    `);
    cached = result.rows as any[];
  } catch (error: any) {
    // If table doesn't exist, return demo data
    if (error.code === '42P01') {
      console.warn('[TurboDash] Table does not exist, returning demo data');
      return getDemoKPIs(cnpjLimpo);
    }
    console.error('[TurboDash] Database error:', error);
    return getDemoKPIs(cnpjLimpo);
  }
  
  if (cached.length > 0 && !forceRefresh && !isCacheStale(cached[0].last_synced_at)) {
    const c = cached[0];
    return {
      cnpj: c.cnpj,
      nome_cliente: c.cliente_nome || '',
      periodo_inicio: c.periodo_inicio,
      periodo_fim: c.periodo_fim,
      kpis: {
        faturamento: Number(c.faturamento) || 0,
        faturamento_variacao: Number(c.faturamento_variacao) || 0,
        investimento: Number(c.investimento) || 0,
        investimento_variacao: Number(c.investimento_variacao) || 0,
        roas: Number(c.roas) || 0,
        roas_variacao: Number(c.roas_variacao) || 0,
        compras: c.compras || 0,
        compras_variacao: Number(c.compras_variacao) || 0,
        cpa: Number(c.cpa) || 0,
        cpa_variacao: Number(c.cpa_variacao) || 0,
        ticket_medio: Number(c.ticket_medio) || 0,
        ticket_medio_variacao: Number(c.ticket_medio_variacao) || 0,
        sessoes: c.sessoes || 0,
        sessoes_variacao: Number(c.sessoes_variacao) || 0,
        cps: Number(c.cps) || 0,
        cps_variacao: Number(c.cps_variacao) || 0,
        taxa_conversao: Number(c.taxa_conversao) || 0,
        taxa_conversao_variacao: Number(c.taxa_conversao_variacao) || 0,
        taxa_recorrencia: Number(c.taxa_recorrencia) || 0,
        taxa_recorrencia_variacao: Number(c.taxa_recorrencia_variacao) || 0,
      },
      ultima_atualizacao: c.last_synced_at?.toISOString() || new Date().toISOString(),
    };
  }
  
  // Helper to transform cached row to response format
  const transformCachedRow = (c: any): TurbodashClientResponse => ({
    cnpj: c.cnpj,
    nome_cliente: c.cliente_nome || '',
    periodo_inicio: c.periodo_inicio,
    periodo_fim: c.periodo_fim,
    kpis: {
      faturamento: Number(c.faturamento) || 0,
      faturamento_variacao: Number(c.faturamento_variacao) || 0,
      investimento: Number(c.investimento) || 0,
      investimento_variacao: Number(c.investimento_variacao) || 0,
      roas: Number(c.roas) || 0,
      roas_variacao: Number(c.roas_variacao) || 0,
      compras: c.compras || 0,
      compras_variacao: Number(c.compras_variacao) || 0,
      cpa: Number(c.cpa) || 0,
      cpa_variacao: Number(c.cpa_variacao) || 0,
      ticket_medio: Number(c.ticket_medio) || 0,
      ticket_medio_variacao: Number(c.ticket_medio_variacao) || 0,
      sessoes: c.sessoes || 0,
      sessoes_variacao: Number(c.sessoes_variacao) || 0,
      cps: Number(c.cps) || 0,
      cps_variacao: Number(c.cps_variacao) || 0,
      taxa_conversao: Number(c.taxa_conversao) || 0,
      taxa_conversao_variacao: Number(c.taxa_conversao_variacao) || 0,
      taxa_recorrencia: Number(c.taxa_recorrencia) || 0,
      taxa_recorrencia_variacao: Number(c.taxa_recorrencia_variacao) || 0,
    },
    ultima_atualizacao: c.last_synced_at?.toISOString() || new Date().toISOString(),
  });

  if (!TURBODASH_API_SECRET) {
    console.warn('[TurboDash] API secret not configured, returning cached data only');
    return cached.length > 0 ? transformCachedRow(cached[0]) : getDemoKPIs(cnpjLimpo);
  }
  
  try {
    // Fetch from TurboDash API using new format
    const apiData = await fetchFromInternalAPI<TurbodashApiResponse>(`/api/internal/metrics/${cnpjLimpo}`);
    
    // Transform to internal normalized format
    const data = transformApiResponse(apiData);
    
    await saveKPIToCache(data);
    
    return data;
  } catch (error) {
    console.error('[TurboDash] Error fetching KPIs:', error);
    
    if (cached.length > 0) {
      try {
        await db.execute(sql`
          UPDATE staging.turbodash_kpis 
          SET sync_status = 'error' 
          WHERE id = ${cached[0].id}
        `);
      } catch (updateError) {
        console.error('[TurboDash] Error updating sync status:', updateError);
      }
    }
    
    return cached.length > 0 ? transformCachedRow(cached[0]) : getDemoKPIs(cnpjLimpo);
  }
}

// Helper to transform cached row to response format (for getAllKPIs)
function transformCachedRowFromDb(c: any): TurbodashClientResponse {
  return {
    cnpj: c.cnpj,
    nome_cliente: c.cliente_nome || '',
    periodo_inicio: c.periodo_inicio,
    periodo_fim: c.periodo_fim,
    kpis: {
      faturamento: Number(c.faturamento) || 0,
      faturamento_variacao: Number(c.faturamento_variacao) || 0,
      investimento: Number(c.investimento) || 0,
      investimento_variacao: Number(c.investimento_variacao) || 0,
      roas: Number(c.roas) || 0,
      roas_variacao: Number(c.roas_variacao) || 0,
      compras: c.compras || 0,
      compras_variacao: Number(c.compras_variacao) || 0,
      cpa: Number(c.cpa) || 0,
      cpa_variacao: Number(c.cpa_variacao) || 0,
      ticket_medio: Number(c.ticket_medio) || 0,
      ticket_medio_variacao: Number(c.ticket_medio_variacao) || 0,
      sessoes: c.sessoes || 0,
      sessoes_variacao: Number(c.sessoes_variacao) || 0,
      cps: Number(c.cps) || 0,
      cps_variacao: Number(c.cps_variacao) || 0,
      taxa_conversao: Number(c.taxa_conversao) || 0,
      taxa_conversao_variacao: Number(c.taxa_conversao_variacao) || 0,
      taxa_recorrencia: Number(c.taxa_recorrencia) || 0,
      taxa_recorrencia_variacao: Number(c.taxa_recorrencia_variacao) || 0,
    },
    ultima_atualizacao: c.last_synced_at?.toISOString() || new Date().toISOString(),
  };
}

export async function getAllKPIs(forceRefresh = false): Promise<TurbodashListResponse> {
  let cached: any[] = [];
  try {
    const result = await db.execute(sql`
      SELECT * FROM staging.turbodash_kpis ORDER BY faturamento DESC
    `);
    cached = result.rows as any[];
  } catch (error: any) {
    if (error.code === '42P01') {
      console.warn('[TurboDash] Table does not exist for getAllKPIs');
    } else {
      console.error('[TurboDash] Error fetching all KPIs:', error);
    }
  }
  
  const hasStaleData = cached.some(c => isCacheStale(c.last_synced_at));
  
  if (!forceRefresh && !hasStaleData && cached.length > 0) {
    return {
      total: cached.length,
      periodo_inicio: cached[0]?.periodo_inicio || new Date().toISOString().split('T')[0],
      periodo_fim: cached[0]?.periodo_fim || new Date().toISOString().split('T')[0],
      clientes: cached.map(transformCachedRowFromDb),
    };
  }
  
  if (!TURBODASH_API_SECRET) {
    console.warn('[TurboDash] API secret not configured, returning cached data only');
    return {
      total: cached.length,
      periodo_inicio: cached[0]?.periodo_inicio || new Date().toISOString().split('T')[0],
      periodo_fim: cached[0]?.periodo_fim || new Date().toISOString().split('T')[0],
      clientes: cached.map(transformCachedRowFromDb),
    };
  }
  
  try {
    // Fetch list of all clients from TurboDash API
    // API can return either a structured response or an array
    const rawData = await fetchFromInternalAPI<TurbodashApiListResponse | TurbodashApiResponse[]>('/api/internal/metrics');
    
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
      periodo_inicio: cached[0]?.periodo_inicio || new Date().toISOString().split('T')[0],
      periodo_fim: cached[0]?.periodo_fim || new Date().toISOString().split('T')[0],
      clientes: cached.map(transformCachedRowFromDb),
    };
  }
}

async function saveKPIToCache(data: TurbodashClientResponse): Promise<void> {
  const cnpjLimpo = data.cnpj.replace(/\D/g, '');
  
  const clienteIdCortex = await findClienteIdByCNPJ(cnpjLimpo);
  
  try {
    // Check if exists using raw SQL
    const existingResult = await db.execute(sql`
      SELECT id FROM staging.turbodash_kpis WHERE cnpj = ${cnpjLimpo} LIMIT 1
    `);
    const existing = existingResult.rows as { id: number }[];
    
    if (existing.length > 0) {
      await db.execute(sql`
        UPDATE staging.turbodash_kpis SET
          cliente_nome = ${data.nome_cliente},
          cliente_id_cortex = ${clienteIdCortex},
          periodo_inicio = ${data.periodo_inicio},
          periodo_fim = ${data.periodo_fim},
          faturamento = ${data.kpis.faturamento},
          faturamento_variacao = ${data.kpis.faturamento_variacao},
          investimento = ${data.kpis.investimento},
          investimento_variacao = ${data.kpis.investimento_variacao},
          roas = ${data.kpis.roas},
          roas_variacao = ${data.kpis.roas_variacao},
          compras = ${data.kpis.compras},
          compras_variacao = ${data.kpis.compras_variacao},
          cpa = ${data.kpis.cpa},
          cpa_variacao = ${data.kpis.cpa_variacao},
          ticket_medio = ${data.kpis.ticket_medio},
          ticket_medio_variacao = ${data.kpis.ticket_medio_variacao},
          sessoes = ${data.kpis.sessoes},
          sessoes_variacao = ${data.kpis.sessoes_variacao},
          cps = ${data.kpis.cps},
          cps_variacao = ${data.kpis.cps_variacao},
          taxa_conversao = ${data.kpis.taxa_conversao},
          taxa_conversao_variacao = ${data.kpis.taxa_conversao_variacao},
          taxa_recorrencia = ${data.kpis.taxa_recorrencia},
          taxa_recorrencia_variacao = ${data.kpis.taxa_recorrencia_variacao},
          sync_status = 'fresh',
          last_synced_at = NOW()
        WHERE id = ${existing[0].id}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO staging.turbodash_kpis (
          cnpj, cliente_nome, cliente_id_cortex, periodo_inicio, periodo_fim,
          faturamento, faturamento_variacao, investimento, investimento_variacao,
          roas, roas_variacao, compras, compras_variacao, cpa, cpa_variacao,
          ticket_medio, ticket_medio_variacao, sessoes, sessoes_variacao,
          cps, cps_variacao, taxa_conversao, taxa_conversao_variacao,
          taxa_recorrencia, taxa_recorrencia_variacao, sync_status, last_synced_at
        ) VALUES (
          ${cnpjLimpo}, ${data.nome_cliente}, ${clienteIdCortex}, 
          ${data.periodo_inicio}, ${data.periodo_fim},
          ${data.kpis.faturamento}, ${data.kpis.faturamento_variacao},
          ${data.kpis.investimento}, ${data.kpis.investimento_variacao},
          ${data.kpis.roas}, ${data.kpis.roas_variacao},
          ${data.kpis.compras}, ${data.kpis.compras_variacao},
          ${data.kpis.cpa}, ${data.kpis.cpa_variacao},
          ${data.kpis.ticket_medio}, ${data.kpis.ticket_medio_variacao},
          ${data.kpis.sessoes}, ${data.kpis.sessoes_variacao},
          ${data.kpis.cps}, ${data.kpis.cps_variacao},
          ${data.kpis.taxa_conversao}, ${data.kpis.taxa_conversao_variacao},
          ${data.kpis.taxa_recorrencia}, ${data.kpis.taxa_recorrencia_variacao},
          'fresh', NOW()
        )
      `);
    }
  } catch (error) {
    console.error('[TurboDash] Error saving to cache:', error);
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
    const data = await fetchFromInternalAPI<{ existe: boolean; cnpj: string; nome_cliente?: string }>(
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
