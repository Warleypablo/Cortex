// server/routes/bp2026.predicados.ts
// Única fonte de verdade dos predicados de categoria por métrica.
// Usados pela agregação (bp2026.ts) e pelo detalhe (bp2026.detalhe.ts) —
// célula e detalhamento não podem divergir.
import { sql, type SQL } from "drizzle-orm";

// Despesas em regime caixa
export const PREDICADOS_DESPESA: Record<string, SQL> = {
  impostos_receita: sql`categoria_nome LIKE '05.05%' OR categoria_nome ILIKE 'Impostos retidos%'`,
  csv_salarios: sql`(categoria_nome LIKE '05.01%' AND categoria_nome NOT LIKE '05.01.10%') OR categoria_nome LIKE '05.02%'`,
  beneficio_total: sql`categoria_nome LIKE '06.10.04%'`,
  csv_stack: sql`categoria_nome LIKE '05.03%' OR categoria_nome LIKE '05.04.01%' OR categoria_nome LIKE '06.05.03%' OR categoria_nome LIKE '06.10.01%'`,
  cac: sql`categoria_nome LIKE '05.04.02%' OR categoria_nome LIKE '06.04%'
            OR categoria_nome LIKE '06.05.04%' OR categoria_nome LIKE '06.05.05%'
            OR categoria_nome LIKE '06.06%' OR categoria_nome LIKE '06.07%'`,
  sga_bucket: sql`categoria_nome LIKE '06.01%' OR categoria_nome LIKE '06.02%'
            OR categoria_nome LIKE '06.03%' OR categoria_nome LIKE '06.08%'
            OR categoria_nome LIKE '06.09%' OR categoria_nome LIKE '06.10.02%'
            OR categoria_nome LIKE '06.10.03%' OR categoria_nome LIKE '06.10.06%'
            OR categoria_nome LIKE '06.10.07%' OR categoria_nome LIKE '06.10.08%'`,
  bonus: sql`categoria_nome LIKE '05.01.10%'`,
  impostos_diretos: sql`categoria_nome LIKE '06.12%' OR categoria_nome LIKE '06.13%' OR categoria_nome LIKE '08.01%'`,
  capex: sql`categoria_nome LIKE '06.11%'`,
  estornos: sql`categoria_nome LIKE '05.06%'`,
};

// Receitas "outras" (por competência): categorias 03.02/03.03/04.01/04.03
export const PREDICADO_OUTRAS_RECEITAS: SQL = sql`categoria_nome LIKE '03.02%' OR categoria_nome LIKE '03.03%'
               OR categoria_nome LIKE '04.01%' OR categoria_nome LIKE '04.03%'`;

// Sub-linhas do detalhamento SG&A (visão da aba SG&A da planilha).
// A união de uzk+backoffice+ocupacao+eventos(06.10.06)+premiacoes(06.10.08)+outras_sub
// = sga_bucket; software (06.10.01) e caju (06.10.04) vêm de outros buckets do DRE.
export const PREDICADOS_SGA_SUB: Record<string, SQL> = {
  sga_uzk: sql`categoria_nome LIKE '06.09%'`,
  sga_backoffice: sql`categoria_nome LIKE '06.08%'`,
  sga_software: sql`categoria_nome LIKE '06.10.01%'`,
  sga_ocupacao: sql`categoria_nome LIKE '06.02%'`,
  sga_premiacoes: sql`categoria_nome LIKE '06.10.08%'`,
  sga_eventos: sql`categoria_nome LIKE '06.10.06%'`,
  sga_outras_sub: sql`categoria_nome LIKE '06.01%' OR categoria_nome LIKE '06.03%'
            OR categoria_nome LIKE '06.10.02%' OR categoria_nome LIKE '06.10.03%'
            OR categoria_nome LIKE '06.10.07%'`,
};

// Sub-linhas do detalhamento de Outras Receitas (união = PREDICADO_OUTRAS_RECEITAS).
export const PREDICADOS_OUTRAS_SUB: Record<string, SQL> = {
  or_variavel: sql`categoria_nome LIKE '03.02%'`,
  or_stack: sql`categoria_nome LIKE '03.03%'`,
  or_demais: sql`categoria_nome LIKE '04.01%' OR categoria_nome LIKE '04.03%'`,
};

// Sub-linhas do detalhamento CAC (bloco esquerdo da aba CAC da planilha).
// União = predicado cac do DRE para as categorias existentes hoje; categorias
// novas dentro de 06.04/06.06/06.07 fora das enumeradas apareceriam como
// divergência no smoke (cac_total_detalhe ≡ célula cac).
export const PREDICADOS_CAC_SUB: Record<string, SQL> = {
  cac_pre_vendas: sql`categoria_nome LIKE '06.04.03%'`,
  cac_vendas: sql`categoria_nome LIKE '06.04.02%'`,
  cac_gerencia: sql`categoria_nome LIKE '06.04.01%'`,
  cac_comissoes: sql`categoria_nome LIKE '06.04.04%' OR categoria_nome LIKE '06.04.05%'`,
  cac_growth: sql`categoria_nome LIKE '06.06.02%'`,
  cac_ads: sql`categoria_nome LIKE '06.06.01%'`,
  cac_eventos: sql`categoria_nome LIKE '06.07.01%'`,
  cac_brindes: sql`categoria_nome LIKE '06.07.02%'`,
  cac_viagens: sql`categoria_nome LIKE '05.04.02%' OR categoria_nome LIKE '06.05.04%'`,
  cac_outras_sub: sql`categoria_nome LIKE '06.05.05%' OR categoria_nome LIKE '06.07.03%'`,
};
