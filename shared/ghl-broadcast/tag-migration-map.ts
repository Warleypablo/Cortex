/**
 * Mapeamento canônico old → new para a migração de padronização de tags do GHL.
 *
 * Valor `null` = tag a ser APAGADA (sem migração para nova tag).
 * Valores idênticos no lado direito colapsam várias tags antigas em uma só.
 *
 * Padrão: `[categoria]_valor_em_snake_case` (minúsculo, sem acento, sem `/®+`).
 * Categorias canônicas: [lead], [segmento], [faturamento], [status].
 * Auxiliares preservadas: [sequencia], [evento], [motivo], [mg], [funnels], [produto].
 *
 * Fonte: snapshot 2026-05-22 (182 tags) — ver
 * `/Users/ichino/.claude/plans/quero-padronizar-essas-tags-dreamy-journal.md`.
 */

export const TAG_MIGRATION_MAP: Record<string, string | null> = {
  // ────── [lead] ──────
  "[lead]_creators": "[lead]_creators",
  "[lead]": "[lead]_geral",
  "[lead]_geteducação": "[lead]_geteducacao",
  "[creators]": "[lead]_creators",
  "[lead]_ecommerce": "[lead]_ecommerce",
  "[lead]_ia": "[lead]_ia",
  "leads academia": "[lead]_academia",
  "leads academia v2": "[lead]_academia",
  "[lead]_calculadora": "[lead]_calculadora",
  "tag criadores": "[lead]_criadores",
  "[creators] lp": "[lead]_creators",
  "[lead]_estruturacao_comercial": "[lead]_estruturacao_comercial",
  "[lead]_e-commerce": "[lead]_ecommerce",
  "reestruturacao_comercial": "[lead]_estruturacao_comercial",
  "estruturacao_grupo3": "[lead]_estruturacao_comercial",
  "lead_flashcrm": "[lead]_flashcrm",
  "estruturacao_grupo2": "[lead]_estruturacao_comercial",
  "estruturacao_grupo1": "[lead]_estruturacao_comercial",
  "[lead]_gestao_comunidade": "[lead]_gestao_comunidade",
  "[lead]_odonto": "[lead]_odonto",
  "[lead]_ifv": "[lead]_implantacao_funil_vendas",
  "[lead]_geral": "[lead]_geral",
  "forms": "[lead]_geral",
  "[gestao_comunidade]": "[lead]_gestao_comunidade",
  "[lead]_funil_de_vendas": null,
  "[newsletter]_turbonews": "[lead]_turbonews",

  // ────── [segmento] ──────
  "[segmento]_e-commerce": "[segmento]_ecommerce",
  "[segmento]_outro": null,
  "[segmento]_serviço": "[segmento]_servico",
  "[segmento]_indústria": "[segmento]_industria",
  "[segmento]_-": null,
  "[empresa-es]": "[segmento]_es",
  "[espirito santo]": "[segmento]_es",
  "[segmento]_afiliado/dropshipper": "[segmento]_afiliado_dropshipper",
  "[segmento]_agência de marketing": "[segmento]_agencia_marketing",
  "[segmento]_educação": "[segmento]_educacao",
  "[segmento]_finanças": "[segmento]_financas",
  "[segmento]_food service": "[segmento]_food_service",
  "[segmento]_odonto": "[segmento]_odonto",
  "[segmento]_turismo": "[segmento]_turismo",
  "[segmento]_energia solar": "[segmento]_energia_solar",
  "[segmento]_afiliado-dropshipper": "[segmento]_afiliado_dropshipper",
  "[segmento]_franquia": "[segmento]_franquia",
  "[segmento]_imobiliária": "[segmento]_imobiliaria",
  "[segmento]_industria": "[segmento]_industria",
  "[segmento]_servico": "[segmento]_servico",
  "[segmento]_e": null,
  "[segmento]_educacao": "[segmento]_educacao",
  "[segmento]_telecom": "[segmento]_telecom",
  "[segmento]_financas": "[segmento]_financas",
  "[segmento] e-commerce": null,
  "e-commerce": null,
  "serviço": null,

  // ────── [faturamento] ──────
  "[faturamento] r$0 - r$30.000": "[faturamento]_0_30k",
  "[faturamento] r$30.000 - r$50.000": "[faturamento]_30k_50k",
  "[faturamento] r$50.000 - r$100.000": "[faturamento]_50k_100k",
  "[faturamento] r$100.000 - r$500.000": "[faturamento]_100k_500k",
  "abaixo de 100k": "[faturamento]_0_100k_legacy",
  "[faturamento] r$500.000 - r$1 milhão": "[faturamento]_500k_1mi",
  "[faturamento] r$1 milhão - r$5 milhões": "[faturamento]_1mi_5mi",
  "[faturamento] r$500.000 - r$1.000.000": "[faturamento]_500k_1mi",
  "[faturamento] r$1.000.000 - r$5.000.000": "[faturamento]_1mi_5mi",
  "[faturamento] mais de r$30 milhões": "[faturamento]_30mi_plus",
  "[faturamento]": null,
  "[faturamento] r$5 milhões - r$15 milhões": "[faturamento]_5mi_15mi",
  "[faturamento] mais de r$30.000.000": "[faturamento]_30mi_plus",
  "[faturamento] r$5.000.000 - r$15.000.000": "[faturamento]_5mi_15mi",
  "[faturamento] r$15 milhões - r$30 milhões": "[faturamento]_15mi_30mi",
  "[faturamento] r$15.000.000 - r$30.000.000": "[faturamento]_15mi_30mi",
  "[faturamento] r$ 500.000+": "[faturamento]_500k_1mi",
  "[faturamento] serviço": null,
  "[faturamento] afiliado/dropshipper": null,
  "[faturamento] outro": null,
  "[faturamento] faturamento": null,

  // ────── [status] ──────
  "[chorume]": "[status]_descartados",
  "[mql]": "[status]_mql",
  "[congelados]": "[status]_congelado",
  "[cliente]": "[status]_cliente",
  "congelados hubspot 3": "[status]_congelado",
  "tag_[churn]": "[status]_churn",
  "congelados hubspot": "[status]_congelado",
  "[congelados] 31_07_25": "[status]_congelado",
  "ddd 027 - mqls": "[status]_mql",
  "[leads] mql's_ddd027": "[status]_mql",
  "[descartados]_mql_01-01_a_22-05_2025": "[status]_descartados",
  "perdidos bitrix": "[status]_perdido",
  "[leads] clientes_ddd027": "[status]_cliente",
  "congelados hubspot ofc": "[status]_congelado",
  "perdidos bitrix ofc": "[status]_perdido",
  "descartados_que_viu_nosso ad_da_natural_tec": "[status]_descartados",
  "descartados_que_viu_nosso_ad_da_natural_tec": "[status]_descartados",
  "[não convidar]": "[status]_nao_convidar",
  "ddd mqls - 028": "[status]_mql",
  "blacklist": "[status]_blacklist",
  "clicaram no email - rmkt": null,
  "churn_tag": null,

  // ────── [sequencia] ──────
  "[sequencia]_indique_e_ganhe": "[sequencia]_indique_e_ganhe",
  "[sequencia]_levantaramao": "[sequencia]_levantaramao",
  "[sequencia]_levantaramao_ia": "[sequencia]_levantaramao_ia",
  "[sequencia]_nutrição_geral": "[sequencia]_nutricao_geral",
  "[sequencia]_nutrição_ecommerce": "[sequencia]_nutricao_ecommerce",
  "[sequencia]_nutrição_ia": "[sequencia]_nutricao_ia",
  "[sequencia]_levantaramao_ia_atendimento_ia": null,

  // ────── [evento] ──────
  "[evento]_ecommerce_es_2025": "[evento]_ecommerce_es_2025",
  "[workshop]_300k_19/03": "[evento]_workshop_300k_19_03",
  "[workshop]_300k_19/02": "[evento]_workshop_300k_19_02",
  "[evento]_growth-masterclass-edição1": "[evento]_growth_masterclass_1",
  "[workshop]_operação_black_friday_turbo_25": "[evento]_workshop_black_friday_25",
  "[workshop]_estrategias_americanas_25/09/25": "[evento]_workshop_estrategias_americanas_25_09",
  "[bootcamp performance] lp": "[evento]_bootcamp_performance",
  "[bootcamp vendas] lp": "[evento]_bootcamp_vendas",
  "convite_totvz": "[evento]_convite_totvz",
  "[workshop]": null,
  "totvz": null,

  // ────── [motivo] ──────
  "[motivo_sumiu]": "[motivo]_sumiu",
  "[motivo_não_tinha_budget]": "[motivo]_nao_tinha_budget",
  "[motivo_resolvi_descartar_por_questão_de_fit]": "[motivo]_descartado_fit",
  "[motivo_perdi_para_outra_agência]": "[motivo]_perdi_outra_agencia",
  "[motivo_projeto_futuro]": "[motivo]_projeto_futuro",
  "[motivo_errei_na_negociação]": "[motivo]_erro_negociacao",
  "[motivo_nossa_solução_não_se_encaixa_com_as_necessidades]": "[motivo]_nao_encaixa",
  "[motivo_consegui_contato_mas_não_demonstrou_interesse]": "[motivo]_sem_interesse",
  "[motivo_já_possui_uma_agência_e_está_satisfeito]": "[motivo]_ja_tem_agencia",
  "[motivo_é_pequeno]": "[motivo]_pequeno",
  "[motivo_não_falei_com_a_pessoa_certa_na_empresa]": "[motivo]_pessoa_errada",
  "[motivo_não_consegui_despertar_urgência]": "[motivo]_sem_urgencia",
  "[motivo_não_passei_do_gatekeeper]": "[motivo]_gatekeeper",
  "[motivo_já_fazem_tráfego_por_conta_própria]": "[motivo]_trafego_proprio",
  "[motivo_agência_de_marketing]": "[motivo]_agencia_marketing",
  "[motivo_não_tinha_tempo_para_fazer_reunião]": "[motivo]_sem_tempo",
  "[motivo_lead_inbound_com_faturamento_menor_que_30k]": "[motivo]_fat_menor_30k",
  "[motivo_card_duplicado]": "[motivo]_duplicado",
  "[motivo_nicho_black]": "[motivo]_nicho_black",
  "[motivo_empresa_fechada]": "[motivo]_empresa_fechada",
  "[motivo_não_consegui_contato]": "[motivo]_sem_contato",

  // ────── [mg] ──────
  "[mg]calendario-2025": "[mg]_calendario_2025",
  "[mg]como-criar-roteiros-lucrativos-para-creators": "[mg]_roteiros_creators",
  "[mg]acelerando-seus-resultados-com-email-marketing": "[mg]_email_mkt",
  "[mg]interfaces-que-convertem-um-guia-de-design": "[mg]_design_conversao",
  "[mg]como-fazer-designs-de-emails-que-vendem": "[mg]_design_email",
  "[mg]nomenclatura-de-criativos": "[mg]_nomenclatura_criativos",
  "[mg]criando-um-time-de-vendas-de-alta-performance": "[mg]_time_vendas",
  "[mg]calendario2024": "[mg]_calendario_2024",
  "[mg]planilha_criativo": "[mg]_planilha_criativo",
  "[mg]ui_ux": "[mg]_ui_ux",
  "[mg]acelerando_motor": "[mg]_acelerando_motor",
  "[mg]guia_habilidades_comercial": "[mg]_habilidades_comercial",
  "[mg]emailmkt_alta_conversao": "[mg]_emailmkt_alta_conversao",

  // ────── [funnels] ──────
  "[funnels]_teste_grátis": "[funnels]_teste_gratis",
  "[funnels]_compra_efetuada": "[funnels]_compra_efetuada",
  "[funnels]_plano_free": "[funnels]_plano_free",
  "[funnels]_plano_pro": "[funnels]_plano_pro",
  "[funnels]_reunião_realizada": "[funnels]_reuniao_realizada",
  "[funnels]_reunião_agendada": "[funnels]_reuniao_agendada",
  "[funnels]_plano_business": "[funnels]_plano_business",
  "[funnels]_carrinho_abandonado": null,

  // ────── [produto] ──────
  "[protocolo lucro turbinado]": "[produto]_protocolo_lucro_turbinado",
  "[protocolo lucro turbinado]_carrinho_abandonado": "[produto]_protocolo_lucro_turbinado_carrinho_abandonado",
  "[protocolo lucro turbinado]_pix_gerado": "[produto]_protocolo_lucro_turbinado_pix_gerado",
  "[229 ganchos hipnóticos]": "[produto]_229_ganchos_hipnoticos",
  "[229 ganchos hipnóticos]_pix_gerado": "[produto]_229_ganchos_hipnoticos_pix_gerado",
  "[criando anúncios gerados por ia]": "[produto]_criando_anuncios_ia",
  "[criando anúncios gerados por ia]_pix_gerado": "[produto]_criando_anuncios_ia_pix_gerado",
  "[fórmula dos anúncios lucrativos]": "[produto]_formula_anuncios_lucrativos",
  "[fórmula dos anúncios lucrativos]_carrinho_abandonado": "[produto]_formula_anuncios_lucrativos_carrinho_abandonado",
  "[fórmula dos anúncios lucrativos]_compra_efetuada": "[produto]_formula_anuncios_lucrativos_compra_efetuada",
  "[fórmula dos anúncios lucrativos]_pix_gerado": "[produto]_formula_anuncios_lucrativos_pix_gerado",
  "[metodologia asca®]": "[produto]_metodologia_asca",
  "[metodologia asca®]_carrinho_abandonado": "[produto]_metodologia_asca_carrinho_abandonado",
  "[metodologia asca®]_pix_gerado": "[produto]_metodologia_asca_pix_gerado",

  // ────── Lixo (apagar sem migrar) ──────
  "prax": null,
  "ctt ghl - corrigidos": null,
  "contatos ghl - outbound": null,
  "tag convite": null,
  "[interesse]_vendas": null,
  "[gestao_comunidade],[2]": null,
  "[2]": null,
  "gjfdnf": null,
  "gjfdfddnf": null,
  "ffdfdds": null,
  "fds": null,
  "teste": null,
};

