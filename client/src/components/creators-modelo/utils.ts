// client/src/components/creators-modelo/utils.ts
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** Rótulo legível dos estados. */
export const ESTADO_LABEL: Record<string, string> = {
  ativo: "Ativo", cancelado: "Cancelado", total: "Total",
  em_producao: "Em produção", concluido: "Concluído",
};
