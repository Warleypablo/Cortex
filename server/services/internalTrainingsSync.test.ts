import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de googleapis
const mockFilesList = vi.fn();
vi.mock('../autoreport/credentials', () => ({
  getDriveClient: () => ({
    files: { list: (...args: any[]) => mockFilesList(...args) },
  }),
}));

// Mock do db
const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import { syncInternalTrainings, _resetSyncLockForTest } from './internalTrainingsSync';

describe('syncInternalTrainings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_TRAININGS_DRIVE_FOLDER_ID = 'root-folder-id';
    _resetSyncLockForTest();

    // db.execute padrão: retorna { rows: [] }
    mockExecute.mockResolvedValue({ rows: [] });
  });

  it('lista subpastas e vídeos, fazendo upsert nas trilhas e vídeos', async () => {
    // 1ª chamada: listar subpastas de TREINAMENTOS
    mockFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'folder-perf', name: 'Performance' },
          { id: 'folder-ia', name: 'IA' },
        ],
      },
    });
    // Upsert da trilha Performance retorna o id
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'tr-perf-uuid' }] });
    // 2ª chamada: vídeos de Performance
    mockFilesList.mockResolvedValueOnce({
      data: {
        files: [
          {
            id: 'vid-1',
            name: 'Aula 1.mp4',
            mimeType: 'video/mp4',
            videoMediaMetadata: { durationMillis: '600000' },
            modifiedTime: '2026-04-25T10:00:00Z',
          },
        ],
      },
    });
    // Insert do vídeo (sem RETURNING aqui mas mock OK)
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // Upsert da trilha IA retorna o id
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'tr-ia-uuid' }] });
    // 3ª chamada: vídeos de IA (vazio)
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });
    // Reconciliação: SELECT all tracks
    mockExecute.mockResolvedValueOnce({ rows: [
      { id: 'tr-perf-uuid', drive_folder_id: 'folder-perf' },
      { id: 'tr-ia-uuid', drive_folder_id: 'folder-ia' },
    ]});
    // Reconciliação: SELECT all videos
    mockExecute.mockResolvedValueOnce({ rows: [
      { id: 'vid-uuid', drive_file_id: 'vid-1' },
    ]});

    const report = await syncInternalTrainings();

    expect(report.ok).toBe(true);
    expect(report.trilhasAtivas).toBe(2);
    expect(report.videosAtivos).toBe(1);
    expect(report.trilhasDesativadas).toBe(0);
    expect(report.videosDesativados).toBe(0);
  });

  it('passa filtro de mimeType=video/ no query do Drive', async () => {
    mockFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'folder-perf', name: 'Performance' }] },
    });
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'tr-perf-uuid' }] });
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });

    await syncInternalTrainings();

    // Verifica que a 2ª chamada (vídeos) usou filtro mimeType contains 'video/'
    expect(mockFilesList).toHaveBeenCalledTimes(2);
    const videosCall = mockFilesList.mock.calls[1][0];
    expect(videosCall.q).toContain("mimeType contains 'video/'");
  });

  it('continua processando outras trilhas quando uma falha', async () => {
    mockFilesList.mockResolvedValueOnce({
      data: {
        files: [
          { id: 'folder-perf', name: 'Performance' },
          { id: 'folder-ia', name: 'IA' },
        ],
      },
    });
    // Performance: upsert track sucede, mas listar vídeos falha
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'tr-perf-uuid' }] });
    mockFilesList.mockRejectedValueOnce(new Error('Quota exceeded'));
    // IA sucede
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'tr-ia-uuid' }] });
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });

    const report = await syncInternalTrainings();

    expect(report.ok).toBe(true);
    expect(report.erros.length).toBeGreaterThanOrEqual(1);
    expect(report.erros.some(e => e.contexto.toLowerCase().includes('performance'))).toBe(true);
  });

  it('retorna alreadyRunning se sync já está em andamento', async () => {
    // Primeira chamada nunca resolve (mantém lock)
    mockFilesList.mockReturnValueOnce(new Promise(() => {}));
    const inflight = syncInternalTrainings();
    // dá uma microtask para a primeira invocação adquirir o lock
    await Promise.resolve();

    const second = await syncInternalTrainings();

    expect(second.ok).toBe(true);
    expect(second.alreadyRunning).toBe(true);
    // Não consumimos o inflight para o teste não esperar para sempre
    void inflight;
  });

  it('falha cedo se INTERNAL_TRAININGS_DRIVE_FOLDER_ID não estiver setada', async () => {
    delete process.env.INTERNAL_TRAININGS_DRIVE_FOLDER_ID;

    const report = await syncInternalTrainings();

    expect(report.ok).toBe(false);
    expect(report.erros[0].mensagem).toMatch(/INTERNAL_TRAININGS_DRIVE_FOLDER_ID/);
  });

  it('não desativa trilha que erra durante sync (preserva dados)', async () => {
    // Subpastas
    mockFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'folder-perf', name: 'Performance' }] },
    });
    // Track upsert sucede
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'tr-perf-uuid' }] });
    // Listar vídeos da Performance falha (transient error)
    mockFilesList.mockRejectedValueOnce(new Error('Network timeout'));
    // Reconciliação trilhas: existem 2 trilhas (a errada + uma órfã antiga)
    mockExecute.mockResolvedValueOnce({ rows: [
      { id: 'tr-perf-uuid', drive_folder_id: 'folder-perf' },
      { id: 'tr-old-uuid', drive_folder_id: 'folder-old' },
    ]});
    // UPDATE deactivates só a tr-old (não a tr-perf-uuid que errou)
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // Query auxiliar de vídeos em trilhas erradas
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'vid-perf-existing' }] });
    // Reconciliação vídeos
    mockExecute.mockResolvedValueOnce({ rows: [
      { id: 'vid-perf-existing', drive_file_id: 'vid-perf' },
      { id: 'vid-other', drive_file_id: 'vid-other-id' },
    ]});
    // UPDATE de vídeos
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const report = await syncInternalTrainings();

    // Trilha Performance NÃO foi desativada apesar de ter errado.
    // Apenas a tr-old foi (1 desativação).
    expect(report.trilhasDesativadas).toBe(1);
    // Vídeo da Performance NÃO foi desativado (vid-perf-existing está em trilha errada).
    // Apenas vid-other foi.
    expect(report.videosDesativados).toBe(1);
    expect(report.erros.length).toBeGreaterThanOrEqual(1);
  });

  it('reconciliação que falha não invalida sync inteiro', async () => {
    mockFilesList.mockResolvedValueOnce({
      data: { files: [{ id: 'folder-perf', name: 'Performance' }] },
    });
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'tr-perf-uuid' }] });
    mockFilesList.mockResolvedValueOnce({ data: { files: [] } });
    // Reconciliação trilhas falha
    mockExecute.mockRejectedValueOnce(new Error('DB connection lost'));
    // Reconciliação vídeos sucede mesmo assim (executa com lista vazia ou similar)
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const report = await syncInternalTrainings();

    expect(report.ok).toBe(true);
    expect(report.trilhasAtivas).toBe(1);
    expect(report.erros.some(e => e.contexto.includes('reconciliação'))).toBe(true);
  });
});
