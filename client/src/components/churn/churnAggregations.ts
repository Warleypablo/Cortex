import { type ChurnContract } from "./types";

export interface ForecastContrato {
  contrato_id: string;
  cliente: string;
  cnpj: string | null;
  servico: string;
  valorr: number;
  valorp: number;
  status: string;
  status_conta: string | null;
  status_cancelamento: string | null;
  possibilidade_retencao: string | null;
  responsavel: string | null;
  contexto_risco: string | null;
  risco_score: number | null;
  risco_tier: "baixo" | "moderado" | "alto" | "critico" | null;
}
export interface ForecastResponse {
  contratos: ForecastContrato[];
  riscoCalculadoEm: string | null;
}

const MESES_PT_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export interface MesSerieChurn {
  mes: string; // "YYYY-MM"
  total: number;
  pontual: number;
  logos: number;
  porMotivo: Record<string, number>;
}

export interface HistoricoChurnResponse {
  series: MesSerieChurn[];
  motivos: string[]; // ordenados por volume desc
  ano: number;
  filterAbono: "todos" | "abonados" | "nao_abonados";
  mrrBasePorMes: Record<string, number>; // "YYYY-MM" -> MRR ativo real do mês
  /**
   * `false` quando a cobertura do dado pontual no ano é baixa demais (amostra
   * suficiente pra decidir, decisão é "não tem"). Ausente/`undefined` (o backend
   * omite o campo do JSON) quando a amostra ainda é pequena demais pra decidir
   * qualquer coisa — nunca tratar como "sem dado", só como "cedo pra saber".
   */
  pontualDisponivel?: boolean;
}

/** Uma linha (mês) do gráfico de Histórico de Churn Mensal. Chaves extras = valor por motivo. */
export type LinhaChartChurnHistorico = Record<string, number | string | boolean>;

/**
 * Monta as linhas do gráfico de Histórico de Churn Mensal: um mês por linha,
 * de janeiro até o mês corrente (se `ano` bater com o ano de `referencia`) ou
 * até dezembro, com total/pontual/meta/porMotivo já resolvidos.
 *
 * `referencia` é recebida como parâmetro em vez de a função chamar `new
 * Date()` internamente — decide tanto o corte do eixo (quantos meses
 * desenhar) quanto qual mês ganha o `*` de "mês em curso", e sem isso o
 * resultado muda a cada dia que o teste roda.
 */
export function montarChartDataChurnHistorico(
  data: HistoricoChurnResponse | undefined,
  motivos: string[],
  metaPct: number,
  ano: number,
  referencia: Date,
): LinhaChartChurnHistorico[] {
  const ultimoMes = ano === referencia.getFullYear() ? referencia.getMonth() + 1 : 12;
  const porMes: Record<string, MesSerieChurn> = {};
  (data?.series ?? []).forEach((s) => { porMes[s.mes] = s; });

  const linhas: LinhaChartChurnHistorico[] = [];
  for (let m = 1; m <= ultimoMes; m++) {
    const mesKey = `${ano}-${String(m).padStart(2, "0")}`;
    const serie = porMes[mesKey];
    // Meta = % fixo do MRR real (ativo) daquele mês. Sem base (mês sem snapshot
    // ainda), mrrBaseMes cai pra 0 e a meta some junto — a linha continua sendo
    // gerada, só sem meta a comparar.
    const mrrBaseMes = data?.mrrBasePorMes?.[mesKey] ?? 0;
    const isMesCorrente = ano === referencia.getFullYear() && m === referencia.getMonth() + 1;
    const row: LinhaChartChurnHistorico = {
      mes: mesKey,
      mesLabel: isMesCorrente ? `${MESES_PT_CURTO[m - 1]}*` : MESES_PT_CURTO[m - 1],
      total: serie ? Math.round(serie.total) : 0,
      // Sempre número, nunca undefined: mês sem linha de pontual (serie ausente)
      // ou sem pontual algum (serie.pontual ausente/0) caem no mesmo 0.
      pontual: serie ? Math.round(serie.pontual ?? 0) : 0,
      meta: Math.round(mrrBaseMes * metaPct),
      mrrBase: mrrBaseMes,
      isMesCorrente,
    };
    motivos.forEach((motivo) => {
      row[motivo] = serie ? Math.round(serie.porMotivo[motivo] ?? 0) : 0;
    });
    linhas.push(row);
  }
  return linhas;
}

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

export interface ForecastMetricas {
  total_contratos: number;
  total_clientes: number;
  mrr_exposto: number;
  pontual_exposto: number;
  por_tier: Array<{ tier: string; contratos: number; mrr: number }>;
  por_status_retencao: Array<{ status: string; contratos: number; mrr: number }>;
}

/**
 * Agrega a população de forecast. Contratos sem score de ML (pausados) caem no
 * bucket "Sem score"; sem status de cancelamento, no bucket "Sem status". Um
 * cliente com vários contratos conta 1 em total_clientes mas N em total_contratos.
 *
 * A contagem de clientes distintos usa CNPJ normalizado como chave estável
 * (nome colide entre clientes diferentes e o fallback "Cliente não
 * identificado" colapsaria todos os órfãos de JOIN em 1). Contratos sem
 * CNPJ usam o próprio `contrato_id` como chave — cada órfão conta como um
 * cliente separado, nunca fundido com outro.
 */
export function agregarForecast(contratos: ForecastContrato[]): ForecastMetricas {
  const clientes = new Set<string>();
  const tierMap = new Map<string, { contratos: number; mrr: number }>();
  const statusMap = new Map<string, { contratos: number; mrr: number }>();
  let mrr_exposto = 0;
  let pontual_exposto = 0;

  for (const c of contratos) {
    const mrr = Number(c.valorr) || 0;
    mrr_exposto += mrr;
    pontual_exposto += Number(c.valorp) || 0;
    const chaveCliente = (c.cnpj && c.cnpj.replace(/\D/g, "")) || c.contrato_id;
    clientes.add(chaveCliente);

    const tier = c.risco_tier ?? "Sem score";
    const t = tierMap.get(tier) ?? { contratos: 0, mrr: 0 };
    t.contratos += 1;
    t.mrr += mrr;
    tierMap.set(tier, t);

    const status = c.status_cancelamento ?? "Sem status";
    const s = statusMap.get(status) ?? { contratos: 0, mrr: 0 };
    s.contratos += 1;
    s.mrr += mrr;
    statusMap.set(status, s);
  }

  return {
    total_contratos: contratos.length,
    total_clientes: clientes.size,
    mrr_exposto,
    pontual_exposto,
    por_tier: Array.from(tierMap.entries())
      .map(([tier, v]) => ({ tier, ...v }))
      .sort((a, b) => b.mrr - a.mrr),
    por_status_retencao: Array.from(statusMap.entries())
      .map(([status, v]) => ({ status, ...v }))
      .sort((a, b) => b.mrr - a.mrr),
  };
}
