import sgMail from '@sendgrid/mail';

export interface SendParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendResult {
  messageId: string;
}

export class SendGridError extends Error {
  constructor(
    public status: number,
    public body: any,
    message: string,
  ) {
    super(message);
    this.name = 'SendGridError';
  }
}

let apiKeyConfigured = false;

function ensureConfig(): void {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY não configurada');
  }
  if (!process.env.SENDGRID_FROM_EMAIL) {
    throw new Error('SENDGRID_FROM_EMAIL não configurada');
  }
  if (!process.env.SENDGRID_FROM_NAME) {
    throw new Error('SENDGRID_FROM_NAME não configurada');
  }
  if (!process.env.SENDGRID_BCC_EMAIL) {
    throw new Error('SENDGRID_BCC_EMAIL não configurada');
  }
  if (!apiKeyConfigured) {
    sgMail.setApiKey(apiKey);
    apiKeyConfigured = true;
  }
}

export async function sendNotificacaoExtrajudicial(
  params: SendParams,
): Promise<SendResult> {
  ensureConfig();

  const msg = {
    to: params.to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL!,
      name: process.env.SENDGRID_FROM_NAME!,
    },
    replyTo: process.env.SENDGRID_FROM_EMAIL!,
    bcc: process.env.SENDGRID_BCC_EMAIL!,
    subject: params.subject,
    text: params.text,
    html: params.html,
  };

  try {
    const [response] = await sgMail.send(msg as any);
    const messageId = response.headers['x-message-id'] as string | undefined;
    if (!messageId) {
      throw new SendGridError(
        response.statusCode ?? 0,
        response,
        'SendGrid não retornou x-message-id',
      );
    }
    return { messageId };
  } catch (err: any) {
    if (err instanceof SendGridError) throw err;
    const status = err.code ?? err.response?.statusCode ?? 0;
    const body = err.response?.body ?? { message: err.message };
    throw new SendGridError(status, body, err.message ?? 'Falha no envio SendGrid');
  }
}
