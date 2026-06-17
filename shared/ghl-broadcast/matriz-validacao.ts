/**
 * Validação de combinações Base × Oferta × Padrão.
 *
 * Fonte: dashboard-broadcast (estagiário, mai/2026), arquivo matrizValidacao.js.
 * Fonte primária: doc interno `03_matriz_mensagem_x_base.md`.
 *
 * Atualizar aqui sempre que a regra mudar no doc.
 */

import type {
  Alerta,
  CategoriaBase,
  OfertaKey,
  PadraoKey,
  ResultadoValidacao,
  StatusValidacao,
} from "./types";

// ── CATEGORIZAÇÃO DE BASES ─────────────────────────────────────────────────

export const BASE_CATEGORIAS: Record<string, CategoriaBase[]> = {
  Clientes: ["clientes"],
  Congelados: ["congelados"],
  "Geral - MQLs": ["mql", "funil_geral"],
  "Creators - MQLs": ["mql", "funil_creators"],
  "CRM - MQLs": ["mql", "crm"],
  "CRM - Todos": ["crm"],
  "Geral - Entre 30k a 100k": ["leads_30_100k", "funil_geral"],
  "Creators - Entre 30k a 100k": ["leads_30_100k", "funil_creators"],
  "Geral - Abaixo de 30k": ["leads_abaixo_30k", "funil_geral", "nutricao_only"],
  "Creators - Abaixo de 30k": ["leads_abaixo_30k", "funil_creators", "nutricao_only"],
  "Contatos Espírito Santo": ["regional_es"],
  "Geral - Todos": ["funil_geral", "base_ampla"],
  "Creators - Todos": ["funil_creators", "base_ampla"],
};

export function categoriasDaBase(base: string): CategoriaBase[] {
  return BASE_CATEGORIAS[base] || [];
}

export function baseTem(base: string, categoria: CategoriaBase): boolean {
  return categoriasDaBase(base).includes(categoria);
}

// ── CONTEXTO DE VALIDAÇÃO ──────────────────────────────────────────────────

export interface ContextoValidacao {
  base: string;
  oferta?: OfertaKey;
  padrao?: PadraoKey;
  parametros?: {
    faixaFaturamento?: string;
    jaTeveReativacao?: boolean;
  };
}

interface Regra {
  chave: string;
  predicado: (ctx: ContextoValidacao) => boolean;
  motivo: string;
  sugestao?: string;
}

// ── REGRAS DE BLOQUEIO ─────────────────────────────────────────────────────

const REGRAS_BLOCK: Regra[] = [
  {
    chave: "oferta_ticket_alto_sem_folego",
    predicado: (ctx) =>
      (ctx.oferta === "IFV" || ctx.oferta === "ESTRUTURA_MARKETING") &&
      baseTem(ctx.base, "leads_abaixo_30k"),
    motivo:
      "Oferta de tíquete alto (>R$10k) não cabe em base com faturamento <R$30k/mês — sem fôlego financeiro.",
    sugestao: "Use bases MQLs (Geral - MQLs, Creators - MQLs).",
  },
  {
    chave: "oferta_nova_para_clientes",
    predicado: (ctx) =>
      baseTem(ctx.base, "clientes") &&
      !!ctx.oferta &&
      !(["UPSELL", "INDICACAO", "EVENTO", "PESQUISA", "NUTRICAO"] as OfertaKey[]).includes(ctx.oferta),
    motivo: "Clientes não recebem pitch de oferta nova. Só Upsell, Indicação, Evento ou Pesquisa.",
    sugestao: "Trocar oferta para Upsell ou Convite a Evento exclusivo.",
  },
  {
    chave: "reativacao_fora_de_congelados",
    predicado: (ctx) => ctx.padrao === "REATIVACAO" && !baseTem(ctx.base, "congelados"),
    motivo: 'Padrão "Reativação" só faz sentido pra Congelados. Pra outras bases soa estranho.',
    sugestao: "Trocar padrão para Urgência Sazonal, Case Study, Hook Provocativo ou Loss Aversion contextualizada.",
  },
  {
    chave: "performance_para_creators_pobres",
    predicado: (ctx) =>
      (ctx.oferta === "PERFORMANCE" || ctx.oferta === "CRM" || ctx.oferta === "IFV") &&
      ctx.base === "Creators - Abaixo de 30k",
    motivo: "Base entrou querendo UGC + sem fôlego financeiro. Combinação dupla-tóxica.",
    sugestao: "Trocar pra oferta de NUTRIÇÃO ou EVENTO gratuito.",
  },
  {
    chave: "upsell_fora_de_clientes",
    predicado: (ctx) => ctx.oferta === "UPSELL" && !baseTem(ctx.base, "clientes"),
    motivo: "Upsell só faz sentido pra quem já é Cliente.",
    sugestao: "Use base Clientes ou troque a oferta pra Performance, Creators, etc.",
  },
];

