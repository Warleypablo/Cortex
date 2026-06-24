// server/routes/bp-copilot.tools.ts
// Ferramentas read-only do BP Copilot. Todas fatiam o payload de computarBpReceitas(db)
// (mesmo cálculo e cache de 10min do endpoint /api/bp2026/receitas), então o agente
// enxerga exatamente os mesmos números que a tela do BP.
import Anthropic from "@anthropic-ai/sdk";
import { computarBpReceitas } from "./bp2026";

// ── Slim: reduz cada linha do BP ao essencial p/ caber no contexto sem estourar tokens ──
interface LinhaBp {
  metrica: string;
  titulo: string;
  unidade?: string;
  direcao?: string;
  ytd?: { orcado: number; realizado: number | null; atingimento: number | null };
  meses?: { mes: number; orcado: number; realizado: number | null; atingimento: number | null }[];
}
function slim(linhas: any[] | undefined): LinhaBp[] {
  if (!Array.isArray(linhas)) return [];
  return linhas.map((l) => ({
    metrica: l.metrica,
    titulo: l.titulo,
    unidade: l.unidade,
    direcao: l.direcao,
    ytd: l.ytd,
    meses: (l.meses ?? []).map((m: any) => ({
      mes: m.mes, orcado: m.orcado, realizado: m.realizado, atingimento: m.atingimento,
    })),
  }));
}

// ── Resumo textual do estado do BP — injetado no contexto da conversa ──
// Dá ao agente o panorama (YTD orçado×realizado das linhas-chave) sem gastar uma tool.
export async function montarResumoBp(db: any): Promise<string> {
  const p: any = await computarBpReceitas(db);
  const fmt = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : Math.round(v).toLocaleString("pt-BR");
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
  const linhasChave = [
    ...(p.linhas ?? []),
    ...(p.metricasGerais ?? []),
  ];
  const pick = (metrica: string) => linhasChave.find((l: any) => l.metrica === metrica);
  const linha = (metrica: string, rotulo: string) => {
    const l = pick(metrica);
    if (!l?.ytd) return null;
    return `- ${rotulo}: realizado ${fmt(l.ytd.realizado)} | orçado ${fmt(l.ytd.orcado)} | atingimento ${pct(l.ytd.atingimento)}`;
  };
  const linhasResumo = [
    linha("receita_total", "Receita Total (YTD)"),
    linha("despesa_total", "Despesa Total (YTD)"),
    linha("mrr_ativo", "MRR Ativo (estoque, último mês)"),
    linha("churn_mes", "Churn do Mês (YTD, bruto)"),
    linha("vendas_mrr", "Vendas MRR (YTD)"),
    linha("vendas_pontual", "Vendas Pontual (YTD)"),
    linha("geracao_caixa", "Geração de Caixa (YTD)"),
    linha("saldo_caixa", "Saldo de Caixa (último mês)"),
    linha("clientes", "Clientes (estoque)"),
    linha("contratos", "Contratos (estoque)"),
  ].filter(Boolean);
  return [
    `Estado atual do BP ${p.ano} (mês corrente=${p.mesCorrente}, último mês fechado=${p.mesFechado}; atualizado em ${p.atualizadoEm}).`,
    `Valores em R$ salvo % de atingimento. Churn = bruto (alinhado ao ClickUp).`,
    ...linhasResumo,
    `Use as ferramentas get_bp_* para detalhar qualquer aba antes de afirmar números.`,
  ].join("\n");
}

// ── Definição das ferramentas (Anthropic tool use) ──
const noInput = { type: "object" as const, properties: {}, required: [] as string[] };

export const BP_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_bp_overview",
    description:
      "Visão geral do BP: DRE (receita, custos, EBITDA, geração de caixa) e Métricas Gerais " +
      "(MRR, churn, CAC, ticket, margem, saldo de caixa, colaboradores) com orçado×realizado e YTD. " +
      "Use como ponto de partida de quase toda análise.",
    input_schema: noInput,
  },
  {
    name: "get_bp_revenue",
    description:
      "Revenue por linha de serviço (Performance, Creators, Social, Gestão de Comunidade, Others): " +
      "MRR, Contratos, AOV, Churn% e Churn R$ por produto, mais MRR Ativo e Churn R$ Total. " +
      "Use para entender MRR/churn por produto. Lembre: AOV/Contratos contam só contratos com MRR>0.",
    input_schema: noInput,
  },
  {
    name: "get_bp_vendas_produto",
    description:
      "Vendas por Produto: vendas MRR/pontual, contratos vendidos e AOV de venda por segmento (fonte ClickUp por data_criado). " +
      "Use para analisar a venda nova por produto. Atenção ao lag entre venda comercial e venda no estoque.",
    input_schema: noInput,
  },
  {
    name: "get_bp_funil",
    description:
      "Funil comercial: reuniões realizadas, taxa de conversão, contratos vendidos e AOV de venda (MRR e pontual). " +
      "Use para diagnosticar a saúde da máquina de vendas.",
    input_schema: noInput,
  },
  {
    name: "get_bp_capacity",
    description:
      "Capacity: contratos de performance, gestores e designers necessários × atuais, contratos por gestor, contas por designer. " +
      "Use para avaliar se a operação comporta o crescimento (gargalo de capacidade).",
    input_schema: noInput,
  },
  {
    name: "get_bp_detalhamentos",
    description:
      "Detalhamentos de custo: sub-linhas de SG&A e de CAC (regime caixa), CAC por produto/cliente/contrato, payback em MRR, e Outras Receitas. " +
      "Use para investigar onde o custo está concentrado ou a eficiência da aquisição.",
    input_schema: noInput,
  },
  {
    name: "get_bp_pontual",
    description:
      "Negócio pontual: venda comercial × venda no estoque por produto/jornada (snapshot-diff). " +
      "Use para analisar o pontual. Lembre do ~1 mês de lag entre venda comercial e aparição no estoque.",
    input_schema: noInput,
  },
];

// ── Executor das ferramentas ──
export async function executeBpTool(db: any, name: string, _input: unknown): Promise<string> {
  try {
    const p: any = await computarBpReceitas(db);
    switch (name) {
      case "get_bp_overview":
        return JSON.stringify({
          ano: p.ano, mesCorrente: p.mesCorrente, mesFechado: p.mesFechado,
          dre: slim(p.linhas), metricasGerais: slim(p.metricasGerais),
        });
      case "get_bp_revenue":
        return JSON.stringify({ revenue: slim(p.revenue) });
      case "get_bp_vendas_produto":
        return JSON.stringify({ vendasProduto: slim(p.vendasProduto) });
      case "get_bp_funil":
        return JSON.stringify({ funil: slim(p.funil) });
      case "get_bp_capacity":
        return JSON.stringify({ capacity: slim(p.capacity) });
      case "get_bp_detalhamentos":
        return JSON.stringify({ sga: slim(p.sgaDetalhe), cac: slim(p.cacDetalhe), outras: slim(p.outrasDetalhe) });
      case "get_bp_pontual":
        return JSON.stringify({ pontual: slim(p.pontual) });
      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Falha ao executar ${name}: ${err?.message ?? String(err)}` });
  }
}
