/**
 * Inventário do lote "Bastidores Comunidade - Lucas" — funil Gestão de Comunidade (NOVO).
 * PAREADO 9x16 + 4x5. 1 body × 1 cta × 3 hooks = 3 criativos = 6 vídeos.
 * Copy = Ichino (roteiro Talking Head). Persona/ator = Lucas.
 * ⚠️ vídeos ENORMES (~690-712MB cada) — upload pesado/lento.
 * Task-mãe ClickUp 86aje6wyg · subtask gatilho "(Lucas) Subir ad" 86aje6x58 (Caio, to do).
 *
 * ⚠️⚠️ FUNIL NOVO: NÃO existe campanha nem conjunto-irmão pra clonar copy/config.
 *   CAMPAIGN e CLONE_ADSET abaixo estão como TODO — passo 3 (subir-pareado-ads) fica
 *   BLOQUEADO até: (1) criar a campanha, (2) definir a copy do anúncio, (3) o link de destino.
 *   Passos 1 (planilha/Biblioteca) e 2 (upload dos vídeos) NÃO dependem disso e já rodam.
 */
export interface Pair { base: string; body: 1; hook: number; drive9x16: string; drive4x5: string; }
const mk = (hook: number, drive9x16: string, drive4x5: string): Pair => ({ base: `ComunidadeBastidores_Lucas_b1h${hook}`, body: 1, hook, drive9x16, drive4x5 });

export const PAIRS: Pair[] = [
  mk(1, "18QW7eUtBgyUltR-ngbfuWYlISjDGOQxD", "1pVDrFrP5iDoAcWR3oz5loqKrjoPK7VHg"),
  mk(2, "17BC5G2UrAzYEemqTbAJtmhxAJ5k3VVbe", "1xTwM_Tdllz-detE5OxSMvL9K9jtsA656"),
  mk(3, "1tgcmwuIP1vkGgyMcCN1D215QcsfTxttZ", "17D8xEyrt6k5tola9_hN7Tkl1GVTOe1bf"),
];

export const LOTE = "Bastidores Comunidade - Lucas (Gestão de Comunidade)";
export const PRODUTO = "Gestão de Comunidade";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Lucas";
export const TEMA = "Bastidores Comunidade";

// ⚠️ FUNIL NOVO — campanha criada pelo script de bootstrap (subir-novo-funil-ads.ts).
// CBO Broad, objetivo Leads (decisão do Caio 20/jul). Campanha nasce PAUSED.
export const CAMPAIGN_NAME = "[TP] [Leads] [CBO] [Broad] [Comunidade] - Teste de criativos";
export const CAMPAIGN_OBJECTIVE = "OUTCOME_LEADS";
export const CAMPAIGN_DAILY_BUDGET = 5000; // R$50,00 (centavos) — PLACEHOLDER; Caio ajusta no ativar
// Conjunto-fonte pra clonar config técnica (segmentação/otimização/atribuição/promoted_object/url_tags/page/ig).
// 174 - Areia Movediça h01-05 b1c1, da camp Creators CBO Broad Teste (120249141209100450).
export const CONFIG_ADSET = "120253080726800450";
export const NN_FLOOR = 0;

// Copy do anúncio (aprovada pelo Caio 20/jul). Rascunhada do roteiro do Ichino.
// ⚠️ SEM LINK ainda — a LP não está pronta. Sobe com placeholder e Caio reaponta no ativar.
export const PLACEHOLDER_LINK = "https://turbopartners.com.br";
export const COPY = {
  message: [
    "A maioria das marcas ainda acha que comunidade é mandar produto pro influenciador e pedir uns posts.",
    "",
    "Sem briefing. Sem medir o retorno que cada criador traz. Sem nenhuma estratégia de crescimento por trás.",
    "",
    "O resultado? Post que não engaja, criador que some no mês seguinte e nenhuma venda que dê pra rastrear.",
    "",
    "Na Turbo a gente faz gestão de comunidade de verdade:",
    "• Captamos os criadores com fit real com a sua marca",
    "• Estruturamos as ativações, premiações e campanhas",
    "• Cuidamos de toda a gestão e do crescimento da comunidade",
    "",
    "Pra que todo mês você tenha mais criadores ativos, mais posts e mais vendas vindas da sua comunidade.",
    "",
    'Se a sua marca fatura acima de R$50 mil por mês e quer uma comunidade forte, engajada e que gera venda todo mês, toque em "Saiba mais".',
  ].join("\n"),
  title: "Gestão de comunidade que vira venda todo mês",
  cta: "LEARN_MORE",
};

export interface Group { key: string; body: 1; hookMin: number; hookMax: number; ctaLabel: string; matchToken: string; }
export const GROUPS: Group[] = [
  { key: "b1_h01_03", body: 1, hookMin: 1, hookMax: 3, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h01 a h03 | b1` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b${g.body} | ${g.ctaLabel}`;
};
export const metaTitle9 = (base: string) => `${base}_9x16`;
export const metaTitle4 = (base: string) => `${base}_4x5`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
