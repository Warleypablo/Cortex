/**
 * Inventário do lote "Bastidores Variação Hook3 - Ana (Novos)" — funil Creators.
 * PAREADO 9x16 + 4x5. 1 body × 1 cta × 5 hooks = 5 criativos = 10 vídeos (~104-105MB).
 * Tema Bastidores já existe na camp Creators (conjunto 148 [Ana] Bastidores h01-03) → NOVO conjunto, copy clonada do irmão.
 * ⚠️ matchToken DISTINTO do 148 ("Bastidores Variação Hook3" ≠ "Bastidores") pra não casar com o conjunto existente.
 * Pasta Drive 1zP2-BlwXn4MsqsCxGS--iu0ubXm5rDso ("36 - Bastidores › Ana › Editado › Novos").
 */
export interface Pair { base: string; body: 1; hook: number; drive9x16: string; drive4x5: string; }
const mk = (hook: number, drive9x16: string, drive4x5: string): Pair => ({ base: `BastidoresVariacaoHook3_Ana_b1h${hook}`, body: 1, hook, drive9x16, drive4x5 });

export const PAIRS: Pair[] = [
  mk(1, "1HIhnWLCmQjur8AvaRlBe0SMpwS-K-npX", "1gCcuQV6aqa8354XgjIP4Qz8Ie2chTpf6"),
  mk(2, "1nQhy8knEogWB5h6c0T3L-vG2bSfA_T11", "1RAd6scrHZ_GCIjgnVSumZBoX6xzXXO5Q"),
  mk(3, "1yE_dLZVrZ18R3Fz51tqw51iXLeJU00ZZ", "1qVtgz0I0Lt6pgOxiuoVPoeBU46o04-NK"),
  mk(4, "152zOWf0iddSf75ghj8RGE6PPNgQIy3rb", "1hv4vNIO-GUtOuS4QgZVolLPK7vTj4pyz"),
  mk(5, "1SVdm8mHu2i7yT0qzb7BXdWN3UgamyldS", "16o67UbvqlmD-d80EuheeRz6QfmaZ8IY7"),
];

export const LOTE = "Bastidores Variação Hook3 - Ana Novos (Creators)";
export const PRODUTO = "Creators";
export const PLATAFORMA = "Meta";
export const TIPO_AD = "Vídeo";
export const PERSONA = "Ana";
export const TEMA = "Bastidores Variação Hook3";

// Campanha Creators CBO Broad Teste (EXISTE) + conjunto-irmão 148 [Ana] Bastidores (copy/config).
export const CAMPAIGN = "120249141209100450";
export const CLONE_ADSET = "120251810662130450";
export const NN_FLOOR = 0;

export interface Group { key: string; body: 1; hookMin: number; hookMax: number; ctaLabel: string; matchToken: string; }
export const GROUPS: Group[] = [
  { key: "b1_h01_05", body: 1, hookMin: 1, hookMax: 5, ctaLabel: "c1", matchToken: `[${PERSONA}] - ${TEMA} - h01 a h05 | b1` },
];
export const conjName = (nn: number, g: Group): string => {
  const hlabel = `h${String(g.hookMin).padStart(2, "0")} a h${String(g.hookMax).padStart(2, "0")}`;
  return `${nn} - [IG] [Aberto] [Stories & Feed & Reels] [${PERSONA}] - ${TEMA} - ${hlabel} | b${g.body} | ${g.ctaLabel}`;
};
export const metaTitle9 = (base: string) => `${base}_9x16`;
export const metaTitle4 = (base: string) => `${base}_4x5`;
export const driveLink = (id: string) => `https://drive.google.com/file/d/${id}/view`;
