/**
 * Inventário do lote "Cliente Novo x Cliente da Base" (Lucas) — funil Implantação de CRM.
 * Usado pelos 3 passos (planilha → upload → ads).
 *
 * PAREADO 9x16 (stories) + 4x5 (feed). 2 bodies × 9 hooks = 18 criativos = 36 vídeos.
 * Cada vídeo sobe pro Gerenciador como `${base}_9x16` / `${base}_4x5` (match estrito por nome).
 *
 * Estrutura acordada com o Caio (10/jul), padrão do CRM Recompra (conjuntos 151-158):
 *   Campanha CBO de TESTE do CRM já existente (`120252008224000450`) — segue PAUSED.
 *   4 conjuntos: b1(h01-05 / h06-09) + b2(h01-05 / h06-09). Tudo PAUSED.
 *   Config (targeting/otimização/pixel/attribution) + COPY clonados de um conjunto irmão do funil.
 *   Copy: reaproveitada do funil (CLONE_ADSET), a pedido do Caio.
 */

export interface Pair {
  base: string;      // título-base no Meta (sobe `${base}_9x16` e `${base}_4x5`); vira nomeDrive na Biblioteca
  body: 1 | 2;
  hook: number;      // 1..9
  drive9x16: string; // file id do vídeo 9x16 no Google Drive
  drive4x5: string;  // file id do vídeo 4x5 no Google Drive
}

const mk = (body: 1 | 2, hook: number, drive9x16: string, drive4x5: string): Pair => ({
  base: `CRM_ClienteNovo_Lucas_b${body}h${hook}`,
  body,
  hook,
  drive9x16,
  drive4x5,
});

export const PAIRS: Pair[] = [
  // body 1
  mk(1, 1, "1HNAofN94ZVfneEo7vEAipsFTbJfbzJoP", "1vDFy1Mn97U6t6JcSsvPxD5TO7UY0FHxp"),
  mk(1, 2, "13XkrUSuEY_3hZn6EJ8E6dXKYtRA2b6aO", "1T_rqT1F8BwRZsuJCcEXZaT6uyqZAwpcx"),
  mk(1, 3, "1_36oVhaBJZ6VJQmsY4n82ns8jaBOG5fg", "1gsExm6LhIIeN46_9peAPPPzoJcAmcIg1"),
  mk(1, 4, "1fWglNC74B4cwihM8X59adR1DHBF21Mcb", "14XkVzbnghKOBkKJBOfv2VND8bGldf9ox"),
  mk(1, 5, "1FrwjkP_wcDoAI3WjTF4uKIM0g2AyoRf_", "1gzD63FBE5BVtiTShx3-J64nVE6yeKyCm"),
  mk(1, 6, "1e2Ys5Mdv6JPE6Itjtg2AWZCC5POzaMG8", "1UaTREYdZWQhF6j9IbhtQQ8fEOjW6oZUS"),
  mk(1, 7, "1KljSkOQllQU8rGbQsQ6H6w72_CHrdiNU", "1IysMY1og7BwdcXumvZXHwXGdG_WoM5lH"),
  mk(1, 8, "1Atssm6z-MxKqLR_jEJTgCBkz7G0JeYW_", "1Mc8Lqa8uDq95NSCC3ZaI045sE7hQF3eD"),
  mk(1, 9, "1Sq6x-OSXHAttFJ3ju4NLqbV29_EQakuL", "1XpisxUzIGr12QpOnui9WS6rYcinS-naO"),
  // body 2
  mk(2, 1, "13mWYkTwf1lxdnPt9l-FTajTzS6xVGefW", "1tL9XZ0zwD9SmtWU53NnG4LnNgRDLPia9"),
  mk(2, 2, "11XeLgNsYsBCMWMl_GC5-mV4piTEDulIk", "1IPjJzIdtjBILUjqlEdDEw2NOFnPiL3e2"),
  mk(2, 3, "1o238srgX7tY2DAZW2gdyPRWKl1Xys04h", "13twdLyG_nr0EiiUFyIbkPr7Prw_zix7q"),
  mk(2, 4, "14Sn_gO20QebesFOJLaZ8h4M0ApY4kH5f", "1v8tHnK7B1Q_JpLhw-3as8DlgrrGcBsGa"),
  mk(2, 5, "1oZMYaMNJK6nD1eiaJqU3I7hiLvWIdhbV", "1X8c-UwJnMeelZKBXV1nPQNzYUt9IH4ks"),
  mk(2, 6, "1trojtbwddb3oBBei2olNpC8sqDsjErgt", "19hO5WkEx_a1rxiSLchd1Ms2SK3VRtHdv"),
  mk(2, 7, "1gjY2aRBXvNCtwcAMC-InA3nWIRE32ioT", "1s6niS3G8XzUw4WFroaoja1q8oBDnLF-5"),
  mk(2, 8, "12O87j1CLIIKTByl-vb8qUEz_KVO8WsAe", "1n5leonbeW9imgE4c-icKUP1dEnlzrdT9"),
  mk(2, 9, "1ZCzHnq5XC7Jwp0hAAzYznHUG9iI8eQ3Z", "1aKHCQdCIBgaTLoiTah4gVgHfNM1bNjRC"),
];

export const LOTE = "Cliente Novo x Cliente da Base - Lucas (CRM)";
export const PRODUTO = "Implantação de CRM";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Lucas";
export const TEMA = "Cliente Novo x Base";

// ─────────── Campanha (JÁ EXISTE, CBO, PAUSED — não criar, só adicionar conjuntos) ───────────
export const CAMPAIGN = "120252008224000450"; // [TP] [LEADS] [CBO] [Frio] [CRM] - Campanha de Teste
export const CLONE_ADSET = "120252008223980450"; // conjunto 151 CRM Recompra — clona config + COPY do funil
export const NN_FLOOR = 158; // conjuntos do CRM Recompra vão até 158; novos começam em 159

// ─────────── Split: 4 conjuntos (b1/b2 × h01-05/h06-09), ≤5 ads cada ───────────
export interface Group { key: string; body: 1 | 2; hookMin: number; hookMax: number; ctaLabel: string; matchToken: string; }
export const GROUPS: Group[] = [
  { key: "b1_h01_05", body: 1, hookMin: 1, hookMax: 5, ctaLabel: "c1", matchToken: `${TEMA} - h01 a h05 | b1` },
  { key: "b1_h06_09", body: 1, hookMin: 6, hookMax: 9, ctaLabel: "c1", matchToken: `${TEMA} - h06 a h09 | b1` },
  { key: "b2_h01_05", body: 2, hookMin: 1, hookMax: 5, ctaLabel: "c1", matchToken: `${TEMA} - h01 a h05 | b2` },
  { key: "b2_h06_09", body: 2, hookMin: 6, hookMax: 9, ctaLabel: "c1", matchToken: `${TEMA} - h06 a h09 | b2` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b${g.body} | ${g.ctaLabel}`;
};

export const metaTitle9 = (base: string) => `${base}_9x16`;
export const metaTitle4 = (base: string) => `${base}_4x5`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
