export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar ${url}`);
  return res.json();
}

export function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, v);
  });
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

import type { Jornada } from "./types";

export interface Cancelamento {
  produto: string;
  nomeCliente: string | null;
  nivel: number;
  valorp: number;
  motivo: string | null;
  squad: string | null;
  responsavel: string | null;
  cs: string | null;
  vendedor: string | null;
  dataEncerramento: string | null;
}

/** Achata as jornadas em cancelamentos por contrato/entrega (situação churn). */
export function cancelamentosDe(jornadas: Jornada[]): Cancelamento[] {
  const out: Cancelamento[] = [];
  for (const j of jornadas) {
    for (const e of j.entregas) {
      if (e.situacao !== "churn") continue;
      out.push({
        produto: j.produto, nomeCliente: j.nomeCliente, nivel: e.nivel, valorp: e.valorp,
        motivo: e.motivoCancelamento, squad: j.squad, responsavel: j.responsavel,
        cs: j.csResponsavel, vendedor: j.vendedor, dataEncerramento: e.dataEncerramento,
      });
    }
  }
  return out;
}

export const rotuloDim = (v: string | null) => {
  const t = (v ?? "").trim();
  return t === "" ? "(não informado)" : t;
};