// ── REGRAS DE ATENÇÃO ──────────────────────────────────────────────────────

const REGRAS_WARN: Regra[] = [
  {
    chave: "cross_sell_creators_mql",
    predicado: (ctx) =>
      (ctx.oferta === "PERFORMANCE" || ctx.oferta === "CRM" || ctx.oferta === "IFV") &&
      ctx.base === "Creators - MQLs",
    motivo: "Esses leads entraram interessados em UGC. Oferta de cross-sell exige PIVÔ explícito na copy.",
    sugestao: 'Ex: "Sabemos que você veio buscando UGC, mas Performance é o que sustenta as campanhas..."',
  },
  {
    chave: "creators_para_geral",
    predicado: (ctx) =>
      ctx.oferta === "CREATORS" &&
      baseTem(ctx.base, "funil_geral") &&
      baseTem(ctx.base, "mql"),
    motivo: "Base não veio do funil Creators. Tem fôlego, mas precisa explicar por que estamos oferecendo isso.",
    sugestao: 'Adicionar pivô na copy: "Já pensou em UGC pra sua marca?" antes do case study.',
  },
  {
    chave: "hook_provocativo_clientes",
    predicado: (ctx) => ctx.padrao === "HOOK_PROVOCATIVO" && baseTem(ctx.base, "clientes"),
    motivo: "Clientes já entendem o jogo. Hook provocativo pode soar exagerado pra base que já confia.",
    sugestao: "Trocar pra padrão Case Study, Urgência Sazonal ou Convite a Evento.",
  },
  {
    chave: "personalizacao_100k_base_ampla",
    predicado: (ctx) =>
      ctx.padrao === "PERSONALIZACAO_NICHO" &&
      ctx.parametros?.faixaFaturamento === "100k+" &&
      !baseTem(ctx.base, "premium"),
    motivo: 'Personalização "+R$100k" em base sem segmentação por faturamento vai filtrar muita gente.',
    sugestao: 'Não há mais base premium segmentada por faturamento — reduza a faixa ou use uma base MQL (Geral - MQLs, Creators - MQLs).',
  },
  {
    chave: "evento_congelados_sem_aquecimento",
    predicado: (ctx) =>
      ctx.oferta === "EVENTO" &&
      baseTem(ctx.base, "congelados") &&
      !ctx.parametros?.jaTeveReativacao,
    motivo: "Pedir 1h de Congelado que não foi reaquecido é demais. Faça reativação prévia antes.",
    sugestao: "Disparar reativação primeiro (Loss Aversion / Pergunta validativa), depois o evento.",
  },
  {
    chave: "contraste_para_mqls",
    predicado: (ctx) =>
      ctx.padrao === "CONTRASTE" &&
      baseTem(ctx.base, "mql") &&
      baseTem(ctx.base, "premium"),
    motivo: "Contraste ✗/✓ soa educacional demais pra base premium que já é consciente.",
    sugestao: "Trocar pra Case Study, Personalização ou Hook Provocativo.",
  },
];

