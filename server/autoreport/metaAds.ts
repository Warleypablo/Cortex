import { getMetaAdsCredentials } from './credentials';
import type { MetricasMetaAds, PeriodoReferencia } from './types';

const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchMetaApi(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const creds = getMetaAdsCredentials();
  const url = new URL(`${META_API_BASE}/${endpoint}`);
  url.searchParams.set('access_token', creds.accessToken);
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Meta API Error: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
}

async function getAdAccounts(businessId: string): Promise<string[]> {
  try {
    const data = await fetchMetaApi(`${businessId}/owned_ad_accounts`, {
      fields: 'account_id,name',
      limit: '100',
    });

    return (data.data || []).map((acc: any) => acc.account_id);
  } catch (error) {
    console.error('[AutoReport Meta] Error fetching ad accounts:', error);
    return [];
  }
}

export async function getMetricasMetaAds(
  adAccountId: string,
  periodo: PeriodoReferencia
): Promise<MetricasMetaAds> {
  if (!adAccountId) {
    return getEmptyMetrics();
  }

  try {
    const cleanAccountId = adAccountId.replace(/\D/g, '');
    const accountId = `act_${cleanAccountId}`;

    const timeRange = JSON.stringify({
      since: formatDate(periodo.inicio),
      until: formatDate(periodo.fim),
    });

    const accountInsights = await fetchMetaApi(`${accountId}/insights`, {
      fields: 'impressions,reach,clicks,ctr,cpc,cpm,spend,actions,action_values',
      time_range: timeRange,
      level: 'account',
    });

    const campaignInsights = await fetchMetaApi(`${accountId}/insights`, {
      fields: 'campaign_name,impressions,reach,clicks,spend,actions',
      time_range: timeRange,
      level: 'campaign',
      limit: '50',
    });

    let adCreatives: MetricasMetaAds['criativas'] = [];
    try {
      const adsData = await fetchMetaApi(`${accountId}/ads`, {
        fields: 'name,creative{thumbnail_url},insights.time_range(' + timeRange + '){impressions,clicks}',
        limit: '10',
        filtering: JSON.stringify([{field: 'effective_status', operator: 'IN', value: ['ACTIVE']}]),
      });

      adCreatives = (adsData.data || [])
        .filter((ad: any) => ad.creative?.thumbnail_url)
        .map((ad: any) => ({
          id: ad.id,
          nome: ad.name,
          imageUrl: ad.creative.thumbnail_url,
          impressoes: parseInt(ad.insights?.data?.[0]?.impressions || '0'),
          cliques: parseInt(ad.insights?.data?.[0]?.clicks || '0'),
        }))
        .slice(0, 5);
    } catch (e) {
      console.error('[AutoReport Meta] Error fetching creatives:', e);
    }

    const accountData = accountInsights.data?.[0] || {};
    
    const impressoes = parseInt(accountData.impressions || '0');
    const alcance = parseInt(accountData.reach || '0');
    const cliques = parseInt(accountData.clicks || '0');
    const ctr = parseFloat(accountData.ctr || '0');
    const cpc = parseFloat(accountData.cpc || '0');
    const cpm = parseFloat(accountData.cpm || '0');
    const custo = parseFloat(accountData.spend || '0');

    let conversoes = 0;
    let valorConversoes = 0;
    
    if (accountData.actions) {
      for (const action of accountData.actions) {
        if (['purchase', 'lead', 'complete_registration'].includes(action.action_type)) {
          conversoes += parseInt(action.value || '0');
        }
      }
    }

    if (accountData.action_values) {
      for (const actionValue of accountData.action_values) {
        if (actionValue.action_type === 'purchase') {
          valorConversoes += parseFloat(actionValue.value || '0');
        }
      }
    }

    const campanhas: MetricasMetaAds['campanhas'] = (campaignInsights.data || []).map((row: any) => {
      let campConversoes = 0;
      if (row.actions) {
        for (const action of row.actions) {
          if (['purchase', 'lead', 'complete_registration'].includes(action.action_type)) {
            campConversoes += parseInt(action.value || '0');
          }
        }
      }

      return {
        nome: row.campaign_name || 'Campanha',
        impressoes: parseInt(row.impressions || '0'),
        alcance: parseInt(row.reach || '0'),
        cliques: parseInt(row.clicks || '0'),
        custo: parseFloat(row.spend || '0'),
        conversoes: campConversoes,
      };
    });

    campanhas.sort((a, b) => b.custo - a.custo);

    const custoPorConversao = conversoes > 0 ? custo / conversoes : 0;
    const roas = custo > 0 ? valorConversoes / custo : 0;

    return {
      impressoes,
      alcance,
      cliques,
      ctr,
      cpc,
      cpm,
      custo,
      conversoes,
      custoPorConversao,
      roas,
      campanhas,
      criativas: adCreatives,
      disponivel: true,
    };
  } catch (error: any) {
    console.error(`[AutoReport Meta] Error:`, error.message);
    return getEmptyMetrics(error.message);
  }
}

function getEmptyMetrics(erro?: string): MetricasMetaAds {
  return {
    impressoes: 0,
    alcance: 0,
    cliques: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    custo: 0,
    conversoes: 0,
    custoPorConversao: 0,
    roas: 0,
    campanhas: [],
    criativas: [],
    disponivel: false,
    erro: erro || 'Dados não disponíveis',
  };
}
