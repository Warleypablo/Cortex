import { getAnalyticsDataClient } from './credentials';
import type { MetricasGA4, PeriodoReferencia } from './types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function getMetricasGA4(
  propertyId: string,
  periodo: PeriodoReferencia
): Promise<MetricasGA4> {
  if (!propertyId) {
    return getEmptyMetrics();
  }

  const analytics = getAnalyticsDataClient();
  const cleanPropertyId = propertyId.replace(/\D/g, '');

  try {
    const response = await analytics.properties.runReport({
      property: `properties/${cleanPropertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate: formatDate(periodo.inicio),
            endDate: formatDate(periodo.fim),
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
        dimensions: [
          { name: 'sessionDefaultChannelGroup' },
        ],
      },
    });

    const rows = response.data.rows || [];
    
    let totalSessoes = 0;
    let totalUsuarios = 0;
    let totalNovosUsuarios = 0;
    let totalTaxaRejeicao = 0;
    let totalDuracao = 0;
    let totalConversoes = 0;
    let totalReceita = 0;
    const canais: MetricasGA4['canais'] = [];

    for (const row of rows) {
      const canal = row.dimensionValues?.[0]?.value || 'Outros';
      const sessoes = parseInt(row.metricValues?.[0]?.value || '0');
      const usuarios = parseInt(row.metricValues?.[1]?.value || '0');
      const novosUsuarios = parseInt(row.metricValues?.[2]?.value || '0');
      const taxaRejeicao = parseFloat(row.metricValues?.[3]?.value || '0');
      const duracao = parseFloat(row.metricValues?.[4]?.value || '0');
      const conversoes = parseInt(row.metricValues?.[5]?.value || '0');
      const receita = parseFloat(row.metricValues?.[6]?.value || '0');

      totalSessoes += sessoes;
      totalUsuarios += usuarios;
      totalNovosUsuarios += novosUsuarios;
      totalTaxaRejeicao += taxaRejeicao * sessoes;
      totalDuracao += duracao * sessoes;
      totalConversoes += conversoes;
      totalReceita += receita;

      canais.push({
        nome: canal,
        sessoes,
        conversoes,
      });
    }

    canais.sort((a, b) => b.sessoes - a.sessoes);

    return {
      sessoes: totalSessoes,
      usuarios: totalUsuarios,
      novoUsuarios: totalNovosUsuarios,
      taxaRejeicao: totalSessoes > 0 ? totalTaxaRejeicao / totalSessoes : 0,
      duracaoMedia: totalSessoes > 0 ? totalDuracao / totalSessoes : 0,
      conversoes: totalConversoes,
      receita: totalReceita,
      canais,
      disponivel: true,
    };
  } catch (error: any) {
    console.error(`[AutoReport GA4] Error fetching metrics for ${propertyId}:`, error.message);
    return getEmptyMetrics(error.message);
  }
}

function getEmptyMetrics(erro?: string): MetricasGA4 {
  return {
    sessoes: 0,
    usuarios: 0,
    novoUsuarios: 0,
    taxaRejeicao: 0,
    duracaoMedia: 0,
    conversoes: 0,
    receita: 0,
    canais: [],
    disponivel: false,
    erro: erro || 'Dados não disponíveis',
  };
}
