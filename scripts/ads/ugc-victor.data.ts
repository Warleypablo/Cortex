/**
 * Inventário do lote "UGC x Anúncios Tradicionais - Victor" — funil Creators.
 * PAREADO 9x16 (stories) + 4x5 (feed). 2 bodies × 10 hooks = 20 criativos = 40 vídeos.
 * Irmão da Esther/Lucas UGC (mesmo lote) → mesma campanha QUENTE Creators.
 */
export interface Pair { base: string; body: 1 | 2; hook: number; drive9x16: string; drive4x5: string; }
const mk = (body: 1 | 2, hook: number, drive9x16: string, drive4x5: string): Pair => ({ base: `UGCTrad_Victor_b${body}h${hook}`, body, hook, drive9x16, drive4x5 });

export const PAIRS: Pair[] = [
  mk(1, 1, "1Z4yXNaLmmCwPyDcuEPPaW1FHIcN3NaX2", "1YaY8jA08GjBTpxV3gA0subECO8K9oreE"),
  mk(1, 2, "16o1Qjfw9tks-dgovevzrnNUKyPr4cAGC", "1zvwCaKJ8HMhp_59R5Z5w6nIR5xSbLiqK"),
  mk(1, 3, "14bEL83uzXA9vJy1-WZqOSeJ1_Ehy3hOj", "1Ux1u7Cr8PkJI0vJDsZ1124PAny0h7eYb"),
  mk(1, 4, "159ipLyN_VV3P5Icj7vwhcg5Y1QP_X0II", "1t14vF1nbgjRMzhPrENocWeRJGeLPJ4T0"),
  mk(1, 5, "1HfDIrUjZsQfmGJFTFx1cS11JQUhp5oUs", "1xaUCd0K9sfpwnIieq1Q-2qTMGqL26xsC"),
  mk(1, 6, "1A6KCJgBNfj6EtKJMx1Eg5Vx9UjAC9eyU", "19DBcDlu4oPMGJY9avwPBm5sCiijdMN2b"),
  mk(1, 7, "1kwnH_mpWHtn308EJw1bGl1ZPNoqwNlAD", "1lPUFBZ7vaVjWzIrJiJsKobznk8zQcP9i"),
  mk(1, 8, "1_GZM7JkKMoFDNQ8fc0hfZCy4kAl9SVB5", "14cZ1FP8FQiaIjX0UNJEyvgL9eGmqIeGo"),
  mk(1, 9, "1GpkH9m3s5yqNFu8la3b9O3UzUzFhCmeZ", "1_728fjIflzigHvM66xUOts4uLhSsyfMF"),
  mk(1, 10, "1ZFcR3JEaKd_CSXEZ3NJk_WwXX3g_kULw", "1imWKN85pvO_HUsSagg83p5ryhKxvyBLQ"),
  mk(2, 1, "1r4XNwPdK-v-ByOMIaZkBYWtfFzc-X_qI", "1iU0P6TQpYzvRdK7uh8HjROe2cLHEoc5D"),
  mk(2, 2, "1eimQgtSpEoixxTo6FWPR2ycNsHX77ngp", "1cuPnc-iwlNX0Yd7WVObdO7iqmXbTPLEU"),
  mk(2, 3, "1-W4GnFjtlhZYcL2Zd0s3NZJ4WtdgBRkk", "1ohVT4xkboJqcRSCj-lsT6RsOZos8kxEF"),
  mk(2, 4, "1Wtgc91TmU9sME_QvhyaOfRbs1emCwECG", "1XJcO3uxmKWi4WAOpbHIJeJXa7C6uX32u"),
  mk(2, 5, "1EI9IVUlr-oKHgikTz39zfwvysR3nXUbQ", "1UWNjnAuJWZmANacLHZp-ywJs9idTGyXI"),
  mk(2, 6, "1UsZ5hkInRxaxcEV1jOxHlwrevZDSGyPR", "1r4Md28uPsJfBbGNxLJ9g95Ot0FSF01z1"),
  mk(2, 7, "1rveABwoczwfRzLXquUjaOHiu1d9l8bPy", "1yovbtpYSKTxtjvExKXJtZVbxBDkQmpB1"),
  mk(2, 8, "1khkpRhP_Wu6yGNhZDb8CKmdTdxlvUAhM", "1j2nsWLvmZ1C19SIsSKaRrvvBKCxPSijP"),
  mk(2, 9, "1h6NCNG9dMl6ZQhypGmZZRFkeQ8qan_Kl", "1zU5uRLSXZrgTL0jI4bcIxwMUJaPg7MoL"),
  mk(2, 10, "1vgh14Ou4jYrzAMcjzsrrro-WFMRPo8rr", "1OdW28gRJhdEUGQsV2ijG3PNlS5ZfTI-_"),
];

export const LOTE = "UGC x Anúncios Tradicionais - Victor (Creators)";
export const PRODUTO = "Creators";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Victor";
export const TEMA = "UGC x Anuncios Tradicionais";

// Campanha QUENTE Creators (mesma dos irmãos Esther/Lucas UGC) — EXISTE, PAUSED conjuntos
export const CAMPAIGN = "120252335029070450";
export const CLONE_ADSET = "120252808697040450"; // conjunto 1 Esther UGC — copy/config UGC do funil
export const NN_FLOOR = 0;

export interface Group { key: string; body: 1 | 2; hookMin: number; hookMax: number; ctaLabel: string; matchToken: string; }
export const GROUPS: Group[] = [
  { key: "b1_h01_05", body: 1, hookMin: 1, hookMax: 5, ctaLabel: "c1", matchToken: `${TEMA} - h01 a h05 | b1` },
  { key: "b1_h06_10", body: 1, hookMin: 6, hookMax: 10, ctaLabel: "c1", matchToken: `${TEMA} - h06 a h10 | b1` },
  { key: "b2_h01_05", body: 2, hookMin: 1, hookMax: 5, ctaLabel: "c1", matchToken: `${TEMA} - h01 a h05 | b2` },
  { key: "b2_h06_10", body: 2, hookMin: 6, hookMax: 10, ctaLabel: "c1", matchToken: `${TEMA} - h06 a h10 | b2` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b${g.body} | ${g.ctaLabel}`;
};
export const metaTitle9 = (base: string) => `${base}_9x16`;
export const metaTitle4 = (base: string) => `${base}_4x5`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
