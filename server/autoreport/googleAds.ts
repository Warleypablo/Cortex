import { google } from 'googleapis';
import { getGoogleAdsCredentials } from './credentials';
import type { MetricasGoogleAds, PeriodoReferencia } from './types';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

async function getAccessToken(): Promise<string> {
  const creds = getGoogleAdsCredentials();
  
  const oauth2Client = new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret
  );
  
  oauth2Client.setCredentials({
    refresh_token: creds.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token || '';
}

export async function getMetricasGoogleAds(
  customerId: string,
  periodo: PeriodoReferencia
): Promise<MetricasGoogleAds> {
  if (!customerId) {
    return getEmptyMetrics();
  }

  try {
    const creds = getGoogleAdsCredentials();
    const accessToken = await getAccessToken();
    const cleanCustomerId = customerId.replace(/\D/g, '');

    const startDate = formatDate(periodo.inicio);
    const endDate = formatDate(periodo.fim);

    const query = `
      SELECT
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${periodo.inicio.toISOString().split('T')[0]}' AND '${periodo.fim.toISOString().split('T')[0]}'
        AND campaign.status = 'ENABLED'
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v14/customers/${cleanCustomerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': creds.developerToken,
          'login-customer-id': creds.loginCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AutoReport GoogleAds] API Error:`, errorText);
      return getEmptyMetrics(`API Error ${response.status}: Sem acesso ao Google Ads`);
    }

    const data = await response.json();
    
    let totalImpressoes = 0;
    let totalCliques = 0;
    let totalCusto = 0;
    let totalConversoes = 0;
    let totalValorConversoes = 0;
    const campanhas: MetricasGoogleAds['campanhas'] = [];

    for (const result of data || []) {
      for (const row of result.results || []) {
        const nome = row.campaign?.name || 'Campanha';
        const impressoes = parseInt(row.metrics?.impressions || '0');
        const cliques = parseInt(row.metrics?.clicks || '0');
        const custoMicros = parseInt(row.metrics?.costMicros || '0');
        const custo = custoMicros / 1000000;
        const conversoes = parseFloat(row.metrics?.conversions || '0');
        const valorConversoes = parseFloat(row.metrics?.conversionsValue || '0');

        totalImpressoes += impressoes;
        totalCliques += cliques;
        totalCusto += custo;
        totalConversoes += conversoes;
        totalValorConversoes += valorConversoes;

        campanhas.push({
          nome,
          impressoes,
          cliques,
          custo,
          conversoes,
        });
      }
    }

    campanhas.sort((a, b) => b.custo - a.custo);

    const ctr = totalImpressoes > 0 ? (totalCliques / totalImpressoes) * 100 : 0;
    const cpc = totalCliques > 0 ? totalCusto / totalCliques : 0;
    const custoPorConversao = totalConversoes > 0 ? totalCusto / totalConversoes : 0;
    const roas = totalCusto > 0 ? totalValorConversoes / totalCusto : 0;

    return {
      impressoes: totalImpressoes,
      cliques: totalCliques,
      ctr,
      cpc,
      custo: totalCusto,
      conversoes: totalConversoes,
      custoPorConversao,
      roas,
      campanhas,
      disponivel: true,
    };
  } catch (error: any) {
    console.error(`[AutoReport GoogleAds] Error:`, error.message);
    return getEmptyMetrics(error.message);
  }
}

function getEmptyMetrics(erro?: string): MetricasGoogleAds {
  return {
    impressoes: 0,
    cliques: 0,
    ctr: 0,
    cpc: 0,
    custo: 0,
    conversoes: 0,
    custoPorConversao: 0,
    roas: 0,
    campanhas: [],
    disponivel: false,
    erro: erro || 'Dados não disponíveis',
  };
}
