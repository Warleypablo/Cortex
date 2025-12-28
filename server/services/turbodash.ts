import { db } from '../db';
import { 
  turbodashKpis,
  type TurbodashClientResponse,
  type TurbodashListResponse,
  type TurbodashApiResponse,
  type TurbodashApiListResponse
} from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

// TurboDash API configuration - uses environment variables for security
// TURBODASH_API_URL: Production (https://app.turbodash.com.br) or Development URL
// INTERNAL_API_TOKEN: Bearer token for authentication
const TURBODASH_API_URL = process.env.TURBODASH_API_URL || 'https://app.turbodash.com.br';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;
const CACHE_TTL_MINUTES = 15;

// Real TurboDash API response format
interface TurboDashRealApiResponse {
  success: boolean;
  timestamp: string;
  dateRange: {
    start: string;
    end: string;
  };
  clients: Array<{
    id: string;
    name: string;
    cnpj: string;
    current: {
      revenue: number;
      adSpend: number;
      roas: number;
      purchases: number;
      cpa: number;
      avgTicket: number;
      sessions: number;
      cps: number;
      conversionRate: number;
      recurrenceRate: number;
    };
    previous: {
      revenue: number;
      adSpend: number;
      roas: number;
      purchases: number;
      cpa: number;
      avgTicket: number;
      sessions: number;
      cps: number;
      conversionRate: number;
      recurrenceRate: number;
    };
    growth: {
      revenue: number;
      adSpend: number;
      roas: number;
      purchases: number;
      cpa: number;
      avgTicket: number;
      sessions: number;
      cps: number;
      conversionRate: number;
      recurrenceRate: number;
    };
  }>;
}

// Transform real TurboDash API client data to internal normalized format
function transformRealApiClient(
  client: TurboDashRealApiResponse['clients'][0], 
  dateRange: TurboDashRealApiResponse['dateRange']
): TurbodashClientResponse {
  return {
    cnpj: client.cnpj.replace(/\D/g, ''),
    nome_cliente: client.name,
    periodo_inicio: dateRange.start,
    periodo_fim: dateRange.end,
    kpis: {
      faturamento: client.current.revenue,
      faturamento_variacao: client.growth.revenue,
      investimento: client.current.adSpend,
      investimento_variacao: client.growth.adSpend,
      roas: client.current.roas,
      roas_variacao: client.growth.roas,
      compras: client.current.purchases,
      compras_variacao: client.growth.purchases,
      cpa: client.current.cpa,
      cpa_variacao: client.growth.cpa,
      ticket_medio: client.current.avgTicket,
      ticket_medio_variacao: client.growth.avgTicket,
      sessoes: client.current.sessions,
      sessoes_variacao: client.growth.sessions,
      cps: client.current.cps,
      cps_variacao: client.growth.cps,
      taxa_conversao: client.current.conversionRate,
      taxa_conversao_variacao: client.growth.conversionRate,
      taxa_recorrencia: client.current.recurrenceRate,
      taxa_recorrencia_variacao: client.growth.recurrenceRate,
    },
    ultima_atualizacao: new Date().toISOString(),
  };
}

// Legacy transform function for old API format (if ever needed)
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

async function fetchFromTurboDashAPI<T>(endpoint: string): Promise<T> {
  if (!INTERNAL_API_TOKEN) {
    throw new Error('INTERNAL_API_TOKEN not configured');
  }
  
  const url = `${TURBODASH_API_URL}${endpoint}`;
  console.log(`[TurboDash] Fetching from: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${INTERNAL_API_TOKEN}`,
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

export async function getKPIsByCNPJ(
  cnpj: string, 
  forceRefresh = false,
  mes?: string,
  ano?: string
): Promise<TurbodashClientResponse | null> {
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

  if (!INTERNAL_API_TOKEN) {
    console.warn('[TurboDash] INTERNAL_API_TOKEN not configured, returning cached/demo data only');
    return cached.length > 0 ? transformCachedRow(cached[0]) : getDemoKPIs(cnpjLimpo);
  }
  
  try {
    // Build API URL with optional period parameters
    let apiUrl = `/api/internal/metrics/${cnpjLimpo}`;
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes);
    if (ano) params.append('ano', ano);
    if (params.toString()) apiUrl += `?${params.toString()}`;
    
    // Fetch from TurboDash API using Bearer token authentication
    // Real API format: { success, timestamp, dateRange, clients: [...] }
    const apiResponse = await fetchFromTurboDashAPI<TurboDashRealApiResponse>(apiUrl);
    
    if (!apiResponse.success || !apiResponse.clients || apiResponse.clients.length === 0) {
      console.warn('[TurboDash] No data returned from API for CNPJ:', cnpjLimpo);
      return cached.length > 0 ? transformCachedRow(cached[0]) : getDemoKPIs(cnpjLimpo);
    }
    
    // Transform the first client (API returns array even for single CNPJ query)
    const clientData = apiResponse.clients[0];
    const data = transformRealApiClient(clientData, apiResponse.dateRange);
    
    console.log('[TurboDash] Fetched data for client:', data.nome_cliente);
    
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
  
  if (!INTERNAL_API_TOKEN) {
    console.warn('[TurboDash] INTERNAL_API_TOKEN not configured, returning cached data only');
    return {
      total: cached.length,
      periodo_inicio: cached[0]?.periodo_inicio || new Date().toISOString().split('T')[0],
      periodo_fim: cached[0]?.periodo_fim || new Date().toISOString().split('T')[0],
      clientes: cached.map(transformCachedRowFromDb),
    };
  }
  
  try {
    // Fetch list of all clients from TurboDash API
    // Real API format: { success, timestamp, dateRange, clients: [...] }
    const apiResponse = await fetchFromTurboDashAPI<TurboDashRealApiResponse>('/api/internal/metrics');
    
    if (!apiResponse.success || !apiResponse.clients || apiResponse.clients.length === 0) {
      console.warn('[TurboDash] No data returned from API for getAllKPIs');
      return {
        total: cached.length,
        periodo_inicio: cached[0]?.periodo_inicio || new Date().toISOString().split('T')[0],
        periodo_fim: cached[0]?.periodo_fim || new Date().toISOString().split('T')[0],
        clientes: cached.map(transformCachedRowFromDb),
      };
    }
    
    // Transform all clients using the real API format
    const clientes = apiResponse.clients.map(client => 
      transformRealApiClient(client, apiResponse.dateRange)
    );
    
    console.log(`[TurboDash] Fetched ${clientes.length} clients from API`);
    
    // Cache each client's data
    for (const cliente of clientes) {
      await saveKPIToCache(cliente);
    }
    
    return {
      total: clientes.length,
      periodo_inicio: apiResponse.dateRange.start,
      periodo_fim: apiResponse.dateRange.end,
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
  if (!INTERNAL_API_TOKEN) {
    return { existe: false };
  }
  
  try {
    const data = await fetchFromTurboDashAPI<{ existe: boolean; cnpj: string; nome_cliente?: string }>(
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
