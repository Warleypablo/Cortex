// Vocabulário fechado de medium + source — Constituição UTM Turbo v1.1
// Mudar valor exige PR + aprovação Growth+Pre-Sales (Lei 1).
// Fonte: docs/utm-constituicao.md

export const UTM_MEDIUMS = [
  'paid',
  'organic',
  'eventos',
  'referral',
  'crm',
  'outbound',
  'victor',
  'andre',
  'rodrigo',
] as const;

export type UtmMedium = typeof UTM_MEDIUMS[number];

export const UTM_MEDIUM_LABELS: Record<UtmMedium, string> = {
  paid: 'Paid — Mídia paga (Meta, Google, etc)',
  organic: 'Organic — Conteúdo orgânico próprio',
  eventos: 'Eventos — Presença física ou digital',
  referral: 'Referral — Alguém externo trazendo lead',
  crm: 'CRM — Comunicação ativa para base própria',
  outbound: 'Outbound — Prospecção fria via SDR',
  victor: 'Victor — Canal próprio (figura-exceção)',
  andre: 'André — Canal próprio (figura-exceção)',
  rodrigo: 'Rodrigo — Canal próprio (figura-exceção)',
};

export const UTM_SOURCES_BY_MEDIUM: Record<UtmMedium, readonly string[]> = {
  paid: ['facebook', 'google', 'youtube', 'linkedin', 'tiktok', 'pinterest'],
  organic: ['instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest'],
  eventos: [], // vocabulário aberto — input livre com slug do nome do evento
  referral: ['cliente', 'colaborador', 'afiliado', 'influencer', 'marketplace'],
  crm: ['email', 'whatsapp', 'sms'],
  outbound: ['email', 'whatsapp', 'linkedin'],
  victor: ['instagram', 'youtube', 'linkedin', 'tiktok'],
  andre: ['instagram', 'youtube', 'linkedin', 'tiktok'],
  rodrigo: ['instagram', 'youtube', 'linkedin', 'tiktok'],
};

export const UTM_SOURCE_LABELS: Record<string, string> = {
  // paid
  facebook: 'Facebook (Meta Ads)',
  google: 'Google Ads',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  // organic
  instagram: 'Instagram',
  // referral
  cliente: 'Cliente',
  colaborador: 'Colaborador',
  afiliado: 'Afiliado',
  influencer: 'Influencer',
  marketplace: 'Marketplace',
  // crm
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
};

export function isValidMedium(medium: string): medium is UtmMedium {
  return (UTM_MEDIUMS as readonly string[]).includes(medium);
}

export function isValidSource(medium: UtmMedium, source: string): boolean {
  if (medium === 'eventos') return source.length > 0; // vocabulário aberto
  return UTM_SOURCES_BY_MEDIUM[medium].includes(source);
}

// Mediums onde a plataforma de ads injeta automaticamente — campaign/term/content
// devem usar tokens dinâmicos. UI deve avisar isso, mas não bloquear.
export const PAID_MEDIA_HINTS: Record<string, { campaign: string; term: string; content: string }> = {
  facebook: {
    campaign: '{{campaign.id}}',
    term: '{{adset.id}}-{{placement}}',
    content: '{{ad.id}}',
  },
  google: {
    campaign: '{campaignid}',
    term: '{adgroupid}-{network}-{device}-{matchtype}-{keyword}',
    content: '{creative}',
  },
  // TikTok injeta os IDs no clique via macros __...__ (sintaxe própria, ≠ Meta {{...}}).
  // Espelha o desenho do Meta: campaign = ID da campanha, term = ID do conjunto + placement,
  // content = ID do anúncio. __AID__ = ad group (conjunto), __CID__ = ad (anúncio).
  tiktok: {
    campaign: '__CAMPAIGN_ID__',
    term: '__AID__-__PLACEMENT__',
    content: '__CID__',
  },
};
