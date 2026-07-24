// Cálculo puro das janelas semanais da tela /reports/semanal.
//
// Toda aritmética de data acontece em UTC sobre a data civil 'YYYY-MM-DD' para
// não sofrer com horário de verão nem com o timezone do servidor — o mesmo
// truque que reportsSemanal.helpers.ts usava antes de ser absorvido aqui.

export interface Semana {
  /** segunda-feira, 'YYYY-MM-DD' */
  inicio: string;
  /** domingo, 'YYYY-MM-DD' */
  fim: string;
  /** rótulo curto da coluna, 'DD/MM' do início */
  label: string;
  /** true na semana que contém "hoje": ainda está em curso, dados incompletos */
  parcial: boolean;
}

function parseISO(d: string): Date {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd));
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function addDays(dt: Date, n: number): Date {
  return new Date(dt.getTime() + n * 86400000);
}

/** Data civil de hoje em America/Sao_Paulo, 'YYYY-MM-DD'. */
export function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * As `quantidade` últimas semanas (segunda→domingo) terminando na semana que
 * contém `hoje`, em ordem cronológica. A última é sempre a semana corrente e
 * vem com `parcial: true` — inclusive no domingo, porque o dia ainda não
 * terminou.
 */
export function gerarSemanas(hoje: string, quantidade: number): Semana[] {
  const hojeDt = parseISO(hoje);
  const dow = hojeDt.getUTCDay(); // 0=domingo .. 6=sábado
  const segundaCorrente = addDays(hojeDt, -((dow + 6) % 7));

  const semanas: Semana[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const inicio = addDays(segundaCorrente, -7 * i);
    const fim = addDays(inicio, 6);
    semanas.push({
      inicio: fmt(inicio),
      fim: fmt(fim),
      label: `${fmt(inicio).slice(8, 10)}/${fmt(inicio).slice(5, 7)}`,
      parcial: i === 0,
    });
  }
  return semanas;
}

/**
 * O par que a tela /reports/operacao compara: a última semana FECHADA e a
 * imediatamente anterior, ambas com `parcial: false`.
 *
 * A semana em curso nunca entra — nem no domingo, porque o dia ainda não
 * terminou e o snapshot de fechamento pode não existir. Comparar meia semana
 * com uma inteira produz queda fantasma toda segunda.
 *
 * `ate` (opcional, 'YYYY-MM-DD') é um "hoje simulado", para navegar o
 * histórico: a semana que CONTÉM `ate` é descartada como em curso, exatamente
 * como acontece com `hoje`, e o par são as duas fechadas anteriores a ela.
 *
 * Uma semântica só, sem casos especiais — vale igual para uma data da semana
 * passada e para uma de dois meses atrás. É dela que depende o botão "semana
 * anterior" do front, que passa um dia da semana SEGUINTE à que quer exibir.
 * Data futura é ignorada: não se navega para frente do presente.
 */
export function parSemanas(hoje: string, ate?: string): { atual: Semana; anterior: Semana } {
  const ancora = ate && ate < hoje ? ate : hoje;
  // 3 semanas: gerarSemanas devolve a corrente na última posição, e ela sai.
  const semanas = gerarSemanas(ancora, 3);
  const fechadas = semanas.filter((s) => !s.parcial);
  const atual = fechadas[fechadas.length - 1];
  const anterior = fechadas[fechadas.length - 2];
  return { atual, anterior };
}
