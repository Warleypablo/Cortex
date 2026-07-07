/** Ponto de uma série mensal do Scorecard (modo Evolução). */
export interface SeriePonto {
  month: string;
  valor: number;
}

/** Como `SeriePonto`, mas para métricas onde a AUSÊNCIA de dado no mês não deve virar 0 (ex:
   lead time médio de entrega — "0 dias" mentiria, sugerindo entrega instantânea, quando na
   verdade não houve nenhuma entrega naquele mês/produto para calcular a média). */
export interface SeriePontoNullable {
  month: string;
  valor: number | null;
}

/** Linha crua retornada pelas queries de série (mes/dim/valor), antes do preenchimento de meses. */
export interface SerieRow {
  mes: string;
  dim: string;
  valor: number | string;
}

/**
 * Soma `delta` meses (pode ser negativo) a um "YYYY-MM", normalizando o overflow de mês/ano.
 * Ex.: addMeses("2026-01", -1) === "2025-12"; addMeses("2026-12", 1) === "2027-01".
 */
export function addMeses(mes: string, delta: number): string {
  const [anoStr, mesStr] = mes.split("-");
  let ano = parseInt(anoStr, 10);
  let mm = parseInt(mesStr, 10) + delta;
  while (mm > 12) {
    mm -= 12;
    ano += 1;
  }
  while (mm < 1) {
    mm += 12;
    ano -= 1;
  }
  return `${ano}-${String(mm).padStart(2, "0")}`;
}

/** Lista os 12 meses (YYYY-MM, ordem cronológica) terminando em `mesFim`, inclusive. */
export function listaMeses12(mesFim: string): string[] {
  const meses: string[] = [];
  for (let i = 11; i >= 0; i--) {
    meses.push(addMeses(mesFim, -i));
  }
  return meses;
}

/**
 * Agrupa linhas cruas {mes,dim,valor} em um Record<dim, pontos[]> com os 12 meses da
 * janela preenchidos (valor 0 onde não houver dado), na ordem cronológica de `meses`.
 * Soma valores quando a mesma (dim,mes) aparecer em mais de uma linha (defensivo).
 */
export function rowsParaSeries(rows: SerieRow[], meses: string[]): Record<string, SeriePonto[]> {
  const porDim = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!porDim.has(row.dim)) porDim.set(row.dim, new Map());
    const valoresPorMes = porDim.get(row.dim)!;
    valoresPorMes.set(row.mes, (valoresPorMes.get(row.mes) || 0) + (Number(row.valor) || 0));
  }

  const out: Record<string, SeriePonto[]> = {};
  for (const [dim, valoresPorMes] of Array.from(porDim.entries())) {
    out[dim] = meses.map((month) => ({ month, valor: valoresPorMes.get(month) || 0 }));
  }
  return out;
}

/**
 * Como `rowsParaSeries`, mas preenche meses sem dado com `null` em vez de 0 — para métricas
 * tipo média (ex: lead time), onde "sem observação no mês" é semanticamente diferente de
 * "0 dias/reais". O frontend já trata `valor: null` como "sem dado" em toda a cadeia do modo
 * Evolução (Sparkline filtra, deltaM1 filtra, TabelaEvolucao renderiza "—").
 *
 * Diferente de `rowsParaSeries`, não soma linhas duplicadas de (dim,mes) — as queries que
 * alimentam esta função já agregam com `GROUP BY mes, dim` no SQL (1 linha por combinação),
 * então uma segunda linha para a mesma chave apenas sobrescreve a primeira.
 */
export function rowsParaSeriesNullFill(rows: SerieRow[], meses: string[]): Record<string, SeriePontoNullable[]> {
  const porDim = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!porDim.has(row.dim)) porDim.set(row.dim, new Map());
    porDim.get(row.dim)!.set(row.mes, Number(row.valor) || 0);
  }

  const out: Record<string, SeriePontoNullable[]> = {};
  for (const [dim, valoresPorMes] of Array.from(porDim.entries())) {
    out[dim] = meses.map((month) => ({ month, valor: valoresPorMes.has(month) ? valoresPorMes.get(month)! : null }));
  }
  return out;
}

/**
 * Normaliza um nome de squad para permitir casar fontes com formatações diferentes — ex.:
 * `"Inhire".rh_pessoal.squad` (sem emoji, ex: "Selva") vs `"Clickup".cup_data_hist/
 * cup_contratos.squad` (com emoji, ex: "🪖 Selva"). Mesma lógica de `stripEmoji` usada em
 * `server/routes.ts` (~L6300, casamento colaborador RH → squad de receita nas despesas do
 * Relatório Mensal) — reaproveitada aqui para casar headcount RH → squad de MRR.
 * Mantém letras/números/espaço/`.`/`&`/`+` (remove emoji e demais pontuação), colapsa espaços
 * repetidos, minúsculas. Ex.: "✨ Aura (OFF)" → "aura off" (o sufixo "(OFF)" perde os parênteses
 * mas as letras "off" ficam — ver `encontrarSquadCorrespondente` para o match por prefixo que
 * cobre esse caso quando não há variante ativa sem o sufixo).
 *
 * Usa `\w` (sem flag `u`/`\p{L}`) de propósito — o `tsconfig.json` do projeto não declara
 * `target` (default ES3), e `\p{...}` exige ES2018+ (TS1501). Diacríticos (ã, ç, ...) são
 * tratados via `normalize("NFD")` + remoção das marcas combinantes antes do filtro de `\w`.
 */
export function normalizarNomeSquad(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s.&+]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Casa uma chave de squad já normalizada (lado RH) contra o mapa {squadNormalizado →
 * squadOriginal} derivado das chaves de `mrrPorSquad` (fonte da verdade dos nomes de squad
 * exibidos no scorecard). Tenta match exato primeiro; se não achar, cai para o melhor match por
 * prefixo (mais longo) — cobre casos como "Black Sheep" (RH) → "🐑 Black" (revenue) ou "Aura"
 * (RH) → "✨ Aura (OFF)" (revenue) quando não há variante ativa sem o sufixo "(OFF)".
 * `null` quando nenhum squad de receita casa (ex.: "Vendas", squad comercial sem MRR/entregas
 * registrado) — o headcount desse squad fica de fora do resultado.
 */
export function encontrarSquadCorrespondente(normKey: string, squadsPorNorm: Map<string, string>): string | null {
  if (!normKey) return null;
  if (squadsPorNorm.has(normKey)) return squadsPorNorm.get(normKey)!;

  let melhor: string | null = null;
  let melhorLen = 0;
  for (const [norm, original] of Array.from(squadsPorNorm.entries())) {
    if (normKey.startsWith(norm) || norm.startsWith(normKey)) {
      const len = Math.min(normKey.length, norm.length);
      if (len > melhorLen) {
        melhorLen = len;
        melhor = original;
      }
    }
  }
  return melhor;
}