/**
 * Resolve uma tag antiga para o novo nome canônico.
 * Retorna a própria tag se não estiver no mapa (tag já era canônica ou
 * apareceu depois do snapshot).
 * Retorna `null` se a tag deve ser apagada.
 */
export function migrateTag(oldTag: string): string | null | undefined {
  if (oldTag in TAG_MIGRATION_MAP) return TAG_MIGRATION_MAP[oldTag];
  return oldTag;
}

/**
 * Aplica migração em um array de tags de um contato.
 * Retorna { keep: [...], add: [...], remove: [...] } onde:
 *   - keep: tags inalteradas
 *   - add: tags novas a adicionar via POST
 *   - remove: tags antigas a remover via DELETE
 * Deduplica tags resultantes.
 */
export function diffContactTags(currentTags: string[]): {
  newTags: string[];
  add: string[];
  remove: string[];
} {
  const newSet = new Set<string>();
  const remove = new Set<string>();

  for (const tag of currentTags) {
    const mapped = migrateTag(tag);
    if (mapped === null) {
      remove.add(tag);
    } else if (mapped === tag) {
      newSet.add(tag);
    } else if (mapped !== undefined) {
      newSet.add(mapped);
      remove.add(tag);
    }
  }

  const newTags = Array.from(newSet);
  const add = newTags.filter((t) => !currentTags.includes(t));
  return { newTags, add, remove: Array.from(remove) };
}
