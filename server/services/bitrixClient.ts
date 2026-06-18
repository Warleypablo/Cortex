/**
 * Bitrix REST client (webhook) — helper compartilhado.
 *
 * O Cortex historicamente só fazia crm.deal.update inline (server/index.ts,
 * server/routes/contratos.ts). Aqui centralizamos e adicionamos crm.deal.add,
 * usado pelo CRM Instagram quando um prospect é promovido a "Negócio".
 */

export type BitrixDealFields = Record<string, string | number | undefined>;

function webhook(): string {
  const url = process.env.BITRIX_WEBHOOK_URL;
  if (!url) throw new Error("BITRIX_WEBHOOK_URL não configurada");
  return url.replace(/\/$/, "");
}

/** Cria um deal no Bitrix. Retorna o ID numérico do deal criado. */
export async function bitrixDealAdd(fields: BitrixDealFields): Promise<number> {
  // Remove campos undefined pra não sobrescrever com vazio
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== "") clean[k] = v;
  }

  const res = await fetch(`${webhook()}/crm.deal.add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: clean, params: { REGISTER_SONET_EVENT: "Y" } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(`crm.deal.add falhou: ${data.error_description || data.error || res.status}`);
  }
  const id = Number(data.result);
  if (!id || isNaN(id)) throw new Error("crm.deal.add não retornou ID válido");
  return id;
}

/**
 * Resolve um usuário Bitrix pelo e-mail. Retorna o ID numérico ou null.
 * Best-effort: e-mail do nosso auth pode não bater com o do Bitrix.
 */
export async function bitrixFindUserIdByEmail(email: string | null | undefined): Promise<number | null> {
  if (!email) return null;
  try {
    const res = await fetch(`${webhook()}/user.get?FILTER[EMAIL]=${encodeURIComponent(email)}&FILTER[ACTIVE]=true`);
    const data = await res.json().catch(() => ({}));
    const id = Number(data?.result?.[0]?.ID);
    return id && !isNaN(id) ? id : null;
  } catch {
    return null;
  }
}

/** Atualiza campos de um deal existente. */
export async function bitrixDealUpdate(dealId: number, fields: BitrixDealFields): Promise<boolean> {
  const res = await fetch(`${webhook()}/crm.deal.update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: dealId, fields }),
  });
  const data = await res.json().catch(() => ({}));
  return res.ok && !!data.result;
}
