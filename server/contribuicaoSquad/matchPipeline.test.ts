// Nota (2026-04-16): Aliases vivem na tabela cortex_core.item_alias_map e são consultados
// inline na query SQL de receitaPorItens.ts. Não há função TS pura para testar.
// Validação cobre: matchPipeline.test.ts (normalize/tokenize) + queries SQL ad-hoc + scripts/validateSquadVsDFC.ts.
import { describe, it, expect } from 'vitest';
import {
  normalizeNome,
  compactNome,
  tokenizeNome,
  STOPWORDS,
} from './matchPipeline';

describe('normalizeNome', () => {
  it('lowercase e unaccent', () => {
    expect(normalizeNome('Gestão de Performance')).toBe('gestao de performance');
  });

  it('remove pontuação para espaço', () => {
    expect(normalizeNome('E-commerce / Premium')).toBe('e commerce premium');
  });

  it('collapse whitespace', () => {
    expect(normalizeNome('  Social   Media  ')).toBe('social media');
  });

  it('string vazia', () => {
    expect(normalizeNome('')).toBe('');
  });
});

describe('compactNome', () => {
  it('remove todos os não-alfanuméricos', () => {
    expect(compactNome('E-commerce')).toBe('ecommerce');
    expect(compactNome('E commerce')).toBe('ecommerce');
    expect(compactNome('Ecommerce')).toBe('ecommerce');
  });

  it('preserva números', () => {
    expect(compactNome('1ª Entrega')).toBe('1aentrega');
  });

  it('unaccent antes de remover', () => {
    expect(compactNome('Gestão')).toBe('gestao');
  });
});

describe('tokenizeNome', () => {
  it('filtra stopwords', () => {
    expect(tokenizeNome('Gestão de Performance')).toEqual(['gestao', 'performance']);
  });

  it('filtra tokens com length < 3', () => {
    expect(tokenizeNome('CRM e Automação')).toEqual(['crm', 'automacao']);
  });

  it('filtra sufixos de tier (starter, scale, enterprise)', () => {
    expect(tokenizeNome('Gestão de performance - Starter')).toEqual(['gestao', 'performance']);
    expect(tokenizeNome('Performance Enterprise')).toEqual(['performance']);
  });

  it('remove duplicatas', () => {
    expect(tokenizeNome('Performance Performance')).toEqual(['performance']);
  });
});

describe('STOPWORDS', () => {
  it('contém as palavras-chave da spec', () => {
    expect(STOPWORDS).toContain('starter');
    expect(STOPWORDS).toContain('enterprise');
    expect(STOPWORDS).toContain('implantacao');
    expect(STOPWORDS).toContain('mensal');
  });
});
