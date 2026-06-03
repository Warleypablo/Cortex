import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock do db
const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

// Mock do sendAlertEmail
const mockSendAlertEmail = vi.fn();
vi.mock('./sendgrid-notification', () => ({
  sendAlertEmail: (...args: any[]) => mockSendAlertEmail(...args),
  SendGridError: class SendGridError extends Error {
    status: number; body: any;
    constructor(status: number, body: any) { super('SendGrid error'); this.status = status; this.body = body; }
  },
}));

import {
  formatDate,
  snapshotExists,
  runSnapshotJob,
  tick,
  recoverOnStartup,
} from './saldoDiarioSnapshotJob';

describe('formatDate', () => {
  it('formata data como YYYY-MM-DD', () => {
    const d = new Date(2026, 3, 30); // 30 de abril de 2026
    expect(formatDate(d)).toBe('2026-04-30');
  });

  it('zero-pad mês e dia', () => {
    const d = new Date(2026, 0, 5); // 5 de janeiro
    expect(formatDate(d)).toBe('2026-01-05');
  });
});

describe('snapshotExists', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('retorna true quando há registro para a data', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await snapshotExists('2026-04-30')).toBe(true);
  });

  it('retorna false quando não há registro', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    expect(await snapshotExists('2026-04-30')).toBe(false);
  });
});

describe('runSnapshotJob', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lê saldo de caz_bancos e faz upsert', async () => {
    // 1ª chamada: SELECT SUM(balance) → 1250715.46
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '1250715.46' }] });
    // 2ª chamada: INSERT/UPDATE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await runSnapshotJob('2026-04-30');

    expect(result.data).toBe('2026-04-30');
    expect(result.saldoTotal).toBe(1250715.46);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('usa data de hoje quando nenhuma data é passada', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '500000' }] });
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await runSnapshotJob();

    expect(result.data).toBe(formatDate(new Date()));
  });

  it('trata saldo_total null como 0', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: null }] });
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const result = await runSnapshotJob('2026-05-01');
    expect(result.saldoTotal).toBe(0);
  });
});

describe('tick', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('não executa quando hora atual não é 18', async () => {
    vi.setSystemTime(new Date('2026-05-04T10:00:00'));
    await tick();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('não executa quando snapshot já existe para hoje', async () => {
    vi.setSystemTime(new Date('2026-05-04T18:30:00'));
    // snapshotExists retorna true
    mockExecute.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await tick();
    expect(mockExecute).toHaveBeenCalledTimes(1); // só a consulta de existência
  });

  it('executa quando hora é 18 e snapshot não existe', async () => {
    vi.setSystemTime(new Date('2026-05-04T18:05:00'));
    // snapshotExists → false
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // SELECT SUM(balance)
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '999999' }] });
    // INSERT
    mockExecute.mockResolvedValueOnce({ rows: [] });

    await tick();
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});

describe('recoverOnStartup', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('não executa quando hora < 18 (servidor subiu cedo)', async () => {
    vi.setSystemTime(new Date('2026-05-04T08:00:00'));
    await recoverOnStartup();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('não executa quando snapshot já existe', async () => {
    vi.setSystemTime(new Date('2026-05-04T20:00:00'));
    mockExecute.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await recoverOnStartup();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('dispara snapshot quando servidor subiu após 18h e não há registro', async () => {
    vi.setSystemTime(new Date('2026-05-04T22:00:00'));
    mockExecute.mockResolvedValueOnce({ rows: [] });         // snapshotExists → false
    mockExecute.mockResolvedValueOnce({ rows: [{ saldo_total: '750000' }] }); // SELECT
    mockExecute.mockResolvedValueOnce({ rows: [] });         // INSERT

    await recoverOnStartup();
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});
