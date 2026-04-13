// Reconciliação cumulativa de receitas por caixa (A3)
// Spec: docs/superpowers/specs/2026-04-10-receitas-pontuais-reconciliacao-design.md

export type ContratoTipo = 'recorrente' | 'pontual';

export interface ContratoSim {
  id_subtask: string;
  cnpj: string;
  squad: string;
  servico: string;
  tipo: ContratoTipo;
  valor: number;                // valorr (recorrente) ou valorp (pontual)
  data_inicio: Date;
  data_fim: Date | null;        // primeiro de [data_solicitacao_encerramento, data_encerramento]
  status: string;
  // estado mutável durante a simulação:
  saldo_devedor: number;        // só pontual; recorrente fica em 0
  recebido_por_mes: Map<string, number>; // 'YYYY-MM' -> valor
}

export interface ClienteSim {
  cnpj: string;
  cliente_nome: string;
  contratos: ContratoSim[];
  pagamentos_por_mes: Map<string, number>; // 'YYYY-MM' -> SUM(valor_pago)
}

// Status (normalizados: lowercase + trim) que indicam contrato recorrente inativo.
// Pontuais ignoram status — usam apenas data_fim.
const STATUS_RECORRENTE_INATIVO = new Set([
  'cancelado/inativo',
  'em cancelamento',
  'cancelado',
  'encerrado',
  'pausado',
  'não usar',
]);

// Tolerância de meio centavo para evitar saldo "fantasma" por imprecisão de float.
// Valores reais têm centavos (R$ 1.967,50), e somas/subtrações repetidas geram
// resíduos como 1517.9999999999998 que manteriam pontuais "vivos" indefinidamente.
const EPSILON = 0.005;

/** Retorna true se o contrato está ativo no mês YYYY-MM informado. */
export function contratoAtivoEm(c: ContratoSim, mesYYYYMM: string): boolean {
  const [ano, mes] = mesYYYYMM.split('-').map(Number);
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  const fimMes = new Date(Date.UTC(ano, mes, 0));

  if (c.data_inicio > fimMes) return false;
  if (c.data_fim && c.data_fim < inicioMes) return false;
  if (c.tipo === 'recorrente') {
    const statusNorm = (c.status || '').toLowerCase().trim();
    if (STATUS_RECORRENTE_INATIVO.has(statusNorm)) return false;
  }

  return true;
}

/** Gera todos os YYYY-MM entre dois meses (inclusivo). Ex: ('2024-11', '2025-02') -> ['2024-11','2024-12','2025-01','2025-02']. */
export function gerarMesesEntre(inicio: string, fim: string): string[] {
  const result: string[] = [];
  const [aIni, mIni] = inicio.split('-').map(Number);
  const [aFim, mFim] = fim.split('-').map(Number);
  let ano = aIni;
  let mes = mIni;
  while (ano < aFim || (ano === aFim && mes <= mFim)) {
    result.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes++;
    if (mes > 12) { mes = 1; ano++; }
  }
  return result;
}

/**
 * Simula reconciliação por caixa para 1 cliente.
 * MUTATES: cada contrato de cliente.contratos tem seu saldo_devedor e recebido_por_mes populados.
 */
export function simulateCliente(cliente: ClienteSim, mesAtualYYYYMM: string): void {
  // 1. Inicializar saldo devedor de cada pontual
  for (const c of cliente.contratos) {
    if (c.tipo === 'pontual') c.saldo_devedor = c.valor;
    else c.saldo_devedor = 0;
    c.recebido_por_mes = new Map();
  }

  // 2. Lista cronológica de meses, do primeiro pagamento até o mês atual
  const mesesPagos = Array.from(cliente.pagamentos_por_mes.keys()).sort();
  if (mesesPagos.length === 0) return;
  const primeiroMes = mesesPagos[0];
  const todosMeses = gerarMesesEntre(primeiroMes, mesAtualYYYYMM);

  // 3. Loop mês a mês
  for (const mes of todosMeses) {
    const totalPago = cliente.pagamentos_por_mes.get(mes) || 0;
    if (totalPago <= 0) continue;

    const ativos = cliente.contratos.filter(c => contratoAtivoEm(c, mes));

    // 3a. Recorrentes contam cheio se totalPago > 0
    const recorrentes = ativos.filter(c => c.tipo === 'recorrente');
    const somaRecorrentes = recorrentes.reduce((s, c) => s + c.valor, 0);
    for (const r of recorrentes) {
      r.recebido_por_mes.set(mes, r.valor);
    }

    // 3b. Sobra alimenta pontuais em FIFO por data_inicio
    let sobra = Math.max(0, totalPago - somaRecorrentes);
    if (sobra <= EPSILON) continue;

    const pontuaisFila = ativos
      .filter(c => c.tipo === 'pontual' && c.saldo_devedor > EPSILON)
      .sort((a, b) => a.data_inicio.getTime() - b.data_inicio.getTime());

    for (const p of pontuaisFila) {
      const atribuir = Math.min(p.saldo_devedor, sobra);
      const atual = p.recebido_por_mes.get(mes) || 0;
      p.recebido_por_mes.set(mes, atual + atribuir);
      p.saldo_devedor -= atribuir;
      sobra -= atribuir;
      if (sobra <= EPSILON) break;
    }
    // sobra residual (overpayment) é ignorada
  }
}
