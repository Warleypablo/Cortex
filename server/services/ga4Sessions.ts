import { getAnalyticsDataClient } from '../autoreport/credentials';

/**
 * Puxa sessões do GA4 por plataforma (Meta/Google/orgânico/outros).
 *
 * Fonte normalizada para uso em telas Orçado x Realizado e Evolução Temporal,
 * onde precisamos de uma métrica universal de "chegada na LP" que cubra Meta + Google
 * + orgânico (substituindo o landing_page_views do Meta Pixel, que é Meta-only).
 *
 * Pré-requisitos:
 * - LINKTREE_GA4_PROPERTY_ID configurado (env var reutilizada — mesma property cobre
 *   todos os hosts da Turbo Partners, não só Linktree).
 * - Service Account com Viewer na propriedade GA4.
 *
 * O filtro hostName != 'linktr.ee' isola o tráfego das LPs (Linktree tem serviço
 * próprio em linktreeGa4.ts e não é tráfego de Ads/LP).
 */

export type Ga4PlatformBreakdown = {
  meta_ads: number;
  google_ads: number;
  organico: number;
  outros: number;
};

export type Ga4SessionsResult = {
  total: number;
  byPlatform: Ga4PlatformBreakdown;
  available: boolean;
  error?: string;
};

export type Ga4SessionsOptions = {
  // Se informado, filtra sessões cujo sessionCampaignName contenha qualquer um dos valores.
  // Usado para aplicar o filtro de funil ([NomeFunil] na campanha).
  utmCampaignContains?: string[];
};

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0];
}

function classifyPlatform(source: string, medium: string): keyof Ga4PlatformBreakdown {
  const s = source.toLowerCase().trim();
  const m = medium.toLowerCase().trim();

  if (s.includes('facebook') || s.includes('meta') || s.includes('instagram') || s === 'ig' || s === 'fb') {
    return 'meta_ads';
  }
  if ((s.includes('google') || s.includes('adwords') || s.includes('gads')) && (m === 'cpc' || m === 'ppc' || m === 'paidsearch')) {
    return 'google_ads';
  }
  if (s === '(direct)' || m === '(none)' || m === 'organic') {
    return 'organico';
  }
  return 'outros';
}

export async function getSessionsByPlatform(
  startDate: Date,
  endDate: Date,
  options?: Ga4SessionsOptions,
): Promise<Ga4SessionsResult> {
  const propertyId = (process.env.LINKTREE_GA4_PROPERTY_ID || '').replace(/\D/g, '');
  const empty: Ga4SessionsResult = {
    total: 0,
    byPlatform: { meta_ads: 0, google_ads: 0, organico: 0, outros: 0 },
    available: false,
  };

  if (!propertyId) {
    return { ...empty, error: 'LINKTREE_GA4_PROPERTY_ID não configurado' };
  }

  const start = fmtYmd(startDate);
  const end = fmtYmd(endDate);

  try {
    const analytics = getAnalyticsDataClient();

    const filterExpressions: any[] = [
      { notExpression: { filter: { fieldName: 'hostName', stringFilter: { value: 'linktr.ee' } } } },
    ];
    if (options?.utmCampaignContains && options.utmCampaignContains.length > 0) {
      filterExpressions.push({
        orGroup: {
          expressions: options.utmCampaignContains.map(v => ({
            filter: {
              fieldName: 'sessionCampaignName',
              stringFilter: { matchType: 'CONTAINS', value: `[${v}]`, caseSensitive: false },
            },
          })),
        },
      });
    }

    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [{ name: 'sessions' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        dimensionFilter: { andGroup: { expressions: filterExpressions } },
        limit: 500,
      },
    } as any);

    const byPlatform: Ga4PlatformBreakdown = { meta_ads: 0, google_ads: 0, organico: 0, outros: 0 };
    let total = 0;

    for (const row of response.data.rows || []) {
      const source = row.dimensionValues?.[0]?.value || '';
      const medium = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const bucket = classifyPlatform(source, medium);
      byPlatform[bucket] += sessions;
      total += sessions;
    }

    return { total, byPlatform, available: true };
  } catch (err: any) {
    console.warn('[GA4 Sessions] Falha ao buscar sessões:', err?.message || err);
    return { ...empty, error: err?.message || 'erro desconhecido' };
  }
}
