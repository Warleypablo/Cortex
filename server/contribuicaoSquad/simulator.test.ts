import { describe, it, expect } from 'vitest';
import { simulateCliente, ClienteSim, ContratoSim } from './simulator';

function makeContrato(overrides: Partial<ContratoSim>): ContratoSim {
  return {
    id_subtask: 'sub-1',
    cnpj: '11111111000111',
    squad: 'Squadra',
    servico: 'Performance',
    tipo: 'recorrente',
    valor: 0,
    data_inicio: new Date('2024-01-01'),
    data_fim: null,
    status: 'ativo',
    saldo_devedor: 0,
    recebido_por_mes: new Map(),
    ...overrides,
  };
}

function makeCliente(contratos: ContratoSim[], pagamentos: Record<string, number>): ClienteSim {
  return {
    cnpj: '11111111000111',
    cliente_nome: 'Cliente Teste',
    contratos,
    pagamentos_por_mes: new Map(Object.entries(pagamentos)),
  };
}

describe('simulateCliente', () => {
  it('cliente só com recorrente: cada mês conta valorr cheio', () => {
    const recorrente = makeContrato({ tipo: 'recorrente', valor: 2000 });
    const cliente = makeCliente([recorrente], {
      '2026-01': 2000,
      '2026-02': 2000,
      '2026-03': 2000,
    });

    simulateCliente(cliente, '2026-03');

    expect(recorrente.recebido_por_mes.get('2026-01')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2026-02')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2026-03')).toBe(2000);
  });
});
