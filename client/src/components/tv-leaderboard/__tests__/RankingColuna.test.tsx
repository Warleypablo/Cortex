import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RankingColuna } from '../RankingColuna';
import type { RankingPessoa } from '../types';

const fakePessoa = (i: number): RankingPessoa => ({
  id: `p-${i}`,
  nome: `Pessoa ${i}`,
  avatarUrl: null,
  squad: 'Squad A',
  corSquad: '#3b82f6',
  valor: 1000 - i * 100,
  posicaoAtual: i,
  posicaoAnterior: i,
  sparkline: [100, 120, 140, 130, 150, 160],
  tendenciaPct: 5,
  badges: [],
});

describe('RankingColuna', () => {
  it('renderiza top 3 no pódio e o restante na lista', () => {
    const ranking = Array.from({ length: 10 }, (_, i) => fakePessoa(i + 1));
    render(<RankingColuna titulo="MRR" icone="💰" ranking={ranking} metrica="mrr" />);
    expect(screen.getByText('MRR')).toBeInTheDocument();
    expect(screen.getByText('Pessoa 1')).toBeInTheDocument();
    expect(screen.getByText('Pessoa 4')).toBeInTheDocument();
    expect(screen.getByText('Pessoa 10')).toBeInTheDocument();
  });
});
