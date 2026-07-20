/**
 * Inventário do lote "Estratégia Peculiar - Lucas" — funil Gestão de Comunidade (2º lote).
 * PAREADO 9x16 + 4x5. 1 body × 1 cta × 4 hooks = 4 criativos = 8 vídeos (~515-556MB).
 * Mesmo funil/campanha do Bastidores; entra como conjunto NOVO na camp já existente.
 * Copy = Ichino (roteiro "Estratégia peculiar", ângulo big brands/influencers). Persona/ator = Lucas.
 * Task-mãe ClickUp 86aje6wyg (mesma do Bastidores) · pasta Drive 1SGv8NqQObsG2jjCXNaP1BSkCkQy_kv5e.
 */
export interface Pair { base: string; body: 1; hook: number; drive9x16: string; drive4x5: string; }
const mk = (hook: number, drive9x16: string, drive4x5: string): Pair => ({ base: `EstrategiaPeculiar_Lucas_b1h${hook}`, body: 1, hook, drive9x16, drive4x5 });

export const PAIRS: Pair[] = [
  mk(1, "1H8ujLv99whCMo6JRvpHNnoXlTlm1nZRz", "1Ri-jxbsSnw0fn2_-IaJHlRxie8vYcKbB"),
  mk(2, "1rifTN5vqBkB1jfiJCniQqp9mNngNO2wI", "1iDjL4i3ToTQ0Cte3-ZHAjttmRl8l4BZK"),
  mk(3, "1XBJoz-yiBOyXMWSRlEgQ-6S-TIsuLaLr", "1iaJf37kCfGISVXY1K7n-I8LViYQk4sBi"),
  mk(4, "1nVL1qZpCJ7b_PAJtARj_yG1Q0l_Rq2O0", "1JPG-vcs8KGFheUpG51F1Qpx-BCyeXG7p"),
];

export const LOTE = "Estratégia Peculiar - Lucas (Gestão de Comunidade)";
export const PRODUTO = "Gestão de Comunidade";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Lucas";
export const TEMA = "Estratégia Peculiar";

// Campanha JÁ EXISTE (criada no lote Bastidores) — script acha por nome e só adiciona o conjunto novo.
export const CAMPAIGN_NAME = "[TP] [Leads] [CBO] [Broad] [Comunidade] - Teste de criativos";
export const CAMPAIGN_OBJECTIVE = "OUTCOME_LEADS";
export const CAMPAIGN_DAILY_BUDGET = 5000; // só usado se a campanha não existisse
// Conjunto-fonte de config técnica = o conjunto Bastidores (MESMO funil), 120253259884610450.
export const CONFIG_ADSET = "120253259884610450";
export const NN_FLOOR = 0;

// Copy do anúncio (rascunho do roteiro "Estratégia peculiar" — PENDENTE aprovação do Caio).
// ⚠️ SEM LINK ainda — mesma pendência do lote 1; sobe com placeholder e reaponta no ativar.
export const PLACEHOLDER_LINK = "https://turbopartners.com.br";
export const COPY = {
  message: [
    "Você já reparou que as marcas e os influenciadores que mais crescem usam todos a mesma estratégia?",
    "",
    "Kylie Jenner, as Kardashians, o Mr Beast. Virginia, Boca Rosa, Manu Cit. Super Coffee, Guday, Bold.",
    "",
    "O que eles têm em comum não é sorte nem orçamento gigante — é uma comunidade forte construída em volta da marca.",
    "",
    "Essa é a estratégia peculiar por trás do crescimento rápido. E é exatamente isso que a Turbo constrói pra você, de ponta a ponta:",
    "• Captamos os criadores com fit real com a sua marca",
    "• Estruturamos as ativações, campanhas e premiações",
    "• Cuidamos da gestão e do crescimento da comunidade todo mês",
    "",
    "Pra que você tenha mais criadores ativos, mais posts e mais vendas vindas da sua comunidade.",
    "",
    'Se você tem uma marca e quer construir uma comunidade forte que gera venda, toque em "Saiba mais".',
  ].join("\n"),
  title: "A estratégia peculiar das marcas que mais crescem",
  cta: "LEARN_MORE",
};

export interface Group { key: string; body: 1; hookMin: number; hookMax: number; ctaLabel: string; matchToken: string; }
export const GROUPS: Group[] = [
  { key: "b1_h01_04", body: 1, hookMin: 1, hookMax: 4, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h01 a h04 | b1` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b${g.body} | ${g.ctaLabel}`;
};
export const metaTitle9 = (base: string) => `${base}_9x16`;
export const metaTitle4 = (base: string) => `${base}_4x5`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