// ── VALIDAÇÃO PRINCIPAL ────────────────────────────────────────────────────

export function validarCombinacao(ctx: ContextoValidacao): ResultadoValidacao {
  const alertas: Alerta[] = [];
  const sugestoes: string[] = [];

  for (const regra of REGRAS_BLOCK) {
    if (regra.predicado(ctx)) {
      alertas.push({ tipo: "oferta", nivel: "block", chave: regra.chave, mensagem: regra.motivo });
      if (regra.sugestao) sugestoes.push(regra.sugestao);
    }
  }

  for (const regra of REGRAS_WARN) {
    if (regra.predicado(ctx)) {
      alertas.push({ tipo: "oferta", nivel: "warn", chave: regra.chave, mensagem: regra.motivo });
      if (regra.sugestao) sugestoes.push(regra.sugestao);
    }
  }

  let status: StatusValidacao = "ok";
  if (alertas.some((a) => a.nivel === "block")) status = "block";
  else if (alertas.some((a) => a.nivel === "warn")) status = "warn";

  return { status, alertas, sugestoes };
}

// ── MATRIZES QUALITATIVAS (pra UI) ─────────────────────────────────────────

export type NivelCompat = "++" | "+" | "~" | "-";

export const COMPATIBILIDADE_BASE_PADRAO: Record<string, Partial<Record<PadraoKey, NivelCompat>>> = {
  Clientes: { URGENCIA_SAZONAL: "+", EVENTO: "++", REATIVACAO: "-", CASE_STUDY: "~", HOOK_PROVOCATIVO: "~", CONTRASTE: "-", PERSONALIZACAO_NICHO: "+" },
  Congelados: { URGENCIA_SAZONAL: "++", EVENTO: "~", REATIVACAO: "++", CASE_STUDY: "+", HOOK_PROVOCATIVO: "~", CONTRASTE: "~", PERSONALIZACAO_NICHO: "~" },
  "Geral - MQLs": { URGENCIA_SAZONAL: "++", EVENTO: "+", REATIVACAO: "~", CASE_STUDY: "++", HOOK_PROVOCATIVO: "+", CONTRASTE: "+", PERSONALIZACAO_NICHO: "+" },
  "Creators - MQLs": { URGENCIA_SAZONAL: "+", EVENTO: "+", REATIVACAO: "~", CASE_STUDY: "++", HOOK_PROVOCATIVO: "+", CONTRASTE: "~", PERSONALIZACAO_NICHO: "+" },
  "CRM - MQLs": { URGENCIA_SAZONAL: "++", EVENTO: "++", REATIVACAO: "~", CASE_STUDY: "+", HOOK_PROVOCATIVO: "++", CONTRASTE: "~", PERSONALIZACAO_NICHO: "+" },
  "Geral - Entre 30k a 100k": { URGENCIA_SAZONAL: "++", EVENTO: "+", REATIVACAO: "~", CASE_STUDY: "~", HOOK_PROVOCATIVO: "+", CONTRASTE: "++", PERSONALIZACAO_NICHO: "~" },
  "Creators - Entre 30k a 100k": { URGENCIA_SAZONAL: "+", EVENTO: "+", REATIVACAO: "~", CASE_STUDY: "+", HOOK_PROVOCATIVO: "++", CONTRASTE: "+", PERSONALIZACAO_NICHO: "~" },
  "Geral - Abaixo de 30k": { URGENCIA_SAZONAL: "~", EVENTO: "++", REATIVACAO: "-", CASE_STUDY: "~", HOOK_PROVOCATIVO: "~", CONTRASTE: "++", PERSONALIZACAO_NICHO: "-" },
  "Creators - Abaixo de 30k": { URGENCIA_SAZONAL: "~", EVENTO: "++", REATIVACAO: "-", CASE_STUDY: "~", HOOK_PROVOCATIVO: "~", CONTRASTE: "++", PERSONALIZACAO_NICHO: "-" },
  "Contatos Espírito Santo": { URGENCIA_SAZONAL: "++", EVENTO: "++", REATIVACAO: "~", CASE_STUDY: "+", HOOK_PROVOCATIVO: "+", CONTRASTE: "+", PERSONALIZACAO_NICHO: "+" },
};

