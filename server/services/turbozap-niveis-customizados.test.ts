import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import {
  getNiveisCustomizados,
  getNiveisInfo,
  createNivelCustomizado,
  deleteNivelCustomizado,
} from './turbozap';

// ---- getNiveisCustomizados ----
describe('getNiveisCustomizados', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista de níveis customizados', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro', criado_por: 'user', criado_em: '2026-05-06T00:00:00Z' },
      ],
    });
    const result = await getNiveisCustomizados();
    expect(result).toHaveLength(1);
    expect(result[0].tipo).toBe('D+1');
  });

  it('retorna array vazio quando não há customizados', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getNiveisCustomizados();
    expect(result).toEqual([]);
  });
});

// ---- getNiveisInfo ----
describe('getNiveisInfo', () => {
  it('combina sistema + custom ordenados por dias', () => {
    const customizados = [
      { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro' as const, criado_por: null, criado_em: '' },
    ];
    const desativados: string[] = [];
    const result = getNiveisInfo(customizados, desativados);

    // D-3 (dias=-3) deve vir primeiro
    expect(result[0].tipo).toBe('D-3');
    // D+1 (dias=1) deve vir entre D+0 e D+3
    const d0idx = result.findIndex(n => n.tipo === 'D+0');
    const d1idx = result.findIndex(n => n.tipo === 'D+1');
    const d3idx = result.findIndex(n => n.tipo === 'D+3');
    expect(d0idx).toBeLessThan(d1idx);
    expect(d1idx).toBeLessThan(d3idx);
  });

  it('marca is_custom corretamente', () => {
    const customizados = [
      { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro' as const, criado_por: null, criado_em: '' },
    ];
    const result = getNiveisInfo(customizados, []);
    const d1 = result.find(n => n.tipo === 'D+1');
    const d3 = result.find(n => n.tipo === 'D+3');
    expect(d1?.is_custom).toBe(true);
    expect(d3?.is_custom).toBe(false);
  });

  it('aplica desativados corretamente', () => {
    const result = getNiveisInfo([], ['D+7']);
    const d7 = result.find(n => n.tipo === 'D+7');
    const d3 = result.find(n => n.tipo === 'D+3');
    expect(d7?.ativo).toBe(false);
    expect(d3?.ativo).toBe(true);
  });

  it('inclui instancia em todos os itens', () => {
    const customizados = [
      { id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro' as const, criado_por: null, criado_em: '' },
    ];
    const result = getNiveisInfo(customizados, []);
    for (const n of result) {
      expect(n.instancia).toMatch(/^(financeiro|juridico)$/);
    }
  });
});

// ---- createNivelCustomizado ----
describe('createNivelCustomizado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gera tipo D+1 para dias=1', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 1, tipo: 'D+1', label: 'D+1 (Customizado)', dias: 1, instancia: 'financeiro', criado_por: 'user', criado_em: '2026-05-06T00:00:00Z' }],
    });
    mockExecute.mockResolvedValueOnce({ rows: [] }); // seed template
    const result = await createNivelCustomizado(1, 'user');
    expect(result.tipo).toBe('D+1');
  });

  it('gera tipo D-1 para dias=-1', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, tipo: 'D-1', label: 'D-1 (Customizado)', dias: -1, instancia: 'financeiro', criado_por: 'user', criado_em: '2026-05-06T00:00:00Z' }],
    });
    mockExecute.mockResolvedValueOnce({ rows: [] }); // seed template
    const result = await createNivelCustomizado(-1, 'user');
    expect(result.tipo).toBe('D-1');
  });

  it('lança erro se conflita com nível de sistema', async () => {
    // D+7 é sistema, dias=7
    await expect(createNivelCustomizado(7, 'user')).rejects.toThrow('já existe como nível de sistema');
  });

  it('lança erro se INSERT retorna vazio', async () => {
    // dias=1 não conflita com sistema
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(createNivelCustomizado(1, 'user')).rejects.toThrow('Falha ao criar nível');
  });
});

// ---- deleteNivelCustomizado ----
describe('deleteNivelCustomizado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lança erro se for nível de sistema', async () => {
    await expect(deleteNivelCustomizado('D+7')).rejects.toThrow('nível de sistema');
  });

  it('lança erro se nível customizado não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] }); // DELETE retorna vazio
    await expect(deleteNivelCustomizado('D+1')).rejects.toThrow('não encontrado');
  });

  it('deleta e remove template config', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // DELETE customizado
    mockExecute.mockResolvedValueOnce({ rows: [] }); // DELETE configuracao
    await expect(deleteNivelCustomizado('D+1')).resolves.toBeUndefined();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });
});
