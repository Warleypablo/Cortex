// De-para do campo `produto` de "Clickup".cup_contratos -> segmento do BP.
// Default (produto não listado, incl. "(sem produto)" e produtos futuros): "Others".
// Julgamentos marcados [REVISAR] no design (docs/plans/2026-06-17-bp2026-vendas-produto-design.md).
import type { SegmentoBP } from "../okr2026/servicosBitrix";

export const PRODUTO_PARA_SEGMENTO: Record<string, SegmentoBP> = {
  // Recorrente (MRR)
  "Performance": "Performance",
  "Consultoria de Performance": "Performance",
  "Gameplan": "Performance",            // serviços "Gameplan (Performance)" / "Fee implantação (Performance)" [REVISAR]
  "Creators": "Creators",
  "Social Media": "Social",
  "Blog Post": "Social",                // [REVISAR] (alt.: Others)
  "Gestão de Comunidade": "Gestão de Comunidade",
  "Gestão & Atendimento": "Gestão de Comunidade", // [REVISAR]
  // Pontual
  "Ecommerce": "E-commerce",
  "TikTok Shop": "E-commerce",          // [REVISAR]
  "CRO & Alteração": "E-commerce",      // serviços Shopify/checkout [REVISAR] (alt.: Others)
  "Site": "Site Institucional",
  "Landing Page": "Landing Page",
  "CRM de Vendas": "CRM",
  "Régua de Automação": "CRM",          // régua e-mail/WhatsApp [REVISAR]
  // Others (explícitos para clareza; também cairiam no default)
  "Broadcast": "Others",                // e-mail mkt/Reportana, MRR-heavy, sem bucket CRM no recorrente [REVISAR]
  "Sustentação": "Others",              // manutenção site/ecommerce, MRR [REVISAR]
  "Estruturação Comercial": "Others",
  "Estruturação Estratégica": "Others",
  "ID Visual": "Others",
  "Pacote Artes / Rótulos": "Others",
  "SEO Full": "Others",                 // [REVISAR] (alt.: Performance)
  "Agente IA": "Others",                // [REVISAR] (alt.: CRM)
  "Fee de implantação": "Others",
  "Dashboard": "Others",
  "Account Management": "Others",
};

export function segmentoDeProduto(produto: string | null | undefined): SegmentoBP {
  const key = (produto ?? "").trim();
  return PRODUTO_PARA_SEGMENTO[key] ?? "Others";
}
