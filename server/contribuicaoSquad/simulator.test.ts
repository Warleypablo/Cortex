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

  it('pontual à vista: 1 pagamento que cobre valorp completo', () => {
    const pontual = makeContrato({
      tipo: 'pontual',
      valor: 5000,
      servico: 'Landing Page',
      squad: 'Tech',
    });
    const cliente = makeCliente([pontual], {
      '2026-02': 5000,
    });

    simulateCliente(cliente, '2026-03');

    expect(pontual.recebido_por_mes.get('2026-02')).toBe(5000);
    expect(pontual.recebido_por_mes.get('2026-03')).toBeUndefined();
    expect(pontual.saldo_devedor).toBe(0);
  });

  it('pontual parcelado: distribui ao longo dos meses até saldo zerar', () => {
    const pontual = makeContrato({
      tipo: 'pontual',
      valor: 10000,
      servico: 'Ecommerce',
      squad: 'Tech',
    });
    const cliente = makeCliente([pontual], {
      '2026-01': 2000,
      '2026-02': 2000,
      '2026-03': 2000,
      '2026-04': 2000,
      '2026-05': 2000,
      '2026-06': 2000, // depois de saldo zerar — não deve atribuir
    });

    simulateCliente(cliente, '2026-06');

    expect(pontual.recebido_por_mes.get('2026-01')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-02')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-03')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-04')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-05')).toBe(2000);
    expect(pontual.recebido_por_mes.get('2026-06')).toBeUndefined();
    expect(pontual.saldo_devedor).toBe(0);
  });

  it('recorrente + pontual: recorrente fixo, sobra alimenta pontual', () => {
    const recorrente = makeContrato({
      id_subtask: 'rec-1',
      tipo: 'recorrente',
      valor: 2000,
      servico: 'Performance',
      squad: 'Squadra',
      data_inicio: new Date('2025-01-01'),
    });
    const pontual = makeContrato({
      id_subtask: 'pon-1',
      tipo: 'pontual',
      valor: 15000,
      servico: 'Ecommerce',
      squad: 'Tech',
      data_inicio: new Date('2025-09-22'),
    });
    const cliente = makeCliente([recorrente, pontual], {
      '2025-09': 5512,  // recorrente + parte do ecommerce
      '2025-10': 5512,
      '2025-11': 1967,  // só recorrente (cliente pagou menos que esperado)
      '2025-12': 1967,
      '2026-01': 1967,
      '2026-02': 1997,
      '2026-03': 1997,
    });

    simulateCliente(cliente, '2026-03');

    // Recorrente conta cheio mesmo quando cliente pagou menos (decisão #5)
    expect(recorrente.recebido_por_mes.get('2025-09')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2025-11')).toBe(2000);
    expect(recorrente.recebido_por_mes.get('2026-03')).toBe(2000);

    // Pontual recebe sobra (2 meses com sobra = 3512 cada)
    expect(pontual.recebido_por_mes.get('2025-09')).toBe(3512);
    expect(pontual.recebido_por_mes.get('2025-10')).toBe(3512);
    expect(pontual.recebido_por_mes.get('2025-11')).toBeUndefined();

    // Saldo após 2 meses de sobra: 15000 - 7024 = 7976
    expect(pontual.saldo_devedor).toBe(7976);
  });

  it('Creators 4 entregas: FIFO consome um contrato por mês', () => {
    const e1 = makeContrato({
      id_subtask: 'e1', tipo: 'pontual', valor: 6799,
      servico: '1ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-01'),
    });
    const e2 = makeContrato({
      id_subtask: 'e2', tipo: 'pontual', valor: 6799,
      servico: '2ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-02'),
    });
    const e3 = makeContrato({
      id_subtask: 'e3', tipo: 'pontual', valor: 6799,
      servico: '3ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-03'),
    });
    const e4 = makeContrato({
      id_subtask: 'e4', tipo: 'pontual', valor: 6799,
      servico: '4ª Entrega - Creators', squad: 'Makers',
      data_inicio: new Date('2025-08-04'),
    });
    const cliente = makeCliente([e1, e2, e3, e4], {
      '2025-09': 6799,
      '2025-10': 6799,
      '2025-11': 6799,
      '2025-12': 6799,
      '2026-01': 6799, // depois de tudo zerado — não deve atribuir nada
    });

    simulateCliente(cliente, '2026-01');

    // FIFO por data_inicio: e1 primeiro (2025-08-01), depois e2, e3, e4
    expect(e1.recebido_por_mes.get('2025-09')).toBe(6799);
    expect(e1.saldo_devedor).toBe(0);
    expect(e2.recebido_por_mes.get('2025-10')).toBe(6799);
    expect(e2.saldo_devedor).toBe(0);
    expect(e3.recebido_por_mes.get('2025-11')).toBe(6799);
    expect(e3.saldo_devedor).toBe(0);
    expect(e4.recebido_por_mes.get('2025-12')).toBe(6799);
    expect(e4.saldo_devedor).toBe(0);

    // Mês 2026-01: tudo zerado, nada recebe
    expect(e1.recebido_por_mes.get('2026-01')).toBeUndefined();
    expect(e4.recebido_por_mes.get('2026-01')).toBeUndefined();

    // Nenhum contrato pego por outro mês fora do esperado
    expect(e1.recebido_por_mes.get('2025-10')).toBeUndefined();
    expect(e2.recebido_por_mes.get('2025-09')).toBeUndefined();
  });
});
