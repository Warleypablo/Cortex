// shared/headcount-operacao.ts
// Quem conta como "operação" no denominador das métricas por cabeça da tela
// /reports/operacao: quem entrega para o cliente.
//
// Por que isto é código e não um filtro no SQL: o campo `squad` de
// "Inhire".rh_pessoal grafa o mesmo time de duas formas ('🪖 Selva' e 'Selva')
// e ainda carrega sufixos '(OFF)'. Uma régua dessas precisa de teste, e teste
// de string em SQL é caro. A query traz as pessoas ativas na data (~110 linhas)
// e o filtro acontece aqui.

/** Setores cujo trabalho é entrega para o cliente. */
export const SETORES_OPERACAO = ["Commerce", "Tech Sites"] as const;

/**
 * Squads que ficam de fora mesmo dentro de um setor de operação. Comparação
 * por `includes` sobre o nome normalizado — pega 'Vendas' e '💰 Vendas'.
 */
const SQUADS_FORA_DA_OPERACAO = ["vendas"];

/**
 * Nome de squad comparável: sem emoji, sem variation selector, minúsculo.
 * Mantém letras, números, espaço e '&' (o time 'CX&CS' depende disso).
 *
 * Construído via `new RegExp(...)` (não regex literal): o `tsconfig.json`
 * deste projeto não define `target`, então o `tsc` cai no default pré-ES6 e
 * recusa a flag `u` num literal (`/.../gu`), com `TS1501`. server/routes.ts
 * (linha 6461) e server/storage.ts (linha 13004) usam essa flag em literal e
 * têm esse mesmo erro no `npm run check` — não é um padrão validado a
 * seguir, é um erro pré-existente que passou despercebido porque o
 * `tsx`/esbuild que roda o server não faz esse tipo de checagem. Aqui o
 * construtor evita repetir o erro.
 */
const CARACTERES_NAO_NOME = new RegExp("[^\\p{L}\\p{N} &]", "gu");

export function normalizarSquad(squad: string | null | undefined): string {
  return (squad ?? "")
    .replace(CARACTERES_NAO_NOME, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** true quando a pessoa entra no headcount de operação. */
export function ehOperacao(
  setor: string | null | undefined,
  squad: string | null | undefined,
): boolean {
  const s = (setor ?? "").trim();
  if (!(SETORES_OPERACAO as readonly string[]).includes(s)) return false;
  const sq = normalizarSquad(squad);
  return !SQUADS_FORA_DA_OPERACAO.some((fora) => sq.includes(fora));
}
