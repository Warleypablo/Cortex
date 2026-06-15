// De-para do campo UF_CRM_1755009751812 (Bitrix) -> segmento do BP.
// Decodificado da API Bitrix (crm.deal.userfield.list) em 2026-06-15.
export type Natureza = "recorrente" | "pontual";
export type SegmentoBP =
  | "Performance" | "Creators" | "Social" | "Gestão de Comunidade"
  | "E-commerce" | "Site Institucional" | "Landing Page" | "CRM" | "Others";

export interface ServicoBitrix { id: number; nome: string; natureza: Natureza; segmento: SegmentoBP; }

export const SERVICOS_BITRIX: Record<number, ServicoBitrix> = {
  846: { id: 846, nome: "Gestão de Performance", natureza: "recorrente", segmento: "Performance" },
  852: { id: 852, nome: "Creators Recorrente", natureza: "recorrente", segmento: "Creators" },
  848: { id: 848, nome: "Social Media", natureza: "recorrente", segmento: "Social" },
  870: { id: 870, nome: "Gestão de Comunidade", natureza: "recorrente", segmento: "Gestão de Comunidade" },
  876: { id: 876, nome: "Personalizado Recorrente", natureza: "recorrente", segmento: "Others" },
  858: { id: 858, nome: "Sustentação", natureza: "recorrente", segmento: "Others" },
  860: { id: 860, nome: "E-mail Marketing", natureza: "recorrente", segmento: "Others" },
  854: { id: 854, nome: "CRM", natureza: "pontual", segmento: "CRM" },
  878: { id: 878, nome: "SEO Full", natureza: "recorrente", segmento: "Others" },
  1678: { id: 1678, nome: "Turbooh", natureza: "recorrente", segmento: "Others" },
  864: { id: 864, nome: "Automação", natureza: "recorrente", segmento: "Others" },
  866: { id: 866, nome: "Blog Post", natureza: "recorrente", segmento: "Others" },
  884: { id: 884, nome: "Agente de IA", natureza: "recorrente", segmento: "Others" },
  868: { id: 868, nome: "E-commerce", natureza: "pontual", segmento: "E-commerce" },
  880: { id: 880, nome: "Site Institucional", natureza: "pontual", segmento: "Site Institucional" },
  882: { id: 882, nome: "Landing Page", natureza: "pontual", segmento: "Landing Page" },
  850: { id: 850, nome: "Creators Pontual", natureza: "pontual", segmento: "Creators" },
  856: { id: 856, nome: "CRO Pontual", natureza: "pontual", segmento: "Others" },
  874: { id: 874, nome: "Personalizado Pontual", natureza: "pontual", segmento: "Others" },
  1684: { id: 1684, nome: "TikTok Shop", natureza: "pontual", segmento: "Others" },
  872: { id: 872, nome: "Identidade Visual", natureza: "pontual", segmento: "Others" },
  862: { id: 862, nome: "Estruturação Estratégica", natureza: "pontual", segmento: "Others" },
  1774: { id: 1774, nome: "Estruturação Comercial", natureza: "pontual", segmento: "Others" },
  1778: { id: 1778, nome: "Estruturação estratégica", natureza: "pontual", segmento: "Others" },
  1674: { id: 1674, nome: "Fee de Implantação", natureza: "pontual", segmento: "Others" },
};

export const SEGMENTOS_RECORRENTES: SegmentoBP[] = ["Performance", "Creators", "Social", "Gestão de Comunidade", "Others"];
export const SEGMENTOS_PONTUAIS: SegmentoBP[] = ["E-commerce", "Site Institucional", "Landing Page", "Creators", "CRM", "Others"];

// Parse "[846, 852]" / "False" / "[]" / null -> number[]
export function parseServicosVendidos(raw: string | null | undefined): number[] {
  if (!raw || raw === "False" || raw === "[]") return [];
  return raw.replace(/[[\] ]/g, "").split(",").filter(Boolean).map(Number).filter((n) => !Number.isNaN(n));
}

// Segmentos distintos presentes no deal, por natureza.
export function segmentosPorNatureza(ids: number[]): { recorrente: SegmentoBP[]; pontual: SegmentoBP[] } {
  const rec = new Set<SegmentoBP>();
  const pont = new Set<SegmentoBP>();
  for (const id of ids) {
    const s = SERVICOS_BITRIX[id];
    if (!s) continue;
    (s.natureza === "recorrente" ? rec : pont).add(s.segmento);
  }
  return { recorrente: Array.from(rec), pontual: Array.from(pont) };
}
