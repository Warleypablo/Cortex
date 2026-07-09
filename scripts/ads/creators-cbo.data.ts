/**
 * Inventário compartilhado do lote "Captação Creators - Ismael/João" (CBO).
 * Usado pelos 3 passos (planilha → upload → ads).
 *
 * single-format: cada criativo é UM vídeo 9x16 (mesma pegada do lote summit-cjo).
 * Sobe pro Gerenciador com título `${base}_9x16` (convenção do match estrito).
 *
 * Estrutura acordada com o Caio (09/jul):
 *   Ismael → 1 conjunto, 3 ads (h1/h2/h3)
 *   João   → 1 conjunto, 3 ads (h1/h2/h3)
 *   Campanha CBO NOVA (orçamento na campanha), R$30/dia, tudo PAUSED.
 *   Objetivo/otimização/pixel clonados das outras Creators (OFFSITE_CONVERSIONS · pixel 1375902709765726).
 *   Link = página nova (creators-turbo.lovable.app). UTM = padrão dos ads atuais.
 *   ÚNICO campo a preencher antes de subir os ads: COPY (ver abaixo).
 */

export interface CreativeItem {
  base: string; // título-base no Meta (sobe como `${base}_9x16`); vira nomeDrive na Biblioteca
  driveId: string; // ID do vídeo 9x16 no Google Drive
  order: number; // hook (1..3)
  persona: string; // rótulo p/ a Biblioteca (Ismael / João)
  drivePasta: string; // pasta de origem no Drive (rastreabilidade na observação)
}

export interface ConjGroup {
  key: string; // slug interno
  persona: string; // creator do conjunto
  matchToken: string; // substring ÚNICA p/ achar o conjunto já existente (idempotência)
  conjName: (nn: number) => string; // nome completo do conjunto quando é criado (recebe o NN)
  items: CreativeItem[];
}

const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const driveLink = link;

const mk = (persona: string, pasta: string, h: number, driveId: string): CreativeItem => ({
  base: `Captacao_Creators_${persona}_h${h}b1c1`,
  driveId,
  order: h,
  persona,
  drivePasta: pasta,
});

export const GROUPS: ConjGroup[] = [
  {
    key: "ismael",
    persona: "Ismael",
    matchToken: "[Ismael] - Captação Creators",
    conjName: (nn) =>
      `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [Ismael] - Captação Creators - h1 a h3 | b1 | c1`,
    items: [
      mk("Ismael", "Ismael / 1 - Prontos", 1, "1Qy-eR4wYa_9o3QDuZcqh3gt-X3R6TpjM"),
      mk("Ismael", "Ismael / 1 - Prontos", 2, "1aPONf-VJY9enSTW-1yFQJ0v-X5wUaj-i"),
      mk("Ismael", "Ismael / 1 - Prontos", 3, "1z_DmEDWurogAMnJ-Q3i4YRY8OslNOEl9"),
    ],
  },
  {
    key: "joao",
    persona: "João",
    matchToken: "[João] - Captação Creators",
    conjName: (nn) =>
      `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [João] - Captação Creators - h1 a h3 | b1 | c1`,
    items: [
      mk("João", "João / 1 - Prontos", 1, "1f2Y9U7vti-MKqnGLRl_yUPHpWS5cxs_c"),
      mk("João", "João / 1 - Prontos", 2, "1KJCfKKBW4eU7eefds9s-NFZ3xLToX2T6"),
      mk("João", "João / 1 - Prontos", 3, "140_YG-9g3QcGwHv6uM7VOB_dy7lyhvB6"),
    ],
  },
];

export const ALL_ITEMS: CreativeItem[] = GROUPS.flatMap((g) => g.items);

export const LOTE = "Captação Creators - Ismael/João (CBO R$30/dia)";
export const PRODUTO = "Creators";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";

// ───────────────────────── Campanha NOVA (CBO) ─────────────────────────
export const CAMP_NAME = "[TP] [Leads] [CBO] [Teste] [Creators] - Captação Ismael/João";
export const OBJECTIVE = "OUTCOME_LEADS"; // igual às outras Creators
export const DAILY_BUDGET_CENTS = 3000; // R$30,00/dia — CBO (orçamento na CAMPANHA, não no conjunto)
export const BID_STRATEGY = "LOWEST_COST_WITHOUT_CAP";
/** Conjunto-irmão de onde clonar targeting/otimização/pixel/attribution (Broad Creators — Teste de criativos). */
export const CLONE_ADSET = "120252947833910450";

// ───────────────────────── Copy / link / CTA / UTM ─────────────────────────
export const LINK = "https://creators-turbo.lovable.app"; // página NOVA (confirmada pelo Caio)
export const CTA = "LEARN_MORE"; // mesmo CTA dos ads Creators atuais
export const HEADLINE = ""; // título/headline opcional (vazio = sem headline)
/** UTM dos ads atuais — macros dinâmicas, não amarra em campanha. */
export const URL_TAGS =
  "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}-{{placement}}&utm_content={{ad.id}}";

/**
 * COPY — ÚNICO campo a preencher antes de subir os ads.
 * Copy é por FUNIL. Ismael e João são o mesmo funil (captação Creators), então por padrão
 * compartilham a MESMA copy (COPY). Se quiser copy diferente por creator, preencha COPY_ISMAEL / COPY_JOAO.
 */
export const COPY = ""; // ← PREENCHER (copy compartilhada dos 6 ads)
export const COPY_ISMAEL = ""; // ← opcional (override só do Ismael); vazio = usa COPY
export const COPY_JOAO = ""; // ← opcional (override só do João); vazio = usa COPY

export function resolveCopy(persona: string): string {
  if (persona === "Ismael" && COPY_ISMAEL.trim()) return COPY_ISMAEL;
  if (persona === "João" && COPY_JOAO.trim()) return COPY_JOAO;
  return COPY;
}

/** título do vídeo no Gerenciador (chave do match estrito). single-format → só 9x16. */
export const metaTitle = (base: string) => `${base}_9x16`;
