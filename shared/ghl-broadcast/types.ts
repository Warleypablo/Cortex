/**
 * Tipos comuns para o módulo de broadcast/calendário editorial do GHL.
 * Originados do dashboard-broadcast do estagiário (mai/2026) e adaptados.
 */

// ── CANAL ──────────────────────────────────────────────────────────────────
export type Canal = "WhatsApp" | "Email";

// ── STATUS DE MENSAGEM ─────────────────────────────────────────────────────
export type StatusMensagem = "backlog" | "pronta" | "agendada" | "enviada" | "congelada";

export const STATUS_CONFIG: Record<StatusMensagem, { label: string; tone: string }> = {
  backlog: { label: "Backlog", tone: "muted" },
  pronta: { label: "Mensagem Pronta", tone: "purple" },
  agendada: { label: "Agendada", tone: "yellow" },
  enviada: { label: "Enviada", tone: "green" },
  congelada: { label: "Congelada", tone: "blue" },
};

export const STATUS_ORDER: StatusMensagem[] = ["backlog", "pronta", "agendada", "enviada", "congelada"];

// ── SERVIÇOS / OFERTAS ─────────────────────────────────────────────────────
export type Servico =
  | "SOLUÇÕES EM GERAL"
  | "CREATORS (UGC)"
  | "CRM"
  | "PERFORMANCE"
  | "EVENTO"
  | "ESTRUTURAÇÃO COMERCIAL"
  | "E-COMMERCE"
  | "SHOPIFY";

export const SERVICOS: Servico[] = [
  "SOLUÇÕES EM GERAL",
  "CREATORS (UGC)",
  "CRM",
  "PERFORMANCE",
  "EVENTO",
  "ESTRUTURAÇÃO COMERCIAL",
  "E-COMMERCE",
  "SHOPIFY",
];

/** Chaves internas usadas nas matrizes de validação. */
export type OfertaKey =
  | "CREATORS"
  | "PERFORMANCE"
  | "COMUNICACAO"
  | "LP"
  | "CRM"
  | "IFV"
  | "ESTRUTURA_MARKETING"
  | "SEO"
  | "IA"
  | "EVENTO"
  | "NUTRICAO"
  | "UPSELL"
  | "INDICACAO"
  | "PESQUISA"
  | "ESTRUTURACAO_COMERCIAL"
  | "ECOMMERCE";

// ── OBJETIVOS ──────────────────────────────────────────────────────────────
export type Objetivo = "Agendar reunião" | "Convite p/ evento" | "Nutrição" | "Reativação";

export const OBJETIVOS: Objetivo[] = ["Agendar reunião", "Convite p/ evento", "Nutrição", "Reativação"];

// ── PADRÕES DE COPY ────────────────────────────────────────────────────────
export type PadraoKey =
  | "HOOK_PROVOCATIVO"
  | "CASE_STUDY"
  | "CONTRASTE"
  | "LOSS_AVERSION"
  | "URGENCIA_SAZONAL"
  | "CTA_CONVERSACIONAL"
  | "PERSONALIZACAO_NICHO"
  | "REENVIO_FRIO"
  | "LEMBRETE_AO_VIVO"
  | "PERGUNTA_ESPELHO"
  | "REATIVACAO"
  | "EVENTO"
  | "MISTO";

export const PADROES_COPY_LABEL: Record<PadraoKey, string> = {
  HOOK_PROVOCATIVO: "Hook Provocativo",
  CASE_STUDY: "Case Study",
  CONTRASTE: "Contraste ✗/✓",
  LOSS_AVERSION: "Loss Aversion",
  URGENCIA_SAZONAL: "Urgência Sazonal",
  CTA_CONVERSACIONAL: "CTA Conversacional",
  PERSONALIZACAO_NICHO: "Personalização Nicho",
  REENVIO_FRIO: "Reenvio Frio",
  LEMBRETE_AO_VIVO: "Lembrete AO VIVO",
  PERGUNTA_ESPELHO: "Pergunta Espelho",
  REATIVACAO: "Reativação",
  EVENTO: "Evento",
  MISTO: "Misto",
};

export const PADROES_COPY_KEYS: PadraoKey[] = Object.keys(PADROES_COPY_LABEL) as PadraoKey[];

// ── CATEGORIAS DE BASE ─────────────────────────────────────────────────────
export type CategoriaBase =
  | "premium"
  | "mql"
  | "leads_30_100k"
  | "leads_abaixo_30k"
  | "congelados"
  | "clientes"
  | "regional_es"
  | "funil_geral"
  | "funil_creators"
  | "funil_ia"
  | "crm"
  | "base_ampla"
  | "nutricao_only";

// ── ALERTAS DE VALIDAÇÃO ───────────────────────────────────────────────────
export type Nivel = "block" | "warn";
export type StatusValidacao = "ok" | "warn" | "block";

export interface Alerta {
  tipo: "oferta" | "cadencia" | "padrao";
  nivel: Nivel;
  chave: string;
  mensagem: string;
}

export interface ResultadoValidacao {
  status: StatusValidacao;
  alertas: Alerta[];
  sugestoes: string[];
}
