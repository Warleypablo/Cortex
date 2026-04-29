import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockExecute = vi.fn();
vi.mock('../db', () => ({
  db: { execute: (...args: any[]) => mockExecute(...args) },
}));

import { registerInternalTrainingsRoutes } from './internalTrainings';

function buildApp(userEmail = 'warley@cortex.com', userName = 'Warley Pablo') {
  const app = express();
  app.use(express.json());
  // Middleware fake de auth
  app.use((req, _res, next) => {
    (req as any).user = { email: userEmail, name: userName };
    next();
  });
  registerInternalTrainingsRoutes(app);
  return app;
}

describe('GET /api/treinamentos-internos/trilhas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna lista agregada de trilhas com progresso do usuário', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 'tr-1', nome: 'Performance', totalVideos: 12, videosConcluidos: 4, ultimoVideoModificadoEm: null },
      ],
    });

    const res = await request(buildApp()).get('/api/treinamentos-internos/trilhas');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].videosConcluidos).toBe(4);
  });
});

describe('GET /api/treinamentos-internos/videos/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 404 para vídeo inativo (is_active = false)', async () => {
    // Query do vídeo retorna vazio porque WHERE is_active = TRUE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).get('/api/treinamentos-internos/videos/abc-123');

    expect(res.status).toBe(404);
  });

  it('marca isOwner=true em comentários do próprio usuário', async () => {
    // Vídeo
    mockExecute.mockResolvedValueOnce({
      rows: [{
        id: 'vid-1', nome: 'Aula 1', driveFileId: '1abc', thumbnailUrl: '...',
        duracaoMs: 600000, driveModifiedTime: null, trackId: 'tr-1', trackNome: 'Performance',
      }],
    });
    // Promise.all: concluiu, curtiu, likes, comentários
    mockExecute.mockResolvedValueOnce({ rows: [] });
    mockExecute.mockResolvedValueOnce({ rows: [] });
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 0 }] });
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 'c1', userEmail: 'warley@cortex.com', userNome: 'Warley', conteudo: 'meu', createdAt: '2026-04-29T12:00:00Z' },
        { id: 'c2', userEmail: 'outro@cortex.com', userNome: 'Outro', conteudo: 'alheio', createdAt: '2026-04-29T11:00:00Z' },
      ],
    });

    const res = await request(buildApp('warley@cortex.com')).get('/api/treinamentos-internos/videos/vid-1');

    expect(res.status).toBe(200);
    expect(res.body.comentarios[0].isOwner).toBe(true);
    expect(res.body.comentarios[1].isOwner).toBe(false);
  });
});

describe('GET /api/treinamentos-internos/videos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna 400 se trackId não for fornecido', async () => {
    const res = await request(buildApp()).get('/api/treinamentos-internos/videos');

    expect(res.status).toBe(400);
  });

  it('retorna lista de vídeos da trilha', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 'v-1', nome: 'Aula 1', driveFileId: '1abc', thumbnailUrl: 'x',
          duracaoMs: 600000, driveModifiedTime: null,
          userConcluiu: false, userCurtiu: false, totalLikes: 0, totalComentarios: 0 },
      ],
    });

    const res = await request(buildApp()).get('/api/treinamentos-internos/videos?trackId=tr-1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/treinamentos-internos/videos/:id/concluir', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria registro de conclusão na primeira chamada', async () => {
    // SELECT 1 FROM completions: vazio → vai inserir
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // INSERT
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'comp-1' }] });

    const res = await request(buildApp()).post('/api/treinamentos-internos/videos/vid-1/concluir');

    expect(res.status).toBe(200);
    expect(res.body.concluido).toBe(true);
  });

  it('deleta registro na segunda chamada (toggle off)', async () => {
    // SELECT 1: já existe
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'comp-1' }] });
    // DELETE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).post('/api/treinamentos-internos/videos/vid-1/concluir');

    expect(res.status).toBe(200);
    expect(res.body.concluido).toBe(false);
  });
});

describe('POST /api/treinamentos-internos/videos/:id/like', () => {
  beforeEach(() => vi.clearAllMocks());

  it('toggle like e retorna totalLikes', async () => {
    // SELECT 1: vazio → insere
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // INSERT
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'l-1' }] });
    // SELECT count
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 7 }] });

    const res = await request(buildApp()).post('/api/treinamentos-internos/videos/vid-1/like');

    expect(res.status).toBe(200);
    expect(res.body.curtiu).toBe(true);
    expect(res.body.totalLikes).toBe(7);
  });

  it('toggle like off retorna curtiu=false', async () => {
    // SELECT 1: já existe → vai deletar
    mockExecute.mockResolvedValueOnce({ rows: [{ id: 'l-1' }] });
    // DELETE
    mockExecute.mockResolvedValueOnce({ rows: [] });
    // SELECT count
    mockExecute.mockResolvedValueOnce({ rows: [{ total: 6 }] });

    const res = await request(buildApp()).post('/api/treinamentos-internos/videos/vid-1/like');

    expect(res.status).toBe(200);
    expect(res.body.curtiu).toBe(false);
    expect(res.body.totalLikes).toBe(6);
  });
});

describe('POST /api/treinamentos-internos/videos/:id/comentarios', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria comentário com userNome do auth', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{
        id: 'c-1',
        userEmail: 'warley@cortex.com',
        userNome: 'Warley Pablo',
        conteudo: 'massa demais',
        createdAt: '2026-04-29T12:00:00Z',
      }],
    });

    const res = await request(buildApp('warley@cortex.com', 'Warley Pablo'))
      .post('/api/treinamentos-internos/videos/vid-1/comentarios')
      .send({ conteudo: 'massa demais' });

    expect(res.status).toBe(201);
    expect(res.body.userNome).toBe('Warley Pablo');
    expect(res.body.isOwner).toBe(true);
  });

  it('rejeita conteúdo vazio', async () => {
    const res = await request(buildApp())
      .post('/api/treinamentos-internos/videos/vid-1/comentarios')
      .send({ conteudo: '' });

    expect(res.status).toBe(400);
  });

  it('rejeita conteúdo > 5000 chars', async () => {
    const res = await request(buildApp())
      .post('/api/treinamentos-internos/videos/vid-1/comentarios')
      .send({ conteudo: 'x'.repeat(5001) });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/treinamentos-internos/comentarios/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('apaga comentário do próprio usuário', async () => {
    // SELECT do comentário: userEmail bate
    mockExecute.mockResolvedValueOnce({
      rows: [{ user_email: 'warley@cortex.com' }],
    });
    // DELETE
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp('warley@cortex.com')).delete('/api/treinamentos-internos/comentarios/c-1');

    expect(res.status).toBe(200);
  });

  it('retorna 403 ao tentar apagar comentário de outro', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [{ user_email: 'outro@cortex.com' }],
    });

    const res = await request(buildApp('warley@cortex.com')).delete('/api/treinamentos-internos/comentarios/c-1');

    expect(res.status).toBe(403);
  });

  it('retorna 404 se comentário não existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });

    const res = await request(buildApp()).delete('/api/treinamentos-internos/comentarios/inexistente');

    expect(res.status).toBe(404);
  });
});
