/**
 * Inventário do lote "Super Produção - Ichino (Novos)" — funil Creators.
 * PAREADO 9x16 + 4x5. 1 body × 1 cta × 3 hooks = 3 criativos = 6 vídeos (~594-601MB).
 * Tema já existe na camp Creators (conjunto 68 [Ichino] Super Produção) → NOVO conjunto, copy clonada do irmão.
 * Pasta Drive 18n4JYiJSNGzCK_ezvbz42qQRGWRbLC8_ ("30 - Super Produção › Ichino › Novos").
 */
export interface Pair { base: string; body: 1; hook: number; drive9x16: string; drive4x5: string; }
const mk = (hook: number, drive9x16: string, drive4x5: string): Pair => ({ base: `SuperProducao_Ichino_b1h${hook}`, body: 1, hook, drive9x16, drive4x5 });

export const PAIRS: Pair[] = [
  mk(1, "1yKiAk9po4bI01jSSI9MB4ZhY9h4ddu_p", "19sIk6trmbZNKf1LPbo5aFzmG8DTMpKfn"),
  mk(2, "1_AB74Ka7FFUzGt13ELislq6fi8GwQBMX", "1UAh9DW77gOfXABt-S1cZMVKSLxkAEkvf"),
  mk(3, "169nsWIsGQZ6-PKl4Q2rYhAv0V9uaiw9_", "1c-kVqBX4ym6muC_sACtin-QM0mq8GPx1"),
];

export const LOTE = "Super Produção - Ichino Novos (Creators)";
export const PRODUTO = "Creators";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Ichino";
export const TEMA = "Super Produção";

// Campanha Creators CBO Broad Teste (EXISTE) + conjunto-irmão 68 [Ichino] Super Produção (copy/config).
export const CAMPAIGN = "120249141209100450";
export const CLONE_ADSET = "120251592122250450";
export const NN_FLOOR = 0;

export interface Group { key: string; body: 1; hookMin: number; hookMax: number; ctaLabel: string; matchToken: string; }
export const GROUPS: Group[] = [
  { key: "b1_h01_03", body: 1, hookMin: 1, hookMax: 3, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h01 a h03 | b1` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b${g.body} | ${g.ctaLabel}`;
};
export const metaTitle9 = (base: string) => `${base}_9x16`;
export const metaTitle4 = (base: string) => `${base}_4x5`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
