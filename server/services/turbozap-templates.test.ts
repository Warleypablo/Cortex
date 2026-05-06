import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import {
  getTemplates,
  createTemplate,
  deleteTemplate,
  getNiveisDesativados,
  toggleNivel,
} from './turbozap';

// ---- getTemplates ----
describe('getTemplates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista de templates com campo nivel', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 1, nome: 'Template A', conteudo: 'Olá {nome}', criado_por: 'user@x.com', criado_em: '2026-05-01T00:00:00Z', nivel: 'D+7' },
      ],
    });
    const result = await getTemplates();
    expect(result).toHaveLength(1);
    expect(result[0].nivel).toBe('D+7');
  });

  it('retorna nivel null para templates genéricos', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, nome: 'Genérico', conteudo: 'Texto', criado_por: null, criado_em: '2026-05-01T00:00:00Z', nivel: null }],
    });
    const result = await getTemplates();
    expect(result[0].nivel).toBeNull();
  });

  it('retorna array vazio quando não há templates', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getTemplates();
    expect(result).toEqual([]);
  });
});

// ---- createTemplate ----
describe('createTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria template sem nivel (genérico)', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 2, nome: 'Novo', conteudo: 'Texto {valor}', criado_por: 'user', criado_em: '2026-05-01T00:00:00Z', nivel: null }],
    });
    const result = await createTemplate('Novo', 'Texto {valor}', 'user', null);
    expect(result.id).toBe(2);
    expect(result.nivel).toBeNull();
  });

  it('cria template com nivel específico', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 3, nome: 'D+7 Template', conteudo: 'Texto', criado_por: 'user', criado_em: '2026-05-01T00:00:00Z', nivel: 'D+7' }],
    });
    const result = await createTemplate('D+7 Template', 'Texto', 'user', 'D+7');
    expect(result.nivel).toBe('D+7');
  });

  it('lança erro se INSERT retorna vazio', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(createTemplate('Novo', 'Texto', 'user', null)).rejects.toThrow('Falha ao criar template');
  });

  it('permite criadoPor null', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ id: 3, nome: 'Template Anonimo', conteudo: 'Conteúdo', criado_por: null, criado_em: '2026-05-01T00:00:00Z', nivel: null }],
    });
    const result = await createTemplate('Template Anonimo', 'Conteúdo', null, null);
    expect(result.criado_por).toBeNull();
  });
});

// ---- deleteTemplate ----
describe('deleteTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lança erro se template não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    await expect(deleteTemplate(999)).rejects.toThrow('Template #999 não encontrado');
  });

  it('resolve sem erro quando template existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    await expect(deleteTemplate(1)).resolves.toBeUndefined();
  });
});

// ---- getNiveisDesativados ----
describe('getNiveisDesativados', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna array vazio se chave não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getNiveisDesativados();
    expect(result).toEqual([]);
  });

  it('retorna array parseado da chave', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '["D+14","D+20"]' }] });
    const result = await getNiveisDesativados();
    expect(result).toEqual(['D+14', 'D+20']);
  });

  it('retorna array vazio se JSON inválido', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: 'not-json' }] });
    const result = await getNiveisDesativados();
    expect(result).toEqual([]);
  });

  it('retorna array vazio se JSON é válido mas não é array', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: 'null' }] });
    const result = await getNiveisDesativados();
    expect(result).toEqual([]);
  });
});

// ---- toggleNivel ----
describe('toggleNivel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adiciona nivel ao array quando ativo=false', async () => {
    // 1st call: reads niveis_desativados (empty)
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '[]' }] });
    // 2nd call: UPDATE configuracao
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1, chave: 'niveis_desativados', valor: '["D+14"]', atualizado_por: 'user', atualizado_em: '2026-05-06' }] });

    const result = await toggleNivel('D+14', false, 'user');
    expect(result).toContain('D+14');
  });

  it('remove nivel do array quando ativo=true', async () => {
    // 1st call: reads niveis_desativados with D+14 present
    mockExecute.mockResolvedValueOnce({ rows: [{ valor: '["D+14","D+20"]' }] });
    // 2nd call: UPDATE configuracao
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 1, chave: 'niveis_desativados', valor: '["D+20"]', atualizado_por: 'user', atualizado_em: '2026-05-06' }] });

    const result = await toggleNivel('D+14', true, 'user');
    expect(result).not.toContain('D+14');
    expect(result).toContain('D+20');
  });

  it('lança erro para nivel desconhecido', async () => {
    await expect(toggleNivel('INVALIDO', false, 'user')).rejects.toThrow('Nível desconhecido: INVALIDO');
  });
});
