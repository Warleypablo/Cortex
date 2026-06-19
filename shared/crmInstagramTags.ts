/**
 * CRM Instagram — taxonomia de qualificação de leads.
 * Fonte única compartilhada entre server (filtro/validação) e client (UI).
 */

export const QUALIFICATION_TAGS = [
  "colaborador",
  "empresario",
  "creator",
  "influenciadora",
  "talento",
  "desqualificado",
] as const;

export type QualificationTag = (typeof QUALIFICATION_TAGS)[number];

// Tags que removem o lead do Pipeline (efeito blocklist). Continuam visíveis
// na aba Qualificação pra mapeamento/contato futuro.
export const BLOCKING_TAGS: QualificationTag[] = [
  "colaborador",
  "creator",
  "influenciadora",
  "talento",
  "desqualificado",
];

export const TAG_LABELS: Record<QualificationTag, string> = {
  colaborador: "Colaborador",
  empresario: "Empresário",
  creator: "Creator",
  influenciadora: "Influenciadora",
  talento: "Talento",
  desqualificado: "Desqualificado",
};

export function isQualificationTag(v: unknown): v is QualificationTag {
  return typeof v === "string" && (QUALIFICATION_TAGS as readonly string[]).includes(v);
}
