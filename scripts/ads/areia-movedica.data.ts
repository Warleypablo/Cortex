/**
 * Inventário do lote "Areia Movediça" (Victor Peixoto) — funil Creators.
 * Usado pelos 3 passos (planilha → upload → ads).
 *
 * SINGLE-FORMAT: cada criativo é UM vídeo 9x16 (mesma pegada do lote Ismael/João).
 * Sobe pro Gerenciador como `${base}_9x16`. 1 body, 12 hooks = 12 criativos.
 *
 * Estrutura acordada (10/jul): sobe na campanha de TESTE CBO Creators JÁ EXISTENTE
 * (`120249141209100450`, PAUSED) — não cria campanha, só adiciona conjuntos.
 * 3 conjuntos por faixa de hook (≤5 ads). Config + COPY clonados de um conjunto irmão do funil.
 */

export interface Item { base: string; hook: number; driveId: string; }
const mk = (hook: number, driveId: string): Item => ({ base: `AreiaMov_Peixoto_h${hook}b1c1`, hook, driveId });

export const ITEMS: Item[] = [
  mk(1, "1RwCgDrrC0ef2HYAtyV2z0j64J19NrOaQ"),
  mk(2, "1h8OpSL46_E0jcwwIg2OQSqdjLPF-wie3"),
  mk(3, "1ica_KES58BLFgdy6wW-odhqjbyvMMGgo"),
  mk(4, "1VH-01H7JsHwriIc2li_ptnzh-e0R0YeB"),
  mk(5, "1V9MMhx78m4q2xvfSthFYh-w8EqhSqeg_"),
  mk(6, "1raGbo75FMVheaXEb1wBCZ_tNryASXGVF"),
  mk(7, "1tQvI8tf8kmR6JvmzZXs-JxNS9o0UFZBW"),
  mk(8, "1oD8snkFBGA8HXv9fVl40iDN8_DkUXlEz"),
  mk(9, "1QKxbqkIWkM-_Wex72iVIzmke2BdaiSeO"),
  mk(10, "1RJ-aVlDQpFKhb-AqEadPqvbn2uCFDh56"),
  mk(11, "1NXdqZIhdNpoYu5UnISz5u8M_MHS_JQWQ"),
  mk(12, "1TtdmdxLkN6Kx_wV7Zx5wnQFjCVEwG0J6"),
];

export const LOTE = "Areia Movediça - Peixoto (Creators)";
export const PRODUTO = "Creators";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Peixoto";
export const TEMA = "Areia Movediça";

// ─────────── Campanha (JÁ EXISTE, CBO, PAUSED — não criar, só adicionar conjuntos) ───────────
export const CAMPAIGN = "120249141209100450"; // [CBO] [Broad] [Creators] - Teste de criativos
export const CLONE_ADSET = "120252947833910450"; // conjunto 173 Broad Creators — clona config + COPY do funil
export const NN_FLOOR = 0; // usa o maior NN existente na campanha

// ─────────── Split: 3 conjuntos por faixa de hook (≤5 ads) ───────────
export interface Group { key: string; hookMin: number; hookMax: number; matchToken: string; }
export const GROUPS: Group[] = [
  { key: "h01_05", hookMin: 1, hookMax: 5, matchToken: `${TEMA} - h01 a h05` },
  { key: "h06_10", hookMin: 6, hookMax: 10, matchToken: `${TEMA} - h06 a h10` },
  { key: "h11_12", hookMin: 11, hookMax: 12, matchToken: `${TEMA} - h11 a h12` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b1 | c1`;
};

export const metaTitle = (base: string) => `${base}_9x16`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
