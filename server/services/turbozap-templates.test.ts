import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import { getTemplates, createTemplate, deleteTemplate } from './turbozap';

describe('getTemplates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista de templates', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, nome: 'Template A', conteudo: 'Olá {nome}', criado_por: 'user@x.com', criado_em: '2026-05-01T00:00:00Z' },
      ],
    });
    const result = await getTemplates();
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Template A');
  });

  it('retorna array vazio quando não há templates', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getTemplates();
    expect(result).toEqual([]);
  });
});

describe('createTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria e retorna o template inserido', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, nome: 'Novo', conteudo: 'Texto {valor}', criado_por: 'user', criado_em: '2026-05-01T00:00:00Z' }],
    });
    const result = await createTemplate('Novo', 'Texto {valor}', 'user');
    expect(result.id).toBe(2);
    expect(result.nome).toBe('Novo');
    expect(result.conteudo).toBe('Texto {valor}');
  });
});

describe('deleteTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lança erro se template não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(deleteTemplate(999)).rejects.toThrow('Template não encontrado');
  });

  it('resolve sem erro quando template existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await expect(deleteTemplate(1)).resolves.toBeUndefined();
  });
});
