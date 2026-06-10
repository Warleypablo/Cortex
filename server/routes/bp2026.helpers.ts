export interface MesValor {
  mes: number;
  orcado: number;
  realizado: number | null;
}

export type TipoAgregacao = "fluxo" | "estoque";

export function calcAtingimento(orcado: number, realizado: number | null): number | null {
  if (realizado === null || !orcado) return null;
  return realizado / orcado;
}

export function calcYtd(
  meses: MesValor[],
  mesAte: number,
  tipo: TipoAgregacao
): { orcado: number; realizado: number | null } {
  const ate = meses.filter((m) => m.mes <= mesAte);
  if (tipo === "estoque") {
    const orcado = ate.length ? ate[ate.length - 1].orcado : 0;
    const comDado = ate.filter((m) => m.realizado !== null);
    const realizado = comDado.length ? comDado[comDado.length - 1].realizado : null;
    return { orcado, realizado };
  }
  const orcado = ate.reduce((s, m) => s + m.orcado, 0);
  const comDado = ate.filter((m) => m.realizado !== null);
  const realizado = comDado.length
    ? comDado.reduce((s, m) => s + (m.realizado ?? 0), 0)
    : null;
  return { orcado, realizado };
}

export function ultimoDiaDoMes(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 0));
  return d.toISOString().slice(0, 10);
}