export const COMPATIBILIDADE_BASE_OFERTA: Record<string, Partial<Record<OfertaKey, "+" | "~" | "-">>> = {
  Clientes: { CREATORS: "~", PERFORMANCE: "~", COMUNICACAO: "~", LP: "~", CRM: "~", IFV: "~", ESTRUTURA_MARKETING: "~", SEO: "~", IA: "~", EVENTO: "+", NUTRICAO: "~", UPSELL: "+" },
  Congelados: { CREATORS: "+", PERFORMANCE: "+", COMUNICACAO: "~", LP: "~", CRM: "~", IFV: "~", ESTRUTURA_MARKETING: "-", SEO: "~", IA: "~", EVENTO: "~", NUTRICAO: "+", UPSELL: "-" },
  "Geral - MQLs": { CREATORS: "~", PERFORMANCE: "+", COMUNICACAO: "+", LP: "+", CRM: "+", IFV: "+", ESTRUTURA_MARKETING: "~", SEO: "+", IA: "+", EVENTO: "+", NUTRICAO: "~", UPSELL: "-" },
  "Creators - MQLs": { CREATORS: "+", PERFORMANCE: "~", COMUNICACAO: "~", LP: "~", CRM: "~", IFV: "~", ESTRUTURA_MARKETING: "-", SEO: "-", IA: "~", EVENTO: "+", NUTRICAO: "~", UPSELL: "-" },
  "CRM - MQLs": { CREATORS: "~", PERFORMANCE: "~", COMUNICACAO: "+", LP: "+", CRM: "+", IFV: "+", ESTRUTURA_MARKETING: "~", SEO: "~", IA: "~", EVENTO: "+", NUTRICAO: "~", UPSELL: "-" },
  "Geral - Entre 30k a 100k": { CREATORS: "~", PERFORMANCE: "~", COMUNICACAO: "+", LP: "+", CRM: "~", IFV: "~", ESTRUTURA_MARKETING: "-", SEO: "+", IA: "~", EVENTO: "+", NUTRICAO: "+", UPSELL: "-" },
  "Creators - Entre 30k a 100k": { CREATORS: "+", PERFORMANCE: "-", COMUNICACAO: "~", LP: "~", CRM: "-", IFV: "-", ESTRUTURA_MARKETING: "-", SEO: "-", IA: "-", EVENTO: "+", NUTRICAO: "+", UPSELL: "-" },
  "Geral - Abaixo de 30k": { CREATORS: "-", PERFORMANCE: "-", COMUNICACAO: "~", LP: "~", CRM: "-", IFV: "-", ESTRUTURA_MARKETING: "-", SEO: "-", IA: "~", EVENTO: "+", NUTRICAO: "+", UPSELL: "-" },
  "Creators - Abaixo de 30k": { CREATORS: "~", PERFORMANCE: "-", COMUNICACAO: "~", LP: "~", CRM: "-", IFV: "-", ESTRUTURA_MARKETING: "-", SEO: "-", IA: "-", EVENTO: "+", NUTRICAO: "+", UPSELL: "-" },
  "Contatos Espírito Santo": { CREATORS: "+", PERFORMANCE: "+", COMUNICACAO: "+", LP: "+", CRM: "+", IFV: "+", ESTRUTURA_MARKETING: "~", SEO: "~", IA: "~", EVENTO: "+", NUTRICAO: "~", UPSELL: "-" },
};

export function compatibilidadePadroes(base: string): Partial<Record<PadraoKey, NivelCompat>> {
  return COMPATIBILIDADE_BASE_PADRAO[base] || {};
}

export function compatibilidadeOfertas(base: string): Partial<Record<OfertaKey, "+" | "~" | "-">> {
  return COMPATIBILIDADE_BASE_OFERTA[base] || {};
}
