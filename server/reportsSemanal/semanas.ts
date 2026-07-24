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
 * `ate` (opcional, 'YYYY-MM-DD') ancora o par na semana que contém aquela
 * data, para navegar o histórico:
 * - se `ate` cai na semana em curso (ou no futuro), é ignorado — a tela
 *   nunca mostra semana em curso, então o par volta a ser o default (última
 *   fechada + a anterior a ela);
 * - se `ate` cai exatamente na última semana fechada, o par recua mais uma
 *   semana. É o contrato de que depende o botão "semana anterior" do front:
 *   ele passa uma data de dentro da semana exibida para pedir a anterior;
 * - se `ate` cai numa semana mais antiga que essa, o par ancora ali mesmo
 *   (a semana que contém `ate` vira `atual`).
 */
export function parSemanas(hoje: string, ate?: string): { atual: Semana; anterior: Semana } {
  const [anteriorDefault, ultimaFechada, corrente] = gerarSemanas(hoje, 3);

  if (!ate || ate >= corrente.inicio) {
    return { atual: ultimaFechada, anterior: anteriorDefault };
  }

  // Amplia a janela até achar a semana que contém `ate`, com folga de pelo
  // menos duas posições antes dela. Sempre ancorada em `hoje` real — nunca em
  // `ate` — senão a própria semana de `ate` seria tratada como "em curso" e
  // descartada, quebrando o caso de `ate` cair numa semana mais antiga que a
  // última fechada.
  let quantidade = 3;
  let semanas = gerarSemanas(hoje, quantidade);
  let idx = semanas.findIndex((s) => ate >= s.inicio && ate <= s.fim);
  while (idx < 2) {
    quantidade += 10;
    semanas = gerarSemanas(hoje, quantidade);
    idx = semanas.findIndex((s) => ate >= s.inicio && ate <= s.fim);
  }
  const semanaDoAte = semanas[idx];

  if (semanaDoAte.inicio === ultimaFechada.inicio) {
    // "ate" caiu na última fechada: contrato do botão "semana anterior", recua mais uma.
    return { atual: semanas[idx - 1], anterior: semanas[idx - 2] };
  }
  return { atual: semanaDoAte, anterior: semanas[idx - 1] };
}
