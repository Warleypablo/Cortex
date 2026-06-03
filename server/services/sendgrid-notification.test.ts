import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de @sendgrid/mail antes do import do service
const mockSend = vi.fn();
const mockSetApiKey = vi.fn();

vi.mock('@sendgrid/mail', () => ({
  default: {
    send: (...args: any[]) => mockSend(...args),
    setApiKey: (...args: any[]) => mockSetApiKey(...args),
  },
}));

import { sendNotificacaoExtrajudicial, SendGridError } from './sendgrid-notification';

describe('sendNotificacaoExtrajudicial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENDGRID_API_KEY = 'SG.test_key';
    process.env.SENDGRID_FROM_EMAIL = 'juridico@turbopartners.com.br';
    process.env.SENDGRID_FROM_NAME = 'Departamento Jurídico - Turbo Partners';
    process.env.SENDGRID_BCC_EMAIL = 'juridico@turbopartners.com.br';
  });

  it('monta payload correto (from, replyTo, bcc, subject, text, html)', async () => {
    mockSend.mockResolvedValue([
      { statusCode: 202, headers: { 'x-message-id': 'msg-abc-123' } },
    ]);

    await sendNotificacaoExtrajudicial({
      to: 'cliente@empresa.com',
      subject: 'Notificação Extrajudicial',
      text: 'Texto da notificação...',
      html: '<div>HTML</div>',
    });

    expect(mockSetApiKey).toHaveBeenCalledWith('SG.test_key');
    expect(mockSend).toHaveBeenCalledWith({
      to: 'cliente@empresa.com',
      from: {
        email: 'juridico@turbopartners.com.br',
        name: 'Departamento Jurídico - Turbo Partners',
      },
      replyTo: 'juridico@turbopartners.com.br',
      bcc: 'juridico@turbopartners.com.br',
      subject: 'Notificação Extrajudicial',
      text: 'Texto da notificação...',
      html: '<div>HTML</div>',
    });
  });

  it('retorna messageId do header x-message-id', async () => {
    mockSend.mockResolvedValue([
      { statusCode: 202, headers: { 'x-message-id': 'msg-abc-123' } },
    ]);

    const result = await sendNotificacaoExtrajudicial({
      to: 'cliente@empresa.com',
      subject: 'Sub',
      text: 'Text',
      html: '<p>HTML</p>',
    });

    expect(result.messageId).toBe('msg-abc-123');
  });

  it('lança SendGridError em 4xx', async () => {
    const error = Object.assign(new Error('Unauthorized'), {
      code: 401,
      response: { body: { errors: [{ message: 'API key inválida' }] } },
    });
    mockSend.mockRejectedValue(error);

    await expect(
      sendNotificacaoExtrajudicial({
        to: 'cliente@empresa.com',
        subject: 'Sub',
        text: 'Text',
        html: '<p>HTML</p>',
      })
    ).rejects.toBeInstanceOf(SendGridError);
  });

  it('lança SendGridError em 5xx', async () => {
    const error = Object.assign(new Error('Service Unavailable'), {
      code: 503,
      response: { body: 'Service down' },
    });
    mockSend.mockRejectedValue(error);

    await expect(
      sendNotificacaoExtrajudicial({
        to: 'cliente@empresa.com',
        subject: 'Sub',
        text: 'Text',
        html: '<p>HTML</p>',
      })
    ).rejects.toBeInstanceOf(SendGridError);
  });

  it('SendGridError expõe status e body para auditoria', async () => {
    const error = Object.assign(new Error('Unauthorized'), {
      code: 401,
      response: { body: { errors: [{ message: 'API key inválida' }] } },
    });
    mockSend.mockRejectedValue(error);

    try {
      await sendNotificacaoExtrajudicial({
        to: 'cliente@empresa.com',
        subject: 'Sub',
        text: 'Text',
        html: '<p>HTML</p>',
      });
    } catch (e) {
      expect(e).toBeInstanceOf(SendGridError);
      expect((e as SendGridError).status).toBe(401);
      expect((e as SendGridError).body).toEqual({
        errors: [{ message: 'API key inválida' }],
      });
    }
  });
});
