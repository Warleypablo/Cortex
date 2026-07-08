// Mapeia uma métrica do BP 2026 à(s) aba(s) em que ela pode aparecer.
// Usado para barrar o drill: o front diz a aba de origem e aqui validamos
// (anti-spoof) que a métrica realmente pertence àquela aba.
import { BP2026_TAB_IDS, type Bp2026TabId } from "../../shared/bp2026-tabs";

const PRODUTOS_REVENUE = ["performance", "creators", "social", "gc", "others"];

// Métricas-resumo que aparecem nas abas dre/metricas (têm prioridade sobre prefixos).
const METRICAS_DRE = new Set<string>([
  "mrr_ativo", "receita_pontual", "outras_receitas", "inadimplencia", "impostos_receita",
  "csv_salarios", "csv_beneficio", "csv_stack", "cac", "sga", "bonus",
  "impostos_diretos", "capex", "dfc_real",
  "receita_total_faturavel", "receita_liquida", "margem_bruta", "ebitda", "geracao_caixa",
]);
const METRICAS_GERAIS = new Set<string>([
  "receita_total", "despesa_total", "vendas_mrr", "vendas_pontual", "colaboradores",
  "mrr_cabeca", "receita_cabeca", "clientes", "contratos", "ticket_cliente", "ticket_contrato",
  "churn_mes", "aliquota_efetiva", "margem_geracao", "saldo_caixa",
  "pessoas_csv", "pessoas_cac", "pessoas_sgea",
]);

function classificarPorPrefixo(m: string): Bp2026TabId | null {
  if (m.startsWith("pontual_")) return "pontual"; // tratado à parte (also creators)
  if (m.startsWith("vendas_mrr_") || m.startsWith("vendas_pontual_") ||
      m.startsWith("contratos_vendidos_mrr_") || m.startsWith("contratos_vendidos_pontual_")) return "vendasProduto";
  if (m === "funil_vendas_mrr" || m === "funil_vendas_pontual" ||
      m === "contratos_vendidos_mrr" || m === "contratos_vendidos_pontual" ||
      m === "aov_venda_mrr" || m === "aov_venda_pontual" ||
      m === "reunioes" || m === "taxa_conversao") return "funil";
  if (m.startsWith("cap_") || m.startsWith("gestores_") || m.startsWith("designers_") ||
      m.startsWith("necessidade_") || m.startsWith("contratos_por_") || m.startsWith("contas_por_")) return "capacity";
  if (m.startsWith("sga_") || m === "beneficio_total_empresa") return "sga";
  if (m.startsWith("cac_")) return "cac";
  if (m.startsWith("or_")) return "outras";
  // revenue: PREFIXO_<produto> e churn_rs_*
  for (const p of PRODUTOS_REVENUE) {
    if (m === `mrr_${p}` || m === `contratos_${p}` || m === `aov_${p}` ||
        m === `churn_pct_${p}` || m === `churn_rs_${p}`) return "revenue";
  }
  if (m === "churn_rs_total" || m === "churn_pct_total") return "revenue";
  return null;
}

// Métricas que aparecem em múltiplas abas (verificado antes dos sets/prefixos).
const METRICAS_MULTI: Record<string, Bp2026TabId[]> = {
  mrr_ativo: ["dre", "revenue"],
};

export function abasDaMetrica(metrica: string): Bp2026TabId[] {
  if (METRICAS_MULTI[metrica]) return METRICAS_MULTI[metrica];
  if (metrica.startsWith("pontual_")) return ["pontual", "pontual-creators"];
  if (METRICAS_DRE.has(metrica)) return ["dre"];
  if (METRICAS_GERAIS.has(metrica)) return ["metricas"];
  const aba = classificarPorPrefixo(metrica);
  return aba ? [aba] : [];
}

export function metricaPertenceAAba(metrica: string, aba: string): boolean {
  return (abasDaMetrica(metrica) as string[]).includes(aba);
}

// Sanidade: garante que a lista de tabs do catálogo é a canônica.
void BP2026_TAB_IDS;
