export interface CommerceTarget {
  key: string;
  label: string;
  target: number;
  unit: "BRL" | "PCT";
  subLabel?: string;
}

export interface QuarterTargets {
  label: string;
  items: CommerceTarget[];
}

export const TURBO_COMMERCE_TARGETS: Record<string, QuarterTargets> = {
  "Q1_2026": {
    label: "OKR 1° Tri",
    items: [
      { key: "mrr_commerce", label: "MRR Commerce", target: 1368000, unit: "BRL" },
      { key: "pontual_tech", label: "Pontual Tech Entregue", target: 450000, unit: "BRL" },
      { key: "venda_mrr", label: "Venda MRR", target: 645000, unit: "BRL", subLabel: "Venda Monetização MRR: R$45k" },
      { key: "churn", label: "Churn", target: 8, unit: "PCT", subLabel: "R$311.363" },
      { key: "pontual_commerce", label: "Pontual Commerce Entregue", target: 455000, unit: "BRL" },
      { key: "inadimplencia", label: "Inadimplência", target: 6, unit: "PCT", subLabel: "R$281.000" },
      { key: "venda_pontual", label: "Venda Pontual", target: 810000, unit: "BRL", subLabel: "Venda Monetização Pontual: R$60k" },
    ],
  },
};

export function getQuarterKey(ano: number, mes: number): string {
  const q = Math.ceil(mes / 3);
  return `Q${q}_${ano}`;
}
