/**
 * Normalização de telefone BR para casar contatos entre GHL/Funnels e Bitrix.
 *
 * Problema: o GHL devolve telefones como "+5521975993170" ou "+55 27 99753-5768";
 * o Bitrix guarda em formatos variados ("(21) 97599-3170", "5521...", "021..."). Pra
 * o join `respondedor do WhatsApp ↔ deal do Bitrix` bater, os dois lados passam por
 * esta mesma função e comparam a forma canônica.
 *
 * Canônico = DDD (2 dígitos) + assinante de 8 dígitos, SEM DDI (55) e SEM o "9º dígito"
 * de celular. Dropar o 9 maximiza o match (parte das bases tem, parte não); o risco de
 * colidir celular com fixo de mesmo DDD+8 é baixo e telefones não-casados são logados.
 */

/** Normaliza um telefone BR pra chave canônica `DDD + 8 dígitos` (10 dígitos). `null` se não parseável. */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  // Remove DDI do Brasil quando presente (55 + 10/11 dígitos = 12/13 no total).
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  // Remove zero de operadora/tronco (ex.: "021...").
  digits = digits.replace(/^0+/, "");

  // Espera DDD(2) + assinante(8 ou 9). Fora disso, não é um telefone BR válido pra match.
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = digits.slice(0, 2);
  let assinante = digits.slice(2);

  // Celular com 9º dígito (9 dígitos, começando em 9) → dropa o 9 pra forma de 8 dígitos.
  if (assinante.length === 9 && assinante.startsWith("9")) {
    assinante = assinante.slice(1);
  }

  // Se ainda não tem 8 dígitos (ex.: fixo de 7), descarta — não dá match confiável.
  if (assinante.length !== 8) return null;

  return ddd + assinante;
}

/** true se os dois telefones apontam pro mesmo assinante (forma canônica igual). */
export function samePhoneBR(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhoneBR(a);
  const nb = normalizePhoneBR(b);
  return na !== null && na === nb;
}
