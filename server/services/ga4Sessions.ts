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
  meta_ads: number;   // PAGO: source facebook/fb/meta + medium pago
  google_ads: number; // PAGO: source google/adwords/gads + medium pago
  instagram: number;  // orgânico: source instagram/ig
  youtube: number;    // orgânico: source youtube/yt (YouTube Ads vem como google)
  linkedin: number;   // source linkedin
  organico: number;   // direto/organic + Facebook orgânico
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
  // Usado para aplicar o filtro de funil ([NomeFunil] na campanha) — funciona só pra campanhas
  // cujo utm_campaign é NOME. Campanha paga (Meta/Google) usa ID numérico → use campaignIds.
  utmCampaignContains?: string[];
  // Se informado, filtra sessões cujo sessionCampaignName ESTÁ na lista (match exato).
  // Usado pra funil em tráfego pago: resolve ID de campanha (Meta/Google) → utm_campaign={{id}}.
  campaignIds?: string[];
};

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0];
}

function classifyPlatform(source: string, medium: string): keyof Ga4PlatformBreakdown {
  const s = source.toLowerCase().trim();
  const m = medium.toLowerCase().trim();
  const isPaid = m === 'cpc' || m === 'ppc' || m === 'paid' || m === 'paidsocial' || m === 'paid_social' || m === 'paidsearch';

  // Meta Ads PAGO = source facebook/fb/meta + medium pago. (Anúncios de placement IG
  // também vêm como source=facebook — Constituição UTM §3.1.) Facebook ORGÂNICO
  // (page posts, bio/linktree) compartilha o source mas NÃO é pago → vai pra organico.
  if (s.includes('facebook') || s === 'fb' || s.includes('meta')) {
    return isPaid ? 'meta_ads' : 'organico';
  }
  // Instagram orgânico (source=instagram). Pago do IG já saiu acima como facebook.
  if (s.includes('instagram') || s === 'ig') return 'instagram';
  // YouTube orgânico (source=youtube). YouTube Ads vem como google (network no term).
  if (s.includes('youtube') || s === 'yt') return 'youtube';
  if (s.includes('linkedin')) return 'linkedin';
  // Google Ads PAGO = source google/adwords/gads + medium pago.
  if ((s.includes('google') || s.includes('adwords') || s.includes('gads')) && isPaid) {
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
    byPlatform: { meta_ads: 0, google_ads: 0, instagram: 0, youtube: 0, linkedin: 0, organico: 0, outros: 0 },
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
    // Funil por ID de campanha (tráfego pago Meta/Google) — match exato em sessionCampaignName,
    // que pra campanha paga carrega o utm_campaign={{campaign.id}} (ID numérico).
    if (options?.campaignIds && options.campaignIds.length > 0) {
      filterExpressions.push({
        filter: {
          fieldName: 'sessionCampaignName',
          inListFilter: { values: options.campaignIds },
        },
      });
    } else if (options?.utmCampaignContains && options.utmCampaignContains.length > 0) {
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

    const byPlatform: Ga4PlatformBreakdown = { meta_ads: 0, google_ads: 0, instagram: 0, youtube: 0, linkedin: 0, organico: 0, outros: 0 };
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
