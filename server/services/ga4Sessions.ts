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
  tiktok_ads: number;
  linkedin_ads: number;
  // Orgânico separado por plataforma (medium=organic) — habilita o estágio
  // "chegou no site" (Sessões/VdP) por canal orgânico. `organico` agrega o
  // restante (direct + orgânicos sem source de plataforma).
  organico_instagram: number;
  organico_youtube: number;
  organico_linkedin: number;
  organico_tiktok: number;
  organico: number;
  outros: number;
};

export type Ga4SessionsResult = {
  total: number;
  byPlatform: Ga4PlatformBreakdown;           // sessões por plataforma
  byPlatformPageViews: Ga4PlatformBreakdown;   // visualizações de página por plataforma
  available: boolean;
  error?: string;
};

export type Ga4SessionsOptions = {
  // Se informado, filtra sessões cujo sessionCampaignName contenha qualquer um dos valores.
  // Usado para aplicar o filtro de funil ([NomeFunil] na campanha).
  utmCampaignContains?: string[];
  // IDs de campanha (ex.: meta_campaigns.campaign_id) para casar EXATAMENTE com o
  // sessionCampaignName do GA4. Necessário porque o utm_campaign das campanhas Meta
  // chega no GA4 como o ID numérico ({{campaign.id}}), e não como o nome com a tag
  // [Funil]. Combinado em OR com utmCampaignContains (belt-and-suspenders: cobre tanto
  // canais nomeados por ID quanto por nome-com-tag).
  campaignIdIn?: string[];
};

function fmtYmd(d: Date): string {
  return d.toISOString().split('T')[0];
}

function classifyPlatform(source: string, medium: string): keyof Ga4PlatformBreakdown {
  const s = source.toLowerCase().trim();
  const m = medium.toLowerCase().trim();
  const isPaid = m === 'cpc' || m === 'ppc' || m === 'paidsearch' || m === 'paid' || m === 'paidsocial' || m === 'paid_social';

  // Meta paga — exige medium pago, senão puxava Instagram orgânico + referrals
  // (facebook.com, linktree) pro bucket e inflava as métricas de Ads.
  if ((s.includes('facebook') || s.includes('meta') || s.includes('instagram') || s === 'ig' || s === 'fb') && isPaid) {
    return 'meta_ads';
  }
  // Google paga — aceita qualquer medium pago (isPaid). A Constituição UTM Turbo
  // (docs/utm-constituicao.md §5.2) padroniza o Google Ads como utm_medium=paid;
  // antes só cpc/ppc/paidsearch eram reconhecidos, então o tráfego taggeado como
  // `paid` caía em "outros" e zerava as Sessões do Google. cpc/ppc seguem cobertos
  // (auto-tagging gclid → GA4 reporta medium=cpc).
  if ((s.includes('google') || s.includes('adwords') || s.includes('gads')) && isPaid) {
    return 'google_ads';
  }
  // Ads pagas de TikTok/LinkedIn — convenção utm_source=tiktok_ads/linkedin_ads,
  // ou source=tiktok/linkedin com medium pago. Orgânico (medium social/referral) cai fora.
  if (s.includes('tiktok') && (s.includes('ads') || isPaid)) {
    return 'tiktok_ads';
  }
  if (s.includes('linkedin') && (s.includes('ads') || isPaid)) {
    return 'linkedin_ads';
  }
  // Orgânico por plataforma: medium organic/none (ou source direct). O source diz
  // o canal (Constituição UTM §5.3: utm_source=instagram/youtube/linkedin/tiktok +
  // utm_medium=organic). Sem source de plataforma (direct etc.) cai em `organico`.
  if (m === 'organic' || m === '(none)' || s === '(direct)') {
    if (s.includes('instagram') || s === 'ig') return 'organico_instagram';
    if (s.includes('youtube') || s === 'yt') return 'organico_youtube';
    if (s.includes('linkedin')) return 'organico_linkedin';
    if (s.includes('tiktok')) return 'organico_tiktok';
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
  const zeroBreakdown = (): Ga4PlatformBreakdown =>
    ({ meta_ads: 0, google_ads: 0, tiktok_ads: 0, linkedin_ads: 0,
       organico_instagram: 0, organico_youtube: 0, organico_linkedin: 0, organico_tiktok: 0,
       organico: 0, outros: 0 });
  const empty: Ga4SessionsResult = {
    total: 0,
    byPlatform: zeroBreakdown(),
    byPlatformPageViews: zeroBreakdown(),
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
    const campaignExprs: any[] = [];
    if (options?.utmCampaignContains && options.utmCampaignContains.length > 0) {
      campaignExprs.push(...options.utmCampaignContains.map(v => ({
        filter: {
          fieldName: 'sessionCampaignName',
          stringFilter: { matchType: 'CONTAINS', value: `[${v}]`, caseSensitive: false },
        },
      })));
    }
    if (options?.campaignIdIn && options.campaignIdIn.length > 0) {
      campaignExprs.push({
        filter: {
          fieldName: 'sessionCampaignName',
          inListFilter: { values: options.campaignIdIn, caseSensitive: false },
        },
      });
    }
    if (campaignExprs.length > 0) {
      filterExpressions.push({ orGroup: { expressions: campaignExprs } });
    }

    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        dimensionFilter: { andGroup: { expressions: filterExpressions } },
        limit: 500,
      },
    } as any);

    const byPlatform = zeroBreakdown();
    const byPlatformPageViews = zeroBreakdown();
    let total = 0;

    for (const row of response.data.rows || []) {
      const source = row.dimensionValues?.[0]?.value || '';
      const medium = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const pageViews = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const bucket = classifyPlatform(source, medium);
      byPlatform[bucket] += sessions;
      byPlatformPageViews[bucket] += pageViews;
      total += sessions;
    }

    return { total, byPlatform, byPlatformPageViews, available: true };
  } catch (err: any) {
    console.warn('[GA4 Sessions] Falha ao buscar sessões:', err?.message || err);
    return { ...empty, error: err?.message || 'erro desconhecido' };
  }
}

