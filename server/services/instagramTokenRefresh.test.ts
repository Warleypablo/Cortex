import { describe, it, expect } from 'vitest';
import { classifyTokenStatus, buildExpiryAlert, refreshExpiringTokens, type RefreshConnection } from './instagramTokenRefresh';

describe('classifyTokenStatus', () => {
  const now = new Date('2026-06-26T12:00:00Z');
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  it('retorna "unknown" quando não há data de expiração', () => {
    expect(classifyTokenStatus(null, now)).toBe('unknown');
    expect(classifyTokenStatus(undefined, now)).toBe('unknown');
  });

  it('retorna "expired" quando a data de expiração já passou', () => {
    expect(classifyTokenStatus(new Date('2026-05-30T12:38:00Z'), now)).toBe('expired');
  });

  it('trata o instante exato da expiração como "expired"', () => {
    expect(classifyTokenStatus(new Date(now), now)).toBe('expired');
  });

  it('retorna "needs_refresh" quando expira dentro da janela (default 15 dias)', () => {
    expect(classifyTokenStatus(inDays(10), now)).toBe('needs_refresh');
  });

  it('inclui o limite da janela (exatamente 15 dias) como "needs_refresh"', () => {
    expect(classifyTokenStatus(inDays(15), now)).toBe('needs_refresh');
  });

  it('retorna "healthy" quando expira bem depois da janela', () => {
    expect(classifyTokenStatus(inDays(30), now)).toBe('healthy');
  });

  it('respeita uma janela customizada de renovação', () => {
    // expira em 10 dias, mas janela é de 7 → ainda saudável
    expect(classifyTokenStatus(inDays(10), now, 7)).toBe('healthy');
    expect(classifyTokenStatus(inDays(5), now, 7)).toBe('needs_refresh');
  });
});

describe('buildExpiryAlert', () => {
  const base = {
    connectionId: 2,
    username: 'turbo.partners',
    clienteCnpj: '42100292000184',
    today: '2026-06-26',
  };

  it('token expirado → notificação high priority pedindo reconexão', () => {
    const n = buildExpiryAlert({ ...base, reason: 'expired' });
    expect(n.type).toBe('instagram_token_expired');
    expect(n.priority).toBe('high');
    expect(n.entityId).toBe('2');
    expect(n.entityType).toBe('instagram_connection');
    expect(n.title).toContain('turbo.partners');
    expect(n.message?.toLowerCase()).toContain('reconect');
  });

  it('falha ao renovar → tipo próprio e inclui o detalhe do erro na mensagem', () => {
    const n = buildExpiryAlert({
      ...base,
      reason: 'refresh_failed',
      detail: 'Graph API error: invalid token (code 190)',
    });
    expect(n.type).toBe('instagram_token_refresh_failed');
    expect(n.priority).toBe('high');
    expect(n.message).toContain('code 190');
  });

  it('uniqueKey é diário (dedup por conexão/dia) e varia por motivo', () => {
    const expired = buildExpiryAlert({ ...base, reason: 'expired' });
    const failed = buildExpiryAlert({ ...base, reason: 'refresh_failed' });
    expect(expired.uniqueKey).toBe('ig-token-expired-2-2026-06-26');
    expect(failed.uniqueKey).toBe('ig-token-refresh-failed-2-2026-06-26');
    // mesmo motivo + mesmo dia + mesma conexão → mesma chave (não duplica)
    expect(buildExpiryAlert({ ...base, reason: 'expired' }).uniqueKey).toBe(expired.uniqueKey);
  });
});

describe('refreshExpiringTokens', () => {
  const now = new Date('2026-06-26T12:00:00Z');
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
  const SIXTY_DAYS_S = 60 * 24 * 60 * 60;

  function makeDeps(connections: RefreshConnection[]) {
    const persisted: Array<{ id: number; newEnc: string; newExpiresAt: Date }> = [];
    const refreshCalledWith: string[] = [];
    return {
      persisted,
      refreshCalledWith,
      deps: {
        now,
        connections,
        decrypt: (enc: string) => enc.replace('enc:', ''),
        encrypt: (plain: string) => `enc:${plain}`,
        refresh: async (token: string) => {
          refreshCalledWith.push(token);
          return { accessToken: 'NEW_TOKEN', expiresIn: SIXTY_DAYS_S };
        },
        persist: async (id: number, newEnc: string, newExpiresAt: Date) => {
          persisted.push({ id, newEnc, newExpiresAt });
        },
      },
    };
  }

  const conn = (over: Partial<RefreshConnection>): RefreshConnection => ({
    id: 1, username: 'acme', clienteCnpj: '000', accessTokenEnc: 'enc:TOKEN', tokenExpiresAt: null, ...over,
  });

  it('token saudável: não renova nem alerta', async () => {
    const { deps, persisted } = makeDeps([conn({ id: 10, tokenExpiresAt: inDays(40) })]);
    const r = await refreshExpiringTokens(deps);
    expect(r.healthy).toBe(1);
    expect(r.refreshed).toEqual([]);
    expect(r.alerts).toEqual([]);
    expect(persisted).toEqual([]);
  });

  it('precisa renovar + sucesso: persiste novo token e nova validade (+60d), sem alerta', async () => {
    const { deps, persisted, refreshCalledWith } = makeDeps([conn({ id: 7, tokenExpiresAt: inDays(5) })]);
    const r = await refreshExpiringTokens(deps);
    expect(refreshCalledWith).toEqual(['TOKEN']);       // decriptou antes de renovar
    expect(r.refreshed).toEqual([7]);
    expect(r.alerts).toEqual([]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe(7);
    expect(persisted[0].newEnc).toBe('enc:NEW_TOKEN');  // re-encriptou o token novo
    expect(persisted[0].newExpiresAt.getTime()).toBe(now.getTime() + SIXTY_DAYS_S * 1000);
  });

  it('precisa renovar + falha: emite alerta refresh_failed com o detalhe do erro e NÃO persiste', async () => {
    const { deps, persisted } = makeDeps([conn({ id: 7, tokenExpiresAt: inDays(5) })]);
    deps.refresh = async () => { throw new Error('boom 190'); };
    const r = await refreshExpiringTokens(deps);
    expect(r.refreshed).toEqual([]);
    expect(persisted).toEqual([]);
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].reason).toBe('refresh_failed');
    expect(r.alerts[0].detail).toContain('boom 190');
    expect(r.alerts[0].today).toBe('2026-06-26');
  });

  it('token expirado: alerta de reconexão e NÃO tenta renovar (API não permite renovar expirado)', async () => {
    const { deps, refreshCalledWith } = makeDeps([conn({ id: 3, tokenExpiresAt: inDays(-10) })]);
    const r = await refreshExpiringTokens(deps);
    expect(refreshCalledWith).toEqual([]);              // não chamou refresh
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].reason).toBe('expired');
    expect(r.alerts[0].connectionId).toBe(3);
  });

  it('sem data de expiração: conta como unknown, sem renovar nem alertar', async () => {
    const { deps } = makeDeps([conn({ id: 1, tokenExpiresAt: null })]);
    const r = await refreshExpiringTokens(deps);
    expect(r.unknown).toBe(1);
    expect(r.refreshed).toEqual([]);
    expect(r.alerts).toEqual([]);
  });
});
