import { getAnalyticsDataClient } from '../autoreport/credentials';

/**
 * Puxa cliques no Linktree via GA4 Data API.
 *
 * Pré-requisitos:
 * - GA4 conectado no admin do Linktree (Settings → Analytics)
 * - Service Account `report-job-sa@auto-report-turbo.iam.gserviceaccount.com` com Viewer na propriedade GA4
 * - LINKTREE_GA4_PROPERTY_ID configurado no .env (ex: 296920973)
 *
 * Como esse GA4 também rastreia outros sites da Turbo Partners, filtramos por
 * hostName = 'linktr.ee' para isolar somente o tráfego do Linktree.
 */

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0];
}

export type LinktreeDayMetrics = {
  date: string; // YYYY-MM-DD
  clicks: number;
  pageViews: number;
};

export type LinktreeLinkBreakdown = {
  linkUrl: string;
  linkDomain: string;
  clicks: number;
};

export type LinktreeAggregated = {
  totalClicks: number;
  totalPageViews: number;
  daily: LinktreeDayMetrics[];
  byLink: LinktreeLinkBreakdown[];
  byDomain: Array<{ domain: string; clicks: number }>;
  available: boolean;
  error?: string;
};

export async function getLinktreeMetrics(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<LinktreeAggregated> {
  if (!propertyId) {
    return {
      totalClicks: 0,
      totalPageViews: 0,
      daily: [],
      byLink: [],
      byDomain: [],
      available: false,
      error: 'LINKTREE_GA4_PROPERTY_ID não configurado',
    };
  }

  const cleanPropertyId = propertyId.replace(/\D/g, '');
  const start = fmtYmd(startDate);
  const end = fmtYmd(endDate);

  try {
    const analytics = getAnalyticsDataClient();
    const response = await analytics.properties.runReport({
      property: `properties/${cleanPropertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [
          { name: 'eventCount' },
          { name: 'screenPageViews' },
        ],
        dimensions: [
          { name: 'date' },
          { name: 'eventName' },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: 'hostName', stringFilter: { value: 'linktr.ee' } } },
              { filter: {
                fieldName: 'eventName',
                inListFilter: { values: ['click', 'page_view'] },
              } },
            ],
          },
        },
        limit: 1000,
      },
    } as any);

    const dailyMap: Record<string, LinktreeDayMetrics> = {};

    for (const row of response.data.rows || []) {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      const eventName = row.dimensionValues?.[1]?.value || '';
      const eventCount = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const pageViews = parseInt(row.metricValues?.[1]?.value || '0', 10);

      // GA4 retorna data como YYYYMMDD; converte para YYYY-MM-DD
      const isoDate = rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;

      if (!dailyMap[isoDate]) {
        dailyMap[isoDate] = { date: isoDate, clicks: 0, pageViews: 0 };
      }
      if (eventName === 'click') dailyMap[isoDate].clicks += eventCount;
      if (eventName === 'page_view') dailyMap[isoDate].pageViews += pageViews;
    }

    const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const totalClicks = daily.reduce((s, d) => s + d.clicks, 0);
    const totalPageViews = daily.reduce((s, d) => s + d.pageViews, 0);

    // Breakdown por link e domínio (chamada paralela)
    const [byLink, byDomain] = await Promise.all([
      fetchLinkBreakdown(cleanPropertyId, start, end),
      fetchDomainBreakdown(cleanPropertyId, start, end),
    ]);

    return { totalClicks, totalPageViews, daily, byLink, byDomain, available: true };
  } catch (err: any) {
    console.warn('[Linktree GA4] Falha ao buscar métricas:', err?.message || err);
    return {
      totalClicks: 0,
      totalPageViews: 0,
      daily: [],
      byLink: [],
      byDomain: [],
      available: false,
      error: err?.message || 'erro desconhecido',
    };
  }
}

async function fetchLinkBreakdown(
  cleanPropertyId: string,
  start: string,
  end: string,
): Promise<LinktreeLinkBreakdown[]> {
  try {
    const analytics = getAnalyticsDataClient();
    const r = await analytics.properties.runReport({
      property: `properties/${cleanPropertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [{ name: 'eventCount' }],
        dimensions: [{ name: 'linkUrl' }, { name: 'linkDomain' }],
        dimensionFilter: {
          andGroup: { expressions: [
            { filter: { fieldName: 'hostName', stringFilter: { value: 'linktr.ee' } } },
            { filter: { fieldName: 'eventName', stringFilter: { value: 'click' } } },
          ] },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 200,
      },
    } as any);
    return (r.data.rows || [])
      .map((row: any) => ({
        linkUrl: row.dimensionValues?.[0]?.value || '',
        linkDomain: row.dimensionValues?.[1]?.value || '',
        clicks: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }))
      .filter((row: LinktreeLinkBreakdown) => row.linkUrl && row.clicks > 0);
  } catch (err: any) {
    console.warn('[Linktree GA4] linkUrl breakdown falhou:', err?.message);
    return [];
  }
}

async function fetchDomainBreakdown(
  cleanPropertyId: string,
  start: string,
  end: string,
): Promise<Array<{ domain: string; clicks: number }>> {
  try {
    const analytics = getAnalyticsDataClient();
    const r = await analytics.properties.runReport({
      property: `properties/${cleanPropertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [{ name: 'eventCount' }],
        dimensions: [{ name: 'linkDomain' }],
        dimensionFilter: {
          andGroup: { expressions: [
            { filter: { fieldName: 'hostName', stringFilter: { value: 'linktr.ee' } } },
            { filter: { fieldName: 'eventName', stringFilter: { value: 'click' } } },
          ] },
        },
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 50,
      },
    } as any);
    return (r.data.rows || [])
      .map((row: any) => ({
        domain: row.dimensionValues?.[0]?.value || '',
        clicks: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }))
      .filter((row) => row.domain && row.clicks > 0);
  } catch (err: any) {
    console.warn('[Linktree GA4] domain breakdown falhou:', err?.message);
    return [];
  }
}
