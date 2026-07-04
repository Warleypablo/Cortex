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

/**
 * Tese/racional de cada padrão de copy — o "porquê" que a mensagem usa pra
 * converter. Fonte única de verdade da documentação exibida nas tooltips do
 * produto (dropdown do Gerador, Relatório, cruzamento base×padrão). Review #11.
 */
export const PADROES_COPY_TESE: Record<PadraoKey, string> = {
  HOOK_PROVOCATIVO: "Abre com uma provocação ou afirmação polêmica que quebra o padrão e força a atenção antes do pitch.",
  CASE_STUDY: "Prova por resultado real de cliente (número + contexto) — credibilidade por evidência, não por promessa.",
  CONTRASTE: "Mostra o antes ✗ / depois ✓ (ou o jeito errado vs. o certo) pra tornar o ganho tangível e óbvio.",
  LOSS_AVERSION: "Ativa o medo de perder — o custo de NÃO agir — em vez do ganho. As pessoas evitam perda mais do que buscam ganho.",
  URGENCIA_SAZONAL: "Ancora numa data ou sazonalidade real (prazo, época) pra justificar agir agora e não depois.",
  CTA_CONVERSACIONAL: "Pede uma micro-resposta fácil (uma palavra, um 'sim') em vez de um compromisso grande — abre conversa com baixa fricção.",
  PERSONALIZACAO_NICHO: "Fala a dor específica de um nicho/segmento, como se a mensagem fosse feita sob medida pra ele.",
  REENVIO_FRIO: "Reaquece lead frio com um novo ângulo/gancho, muitas vezes reconhecendo o silêncio anterior.",
  LEMBRETE_AO_VIVO: "Lembrete de evento/live acontecendo agora ou em instantes — urgência de presença ('tá começando').",
  PERGUNTA_ESPELHO: "Abre com uma pergunta que espelha a situação do lead, gerando auto-identificação ('isso é comigo').",
  REATIVACAO: "Reengaja base parada/inativa com oferta ou novidade pra trazer o lead de volta à conversa.",
  EVENTO: "Convite/divulgação de um evento (workshop, imersão) com proposta de valor clara e CTA de inscrição.",
  MISTO: "Combina mais de um padrão — sem um gancho dominante único.",
};

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
