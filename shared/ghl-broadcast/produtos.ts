/**
 * Mapa de PRODUTO/INTERESSE → tags do GHL, pra segmentar qualquer base por produto.
 *
 * Ex.: "Congelados que tiveram interesse em E-commerce" = contatos da base Congelados
 * que TAMBÉM têm alguma tag de interesse em e-commerce. Combina com BASE_TAG_MAP.
 *
 * Tags confirmadas nos dados reais (contagem aprox.): [lead]_creators (10k),
 * [lead]_ecommerce (816), [segmento]_ecommerce (441), [lead]_estruturacao_comercial (236),
 * [lead]_flashcrm (69). Editável conforme novas tags surgirem.
 */

export interface ProdutoFiltro {
  /** rótulo exibido */
  label: string;
  /** o contato precisa ter QUALQUER uma destas tags (case-insensitive) */
  tagsAny: string[];
}

export const PRODUTO_TAGS: Record<string, ProdutoFiltro> = {
  ECOMMERCE: { label: "E-commerce", tagsAny: ["[lead]_ecommerce", "[segmento]_ecommerce", "[sequencia]_nutricao_ecommerce"] },
  CREATORS: { label: "Creators (UGC)", tagsAny: ["[lead]_creators", "[mg]_roteiros_creators"] },
  ESTRUTURACAO_COMERCIAL: { label: "Estruturação Comercial", tagsAny: ["[lead]_estruturacao_comercial", "[mg]_habilidades_comercial"] },
  CRM: { label: "CRM", tagsAny: ["[lead]_flashcrm"] },
  PERFORMANCE: { label: "Performance", tagsAny: ["[evento]_bootcamp_performance", "[motivo]_trafego_proprio"] },
};

export const PRODUTOS_DISPONIVEIS = Object.keys(PRODUTO_TAGS);

export function getProdutoFiltro(produto: string): ProdutoFiltro | null {
  return PRODUTO_TAGS[produto] || null;
}

/** true se o contato tem interesse no produto (qualquer tag do produto, case-insensitive). */
export function contatoTemProduto(contactTags: string[] | null | undefined, filtro: ProdutoFiltro): boolean {
  const tags = new Set((contactTags ?? []).map((t) => t.toLowerCase()));
  return filtro.tagsAny.some((t) => tags.has(t.toLowerCase()));
}
