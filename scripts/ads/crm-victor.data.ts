/**
 * Inventário do lote "Cliente Novo x Base - Victor" — funil Implantação de CRM.
 * PAREADO 9x16 + 4x5. 2 bodies × 11 hooks = 22 criativos = 44 vídeos.
 * ⚠️ vários 9x16 do body1 são ENORMES (376-435MB) — upload vai ser pesado.
 * Irmão do CRM Lucas → mesma campanha CBO teste CRM.
 */
export interface Pair { base: string; body: 1 | 2; hook: number; drive9x16: string; drive4x5: string; }
const mk = (body: 1 | 2, hook: number, drive9x16: string, drive4x5: string): Pair => ({ base: `CRMClienteNovo_Victor_b${body}h${hook}`, body, hook, drive9x16, drive4x5 });

export const PAIRS: Pair[] = [
  mk(1, 1, "1VfKz7zzj8VQaUMcUFK9EiLpCFf-ox7OS", "1FsrjEOUCJOQF1YYJjoCjEBL79EEzaOlB"),
  mk(1, 2, "1VrH5dp7bamgXco4MBVRmybKl9sIEVLHS", "1YaoT5Plbh5p4qPvHMv4uexzSovZY2E4N"),
  mk(1, 3, "1CRgZiISPlPZA7Y3VK18lHWhwwJv7bEFW", "169Kt1qJ_ULOy7ISnYLgNfKF3hg8jiceX"),
  mk(1, 4, "1qgID1B3oqyNjE135mL0yNU8tcdehZwFi", "1esopK7F-8Z6qtQKYg0vFG9r1dIgXJV4_"),
  mk(1, 5, "13oO_hLCt6O5jQiThHgDYzJghHcR6Pwy2", "14-Viz0iyDtw9clCOfraZLFDwewN_Ao2d"),
  mk(1, 6, "1xogMdGHPhwod3pa2V5PTNaCGMS7Os99A", "1qyB7JUYoa7tF9f3xYkwdVwPstndrt6Tx"),
  mk(1, 7, "1pxjGaU_xstmiSop12pgZM65XgyRgdxYc", "1jvuNkf_w0mR_21rBhYWVMNJsqpslyJz8"),
  mk(1, 8, "1X9-clg1B0q1NBR7gNFgMxfMKnPixxa0i", "100ShqFeoKY71SvHDtwdg5HlUBjQJZhMw"),
  mk(1, 9, "1oIqJTZtXBpDiax--vMb_UdGrhuUOBT7e", "1oveldAnNGlV51QnXkAq-0GT-OAi6HOjL"),
  mk(1, 10, "1NoLSl--Y6Cz7KgclwemJvM9Ln4c-E_Yi", "1o8kMXXFCurjnxYaIEiD_BN2n6LJdBl3m"),
  mk(1, 11, "1gK_KBXQwzWgP3IRVQizCkImHGzR5JX-V", "1XNddiktSHdjSID3wDMtCq1uo87lJ60zx"),
  mk(2, 1, "1WlYWDHTcceXiXEey3O02jFgPJ2DcFVK2", "1I_YuW8hEmiALHBKSbbZ5AnqjqcREOrKD"),
  mk(2, 2, "18hmVzHrGSvDhbqKeXMV2oglQDinH4XAj", "1LQ4b53gP7pKjpvdzSB5oCgXqQCBR8QSX"),
  mk(2, 3, "1a0VdZb2RFCy9hxEeW2NsNKgVkiwdM2Wl", "1lr4ZdftY-lKsXZ_wn-DZYmu3ktaqQzXP"),
  mk(2, 4, "1WaTKtlkZvLx2vGWgFnmpmosGUjGIYBoz", "1qzFT_Vmp4d1ephy2CVPd08SLsxFFw5Wr"),
  mk(2, 5, "19rYd765QzLaGxsFjIGOHuI3vDGywm12N", "1y5zEEiBAi7w-bJsfEePsza0chDt9K24y"),
  mk(2, 6, "1zXXLqnThlopfCrPxKcUvxBXGJgu_rZGT", "1J7qE8oVa22bW7jpw_Za87W5XDDYSSnnI"),
  mk(2, 7, "13Lj5hKg73ciHiHVGpGftZQSId7KWWJ8M", "17MdtbsOWiLSeV8b7n-nd3KBPojnbBnDi"),
  mk(2, 8, "1wMu2HzLgZ9sGvbM8EYDspQhsQ0wsNPRw", "1E1rtl6t-wwoyWsW21Ti7IBThhvZXGcJi"),
  mk(2, 9, "1FR6Nfc5lQiAcEMmkmcjr8WQ7AAtp5oXw", "1AkDfopSp1T8AphdT0t9L32m6NJXM7DWT"),
  mk(2, 10, "1pQidkSft3PypThNuGHgkvYsK64x2iY_v", "1Vn4JaigGHgFIGateQ88_UxgPPrPd5Vzp"),
  mk(2, 11, "1iz909INF8EKWDYkRFTfG_81UeIUHYMIK", "1iYTguOmwK-HYw81ie33GgnkThMOSbeQK"),
];

export const LOTE = "Cliente Novo x Base - Victor (CRM)";
export const PRODUTO = "Implantação de CRM";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Victor";
export const TEMA = "Cliente Novo x Base";

// Campanha CBO teste CRM (mesma do CRM Lucas) — EXISTE, PAUSED
export const CAMPAIGN = "120252008224000450";
export const CLONE_ADSET = "120252008223980450"; // conjunto 151 CRM Recompra — copy/config do funil
export const NN_FLOOR = 0;

export interface Group { key: string; body: 1 | 2; hookMin: number; hookMax: number; ctaLabel: string; matchToken: string; }
export const GROUPS: Group[] = [
  // ⚠️ matchToken PRECISA incluir a persona: sem `[${PERSONA}]` os grupos h01-05 do Victor
  // casavam com os conjuntos do LUCAS (mesmo tema/faixa) e os ads iam pro conjunto errado.
  { key: "b1_h01_05", body: 1, hookMin: 1, hookMax: 5, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h01 a h05 | b1` },
  { key: "b1_h06_11", body: 1, hookMin: 6, hookMax: 11, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h06 a h11 | b1` },
  { key: "b2_h01_05", body: 2, hookMin: 1, hookMax: 5, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h01 a h05 | b2` },
  { key: "b2_h06_11", body: 2, hookMin: 6, hookMax: 11, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h06 a h11 | b2` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b${g.body} | ${g.ctaLabel}`;
};
export const metaTitle9 = (base: string) => `${base}_9x16`;
export const metaTitle4 = (base: string) => `${base}_4x5`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
