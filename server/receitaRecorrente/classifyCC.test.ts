import { describe, it, expect } from 'vitest';
import { classifyParcela, type ParcelaInput, type ClassifiedResult } from './classifyCC';

function mkParcela(overrides: Partial<ParcelaInput>): ParcelaInput {
  return {
    centro_custo_nome: null,
    valor_centro_custo: null,
    valor_bruto: 0,
    status: 'PAGO',
    ...overrides,
  };
}

describe('classifyParcela', () => {
  it('case 1: CC único Recorrente → 100% RECORRENTE previsto+realizado', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Recorrente',
      valor_bruto: 1000,
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'RECORRENTE', previsto: 1000, realizado: 1000 },
    ]);
  });

  it('case 1b: CC único Pontual não-pago → 100% PONTUAL previsto, realizado 0', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual',
      valor_bruto: 500,
      status: 'PENDENTE',
    }));
    expect(result).toEqual([
      { tipo: 'PONTUAL', previsto: 500, realizado: 0 },
    ]);
  });

  it('case 1c: CC único não classificado → NAO_CLASSIFICADO', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Turbo Commerce',
      valor_bruto: 2000,
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'NAO_CLASSIFICADO', previsto: 2000, realizado: 2000 },
    ]);
  });

  it('case 2: múltiplos CCs do mesmo tipo → usa valor_bruto direto (ignora split inflado)', () => {
    // Bug do Conta Azul: repete valor total em cada parcela de venda parcelada
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Recorrente;Recorrente',
      valor_centro_custo: '3937.04;0.0',   // inflado (valor total da venda, não da parcela)
      valor_bruto: 1312.35,                 // valor real da parcela
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'RECORRENTE', previsto: 1312.35, realizado: 1312.35 },
    ]);
  });

  it('case 3: CC misto Pontual;Recorrente → split posicional', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual;Recorrente',
      valor_centro_custo: '2748.5;2997.0',
      valor_bruto: 5745.50,
      status: 'PAGO',
    }));
    // Ordem do array importa: usar sort para não depender
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 2748.5, realizado: 2748.5 });
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 2997.0, realizado: 2997.0 });
  });

  it('case 3b: CC misto com zeros e mais de 2 itens', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual;Recorrente;Pontual;Recorrente',
      valor_centro_custo: '0.0;0.0;3599.77;6294.6',
      valor_bruto: 9894.37,
      status: 'PENDENTE',
    }));
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 3599.77, realizado: 0 });
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 6294.6, realizado: 0 });
  });

  it('case 3c: CC misto maiúsculas (PEIXOTO DEBBANE)', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'RECORRENTE;PONTUAL',
      valor_centro_custo: '1997.0;833.08',
      valor_bruto: 2830.08,
      status: 'QUITADO',
    }));
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 1997.0, realizado: 1997.0 });
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 833.08, realizado: 833.08 });
  });

  it('centro_custo_nome null → NAO_CLASSIFICADO', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: null,
      valor_bruto: 500,
      status: 'PAGO',
    }));
    expect(result).toEqual([
      { tipo: 'NAO_CLASSIFICADO', previsto: 500, realizado: 500 },
    ]);
  });

  it('valor_centro_custo com string vazia no meio → trata como 0', () => {
    const result = classifyParcela(mkParcela({
      centro_custo_nome: 'Pontual;Recorrente',
      valor_centro_custo: ';500',
      valor_bruto: 500,
      status: 'PAGO',
    }));
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ tipo: 'PONTUAL', previsto: 0, realizado: 0 });
    expect(result).toContainEqual({ tipo: 'RECORRENTE', previsto: 500, realizado: 500 });
  });
});