// ============================================================================
// Diagnóstico: lista os source/medium REAIS do GA4 (sessões + page views) e como
// cada um é classificado. Serve pra validar, em prod, se o tagueamento de UTM das
// campanhas (sobretudo TikTok/LinkedIn Ads) cai nos buckets certos antes de
// confiarmos nas métricas de Connect Rate / Tx Conversão.
// ============================================================================

export type Ga4DiagnosticRow = {
  source: string;
  medium: string;
  sessions: number;
  pageViews: number;
  bucket: keyof Ga4PlatformBreakdown;
};

export type Ga4DiagnosticResult = {
  available: boolean;
  rows: Ga4DiagnosticRow[];            // ordenado por sessões desc
  totalsByBucket: Ga4PlatformBreakdown; // sessões somadas por bucket
  error?: string;
};

export async function getGa4SourceMediumDiagnostic(
  startDate: Date,
  endDate: Date,
): Promise<Ga4DiagnosticResult> {
  const propertyId = (process.env.LINKTREE_GA4_PROPERTY_ID || '').replace(/\D/g, '');
  const zero = (): Ga4PlatformBreakdown =>
    ({ meta_ads: 0, google_ads: 0, tiktok_ads: 0, linkedin_ads: 0,
       organico_instagram: 0, organico_youtube: 0, organico_linkedin: 0, organico_tiktok: 0,
       organico: 0, outros: 0 });

  if (!propertyId) {
    return { available: false, rows: [], totalsByBucket: zero(), error: 'LINKTREE_GA4_PROPERTY_ID não configurado' };
  }

  const start = fmtYmd(startDate);
  const end = fmtYmd(endDate);

  try {
    const analytics = getAnalyticsDataClient();
    const response = await analytics.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { notExpression: { filter: { fieldName: 'hostName', stringFilter: { value: 'linktr.ee' } } } },
            ],
          },
        },
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 250,
      },
    } as any);

    const rows: Ga4DiagnosticRow[] = [];
    const totalsByBucket = zero();

    for (const row of response.data.rows || []) {
      const source = row.dimensionValues?.[0]?.value || '';
      const medium = row.dimensionValues?.[1]?.value || '';
      const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const pageViews = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const bucket = classifyPlatform(source, medium);
      rows.push({ source, medium, sessions, pageViews, bucket });
      totalsByBucket[bucket] += sessions;
    }

    return { available: true, rows, totalsByBucket };
  } catch (err: any) {
    console.warn('[GA4 Diagnostic] Falha:', err?.message || err);
    return { available: false, rows: [], totalsByBucket: zero(), error: err?.message || 'erro desconhecido' };
  }
}
