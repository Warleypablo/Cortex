export const AGING_FAIXAS = ["0-30d", "30-90d", "90-180d", "180-365d", "+365d"] as const;

export function agingBucket(idadeDias: number): string {
  if (idadeDias < 30) return "0-30d";
  if (idadeDias < 90) return "30-90d";
  if (idadeDias < 180) return "90-180d";
  if (idadeDias < 365) return "180-365d";
  return "+365d";
}

export function groupAging(
  rows: { idadeDias: number; valor: number }[],
): { faixa: string; qtd: number; valor: number }[] {
  const map = new Map<string, { qtd: number; valor: number }>();
  for (const f of AGING_FAIXAS) map.set(f, { qtd: 0, valor: 0 });
  for (const r of rows) {
    const e = map.get(agingBucket(r.idadeDias))!;
    e.qtd += 1;
    e.valor += r.valor;
  }
  return AGING_FAIXAS.map((f) => ({ faixa: f, qtd: map.get(f)!.qtd, valor: map.get(f)!.valor }));
}
