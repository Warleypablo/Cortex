import { type ChurnContract } from "./types";

/**
 * Soma MRR e pontual de um recorte de contratos, independentemente.
 * Ajustes manuais entram com valor negativo e são preservados de propósito —
 * eles reduzem o churn do mês.
 */
export function somarValoresDrawer(
  contratos: ChurnContract[],
): { mrr: number; pontual: number } {
  let mrr = 0;
  let pontual = 0;
  for (const c of contratos) {
    mrr += Number(c.valorr) || 0;
    pontual += Number(c.valorp) || 0;
  }
  return { mrr, pontual };
}

/**
 * Fração de um valor sobre a base de MRR do mês (0.084 = 8,4%).
 * Retorna null quando a base não permite um percentual honesto — nesses
 * casos a UI deve omitir o percentual, nunca mostrar 0% ou Infinity%.
 */
export function pctDaBase(valor: number, base: number): number | null {
  const b = Number(base);
  if (!Number.isFinite(b) || b <= 0) return null;
  return (Number(valor) || 0) / b;
}

/** Formata uma fração como percentual pt-BR: 0.084 -> "8,4%". */
export function formatPct(fracao: number, casas = 1): string {
  return `${(fracao * 100).toFixed(casas).replace(".", ",")}%`;
}

/**
 * Ordena itens de churn por taxa (squad/pessoa) para o ranking do
 * ChurnPorDimensao: primeiro quem tem base (percentual não-nulo, do maior
 * para o menor), depois quem não tem (ordenado por MRR perdido).
 *
 * `noBase` é derivado do MESMO `percentual` que o backend já calculou sobre
 * a soma das bases de todos os meses do range — nunca do `mrr_ativo` isolado
 * do primeiro mês. Um item pode ter `mrr_ativo === 0` (sem carteira no 1º
 * mês) e ainda assim ter `percentual` calculável (carteira nos meses
 * seguintes do range); nesse caso `noBase` é false e a taxa real é exibida.
 */
export function ordenarPorTaxaDeChurn<
  T extends { label: string; mrr_perdido: number; percentual: number | null },
>(itens: T[]): Array<T & { noBase: boolean }> {
  const comBase = itens.filter(i => i.percentual !== null);
  const semBase = itens.filter(i => i.percentual === null && i.mrr_perdido > 0);

  const ordenado = [
    ...comBase.sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1)),
    ...semBase.sort((a, b) => b.mrr_perdido - a.mrr_perdido),
  ];

  return ordenado.map(i => ({ ...i, noBase: i.percentual === null }));
}

export const NAO_ESPECIFICADO = "Não especificado";

export interface LinhaResponsavel {
  responsavel: string;
  contratos: number;
  mrr: number;
  /** Fração do MRR do recorte. null para a linha "Não especificado". */
  participacao: number | null;
  /** MRR perdido ÷ carteira do responsável. null quando não há base. */
  churnPct: number | null;
  isNaoEspecificado: boolean;
}

/** "Nome A; Nome B" -> "Nome A". Rateio inventaria precisão que o dado não tem. */
export function primeiroNome(raw: string): string {
  return (raw || "").split(";")[0].trim();
}

/**
 * Agrega o churn de um recorte por responsável.
 *
 * A linha "Não especificado" é sempre a última e não recebe participação nem
 * churn%: ela acumula contratos sem responsável e os ajustes manuais, que
 * entram com valor negativo e sem carteira a que atribuir.
 */
export function agregarPorResponsavel(
  contratos: ChurnContract[],
  basePorResponsavel: Record<string, number> = {},
): LinhaResponsavel[] {
  const grupos = new Map<string, { contratos: number; mrr: number }>();

  for (const c of contratos) {
    const nome = primeiroNome(c.responsavel) || NAO_ESPECIFICADO;
    const chave = nome === NAO_ESPECIFICADO ? NAO_ESPECIFICADO : nome;
    const g = grupos.get(chave) || { contratos: 0, mrr: 0 };
    g.contratos += 1;
    g.mrr += Number(c.valorr) || 0;
    grupos.set(chave, g);
  }

  // Participação é sobre o MRR dos responsáveis identificados, para que
  // a soma feche em 100% sem ser distorcida por ajustes negativos.
  // (forEach em vez de for-of sobre o Map: o tsconfig do projeto não tem
  // downlevelIteration/target es2015+, então iterar Map/Set com for-of
  // dispara TS2802 — mesmo padrão já visto em ChurnConsolidadoTrimestral.tsx.)
  let totalIdentificado = 0;
  grupos.forEach((g, nome) => {
    if (nome !== NAO_ESPECIFICADO) totalIdentificado += g.mrr;
  });

  const linhas: LinhaResponsavel[] = [];
  grupos.forEach((g, nome) => {
    const isNaoEsp = nome === NAO_ESPECIFICADO;
    const base = basePorResponsavel[nome];
    linhas.push({
      responsavel: nome,
      contratos: g.contratos,
      mrr: g.mrr,
      participacao: isNaoEsp || totalIdentificado <= 0 ? null : g.mrr / totalIdentificado,
      churnPct: isNaoEsp ? null : pctDaBase(g.mrr, base),
      isNaoEspecificado: isNaoEsp,
    });
  });

  linhas.sort((a, b) => {
    if (a.isNaoEspecificado) return 1;
    if (b.isNaoEspecificado) return -1;
    return b.mrr - a.mrr;
  });

  return linhas;
}
