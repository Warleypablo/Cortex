import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TvRotator } from '../TvRotator';

describe('TvRotator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renderiza a primeira tela inicialmente', () => {
    render(<TvRotator screens={[<div>Tela A</div>, <div>Tela B</div>]} intervalMs={30000} />);
    expect(screen.getByText('Tela A')).toBeInTheDocument();
    expect(screen.queryByText('Tela B')).not.toBeInTheDocument();
  });

  it('alterna para a próxima tela após o intervalo', () => {
    render(<TvRotator screens={[<div>Tela A</div>, <div>Tela B</div>]} intervalMs={30000} />);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(screen.getByText('Tela B')).toBeInTheDocument();
    expect(screen.queryByText('Tela A')).not.toBeInTheDocument();
  });

  it('volta para a primeira tela ao concluir o ciclo', () => {
    render(<TvRotator screens={[<div>Tela A</div>, <div>Tela B</div>]} intervalMs={30000} />);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(screen.getByText('Tela A')).toBeInTheDocument();
  });
});
