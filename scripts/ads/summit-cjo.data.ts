/**
 * Inventário compartilhado do lote "5 - Creators Summit - Camila/Jaque + Quebra de Objeções".
 * Usado pelos 3 passos (planilha → upload → ads).
 *
 * IMPORTANTE: single-format. Cada criativo é UM vídeo 9x16 (corte final "Editado", vertical).
 * Difere dos lotes anteriores (Victor/Lucas/Esther) que vinham PAREADOS 9x16+4x5.
 * O vídeo sobe pro Gerenciador com título `${base}_9x16` (convenção do match estrito),
 * e o ad é SINGLE_VIDEO (sem asset_customization_rules de pareamento).
 *
 * Estrutura acordada com o Caio (07/09):
 *   18 [Camila]              → 4 ads (h01–h04)
 *   19 [Jaque]               → 4 ads (h01–h04)
 *   20 [Quebra de Objeções]  → 6 ads (CAIXA 01–06, CTA 01)
 *   21 [Quebra de Objeções]  → 6 ads (CAIXA 01–06, CTA 02)
 */

export interface CreativeItem {
  base: string; // título-base no Meta (sobe como `${base}_9x16`); vira nomeDrive na Biblioteca
  driveId: string; // ID do vídeo 9x16 no Google Drive
  order: number; // ordem dentro do conjunto (hook p/ creators, caixa p/ objeções)
  persona: string; // rótulo p/ a Biblioteca (Camila / Jaque / Quebra de Objeções)
  drivePasta: string; // pasta de origem no Drive (rastreabilidade na observação)
}

export interface ConjGroup {
  key: string; // slug interno
  matchToken: string; // substring ÚNICA p/ achar o conjunto já existente (idempotência)
  conjName: (nn: number) => string; // nome completo do conjunto quando é criado (recebe o NN)
  items: CreativeItem[];
}

const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const driveLink = link;

const cam = (h: number, driveId: string): CreativeItem => ({
  base: `Summit_Creator_Camila_h${h}b1c1`,
  driveId,
  order: h,
  persona: "Camila",
  drivePasta: "Camila Silva / Editado",
});
const jaq = (h: number, driveId: string): CreativeItem => ({
  base: `Summit_Creator_Jaque_h${h}b1c1`,
  driveId,
  order: h,
  persona: "Jaque",
  drivePasta: "Jaqueline / Editado",
});
const obj = (caixa: number, cta: number, driveId: string): CreativeItem => ({
  base: `Summit_QuebraObjecoes_caixa${String(caixa).padStart(2, "0")}_cta${String(cta).padStart(2, "0")}`,
  driveId,
  order: caixa,
  persona: "Quebra de Objeções",
  drivePasta: `TURBO_quebradeobjecoes / COMPLETOS (CAIXA) / CAIXA ${String(caixa).padStart(2, "0")}`,
});

export const GROUPS: ConjGroup[] = [
  {
    key: "camila",
    matchToken: "[Camila] - Creators Summit Creator",
    conjName: (nn) =>
      `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [Camila] - Creators Summit Creator - h01 a h04 | b1 | c1`,
    items: [
      cam(1, "1sBmFzogWXfuMOTNKtgZ9HbGHJGO7nPET"),
      cam(2, "1QdI6sb8lp0v-rAJv_awg_o5pLWHw-uMd"),
      cam(3, "1dDUeDAY02pJ8-tHWPTkDix6LVRSiUC9F"),
      cam(4, "1uoaatqnNf4hGKZD_U7V_0KP6EAp9pT8i"),
    ],
  },
  {
    key: "jaque",
    matchToken: "[Jaque] - Creators Summit Creator",
    conjName: (nn) =>
      `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [Jaque] - Creators Summit Creator - h01 a h04 | b1 | c1`,
    items: [
      jaq(1, "1NgH14fNxvcuIparx_5fOZXHKG4BjRacK"),
      jaq(2, "12UmjVMEojzJtmsXv4pDcAaYVE4mW9Wu9"),
      jaq(3, "1nmocL5rhSdsG9mU6uct2kfkg171rcuxr"),
      jaq(4, "1DnGjHqltzlqcvH723rXJoFPpBEcrDsY9"),
    ],
  },
  {
    key: "obj_cta01",
    matchToken: "[Quebra de Objeções] - Creators Summit - CTA 01",
    conjName: (nn) =>
      `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [Quebra de Objeções] - Creators Summit - CTA 01 | caixas 01-06`,
    items: [
      obj(1, 1, "1geAd00r6cBTlwivf-gt0G_pXLi5NC24k"),
      obj(2, 1, "1Wn6EblLSU-eAOTWMNXQy5X3-yw2LJTYm"),
      obj(3, 1, "1XNk9Z9OzL4_N8a-ZZAESHdOQUHU562ka"),
      obj(4, 1, "1S1puUvK03qSfRwJSwAW2hDm-3E02dloy"),
      obj(5, 1, "1GE7BoofUu_bG21P88NeDjTdW9yhwKfa9"),
      obj(6, 1, "1bM-bSeTmN7GjKOCcR1IXWo7amcad8kFT"),
    ],
  },
  {
    key: "obj_cta02",
    matchToken: "[Quebra de Objeções] - Creators Summit - CTA 02",
    conjName: (nn) =>
      `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [Quebra de Objeções] - Creators Summit - CTA 02 | caixas 01-06`,
    items: [
      obj(1, 2, "12pvnxP2jL6EVL97mqXCezsfCLNVlFr2R"),
      obj(2, 2, "1fZxj3NwxblY_rGYCNd8Tugd9SFGS-vdM"),
      obj(3, 2, "1_-vsPdS3VJCwNyV4J43ibqCnAoa6L0Ou"),
      obj(4, 2, "1ziz-_WrThlVTy7QOUaUm3bvO2Vlj1PQ2"),
      obj(5, 2, "1OYbXI-b3IWRy5hw4cKrXgLwcWm3ZS3yF"),
      obj(6, 2, "1YWtJNm4pqjAkwU803ZR4XKlC2rXPmPTm"),
    ],
  },
];

export const ALL_ITEMS: CreativeItem[] = GROUPS.flatMap((g) => g.items);

export const LOTE = "5 - Creators Summit - Camila/Jaque + Quebra de Objeções";
export const CAMP = "120251818147660450"; // [TP] [Vendas] [CBO] [Quente] [Summit] - Teste de criativos
export const CLONE_ADSET = "120252734035990450"; // conjunto 12 [Victor] Empresário (config + copy Summit IG-only)
export const PRODUTO = "Creators";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";

/** título do vídeo no Gerenciador (chave do match estrito). single-format → só 9x16. */
export const metaTitle = (base: string) => `${base}_9x16`;
