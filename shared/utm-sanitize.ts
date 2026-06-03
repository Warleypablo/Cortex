// Sanitização compartilhada entre front e back.
// Garante valores no padrão da Constituição: lowercase, hífen, sem acento.
// Permite { } . pra preservar tokens dinâmicos do Meta ({{campaign.id}}) e Google ({campaignid}).

// Versão "live" usada enquanto o usuário digita.
// Preserva hífen no fim pra não comer o caractere quando o usuário acabou de digitar "-".
// O cleanup final (remoção de hífen no início/fim e colapso) acontece em sanitizeUtmValue().
export function sanitizeUtmValueLive(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove diacríticos
    .toLowerCase()
    .replace(/\s+/g, '-')              // espaço → hífen
    .replace(/_+/g, '-')               // underline → hífen
    .replace(/[^a-z0-9\-{}.]/g, '');   // permite [a-z0-9-{}.] apenas
}

// Versão final (submit/blur) — também colapsa hífens duplicados e remove hífen nas pontas.
export function sanitizeUtmValue(input: string): string {
  if (!input) return '';
  return sanitizeUtmValueLive(input)
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isSanitized(input: string): boolean {
  return input === sanitizeUtmValue(input);
}

// Para URL base: aceita http(s)://, mantém maiúsculas, query string e path
export function sanitizeBaseUrl(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  // remove trailing slash duplicado e query string existente (UTMs antigas)
  return trimmed.replace(/\?.*$/, '').replace(/\/+$/, '');
}

// Não usa encodeURIComponent pra preservar tokens dinâmicos {{campaign.id}} e {campaignid}.
// Valores já vêm sanitizados (lowercase, sem espaço) então é seguro.
export function buildUtmUrl(params: {
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}): string {
  const url = sanitizeBaseUrl(params.baseUrl);
  const parts: string[] = [
    `utm_source=${params.utmSource}`,
    `utm_medium=${params.utmMedium}`,
  ];
  if (params.utmCampaign) parts.push(`utm_campaign=${params.utmCampaign}`);
  if (params.utmTerm) parts.push(`utm_term=${params.utmTerm}`);
  if (params.utmContent) parts.push(`utm_content=${params.utmContent}`);
  return `${url}?${parts.join('&')}`;
}
