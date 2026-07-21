// server/routes/bp2026.info.ts
// Dicionário de documentação por métrica: o que é, fonte do realizado e cálculo.
// Anexado a todas as linhas do payload no handler (bp2026.ts) — única fonte de
// verdade da documentação exibida no tooltip de cada linha.

export interface InfoMetrica {
  definicao: string; // o que a linha mede, em uma frase
  fonte: string;     // de onde vem o realizado
  calculo: string;   // como o número é computado
}

const FONTE_SNAPSHOT = "ClickUp — cup_data_hist, snapshot do último dia do mês (status ativo/onboarding/triagem)";
const FONTE_BITRIX = "Bitrix CRM — deals em 'Negócio Ganho' por data de fechamento";
const FONTE_CAZ_CAIXA = "Conta Azul — parcelas de despesa QUITADAS por data de quitação (regime caixa)";
const FONTE_CAZ_COMP = "Conta Azul — parcelas de receita por data de competência";
const FONTE_INHIRE = "Inhire — rh_pessoal, ativos no fim do mês (admissão ≤ fim do mês < demissão)";
const FONTE_CHURN = "ClickUp — vw_cup_churn_ajustado por data de solicitação de encerramento (churn bruto, alinhado ao gráfico 'Churn Commerce MoM' do ClickUp; inclui abonados e todos os motivos, mas só status de churn real — cancelado/inativo e em cancelamento; exclui 'entregue' e 'pausado')";

// linhas de serviço da Revenue (mesmo CASE de produto da agregação)
const LINHAS_SERVICO: Record<string, string> = {
  performance: "Performance",
  creators: "Creators",
  social: "Social Media",
  gc: "Gestão de Comunidade",
  others: "Others (demais produtos)",
};

function infoRevenue(): Record<string, InfoMetrica> {
  const out: Record<string, InfoMetrica> = {};
  for (const [chave, nome] of Object.entries(LINHAS_SERVICO)) {
    out[`mrr_${chave}`] = {
      definicao: `MRR contratado da linha ${nome} no fim do mês.`,
      fonte: FONTE_SNAPSHOT,
      calculo: `Soma de valorr dos contratos classificados como ${nome} (campo produto; quando vazio, fallback pelo nome do serviço). A soma das 5 linhas é o MRR Ativo do DRE por construção.`,
    };
    out[`contratos_${chave}`] = {
      definicao: `Número de contratos da linha ${nome} ativos no fim do mês.`,
      fonte: FONTE_SNAPSHOT,
      calculo: `Contagem de contratos (id_subtask) classificados como ${nome}.${chave === "creators" ? " Atenção: em Creators cada 'entrega' do ClickUp conta como contrato — atingimento de contratos e AOV são afetados pela granularidade da operação." : ""}`,
    };
    out[`aov_${chave}`] = {
      definicao: `Ticket médio mensal dos contratos da linha ${nome}.`,
      fonte: "Derivada das duas linhas acima.",
      calculo: `MRR ${nome} ÷ contratos ${nome} do mês. YTD = razão das posições no último mês fechado.`,
    };
    out[`churn_pct_${chave}`] = {
      definicao: `Taxa mensal de churn da linha ${nome}.`,
      fonte: FONTE_CHURN,
      calculo: `Churn R$ do produto no mês ÷ MRR da linha no fim do mês ANTERIOR. YTD = Σ churn ÷ Σ denominadores (taxa média mensal ponderada).`,
    };
  }
  return out;
}

export const INFO_METRICAS: Record<string, InfoMetrica> = {
  // ===== DRE =====
  mrr_ativo: {
    definicao: "Receita recorrente mensal contratada da base no fim do mês (posição, não faturamento).",
    fonte: FONTE_SNAPSHOT,
    calculo: "Soma de valorr de todos os contratos com status ativo/onboarding/triagem no último snapshot do mês. Acumulado = posição do último mês fechado.",
  },
  receita_pontual: {
    definicao: "Receita de projetos pontuais vendidos no mês (proxy de faturamento).",
    fonte: FONTE_BITRIX,
    calculo: "Soma de valor_pontual dos deals ganhos no mês. Usa a venda como proxy porque o Conta Azul não separa pontual de recorrente (tudo em 03.01.01).",
  },
  outras_receitas: {
    definicao: "Receitas fora da operação principal (variáveis, stack revendido, rendimentos etc.).",
    fonte: FONTE_CAZ_COMP,
    calculo: "Soma de valor_liquido das categorias 03.02, 03.03, 04.01 e 04.03 por competência.",
  },
  receita_total_faturavel: {
    definicao: "Receita total que a operação tem contratada/vendida no mês.",
    fonte: "Derivada das três linhas acima.",
    calculo: "MRR Ativo + Venda Pontual + Outras Receitas.",
  },
  inadimplencia: {
    definicao: "Receita vencida e não recebida (foto atual) mais estornos e devoluções.",
    fonte: "Conta Azul — parcelas de receita vencidas (data_vencimento ≤ hoje) com saldo não pago + despesas 05.06 (estornos).",
    calculo: "Σ nao_pago das parcelas vencidas no mês + estornos quitados no mês. É uma foto: meses passados encolhem conforme clientes pagam atrasado.",
  },
  impostos_receita: {
    definicao: "Impostos sobre o faturamento (ISS, PIS/COFINS, Simples).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Soma de valor_pago das categorias 05.05 e 'Impostos retidos' por quitação.",
  },
  receita_liquida: {
    definicao: "Receita após inadimplência e impostos sobre a receita.",
    fonte: "Derivada.",
    calculo: "Receita Total Faturável − Inadimplência e Estornos − Impostos sobre Receita.",
  },
  csv_salarios: {
    definicao: "Salários e encargos do time de entrega (CSV — Custo de Servir).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 05.01 (exceto 05.01.10 Premiações) e 05.02.",
  },
  csv_beneficio: {
    definicao: "Parcela do benefício Caju atribuída ao time de entrega.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Caju total (06.10.04) × fração orçada do CSV no mês — o Conta Azul não tem centro de custo, então o rateio segue o orçamento.",
  },
  csv_stack: {
    definicao: "Ferramentas e softwares usados na entrega.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 05.03, 05.04.01, 06.05.03 e 06.10.01.",
  },
  margem_bruta: {
    definicao: "Quanto sobra da receita líquida após o custo de servir.",
    fonte: "Derivada.",
    calculo: "Receita Líquida − CSV Salários − CSV Benefício − CSV Stack.",
  },
  cac: {
    definicao: "Custo de aquisição: time comercial, comissões, mídia e verbas de venda.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 05.04.02, 06.04, 06.05.04, 06.05.05, 06.06 e 06.07. Detalhe por sub-linha na aba CAC.",
  },
  sga: {
    definicao: "Despesas administrativas e gerais (SG&A).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Bucket 06.01/06.02/06.03/06.08/06.09/06.10.02-03-06-07-08 + complemento do rateio do Caju. Detalhe por sub-linha na aba SG&A.",
  },
  bonus: {
    definicao: "Bônus e premiações do time.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 05.01.10 (Premiações).",
  },
  ebitda: {
    definicao: "Resultado operacional antes de impostos diretos e investimentos.",
    fonte: "Derivada.",
    calculo: "Margem Bruta − CAC − SG&A − Bônus.",
  },
  impostos_diretos: {
    definicao: "IRPJ, CSLL e impostos sobre o resultado.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 06.12, 06.13 e 08.01. ATENÇÃO: IRPJ/CSLL de 2026 ainda não estão lançados no Conta Azul — linha distorcida para melhor.",
  },
  capex: {
    definicao: "Investimentos em ativos (equipamentos, obras).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.11.",
  },
  geracao_caixa: {
    definicao: "Caixa que a operação produz no mês, na visão gerencial do BP (antes da distribuição a sócios).",
    fonte: "Derivada.",
    calculo: "EBITDA − Impostos Diretos − CAPEX. Difere do DFC por timing de recebimento e por excluir transferências a sócios.",
  },
  dfc_real: {
    definicao: "Fluxo de caixa real: o que de fato entrou menos o que saiu do banco.",
    fonte: "Conta Azul — todas as parcelas QUITADAS no mês (receitas e despesas, incluindo transferências a sócios).",
    calculo: "Σ entradas quitadas − Σ saídas quitadas, por data de quitação. Comparado contra o orçado da Geração de Caixa.",
  },

  // ===== Métricas Gerais =====
  receita_total: {
    definicao: "Receita do mês após inadimplência (antes de impostos).",
    fonte: "Derivada do DRE.",
    calculo: "Receita Total Faturável − Inadimplência e Estornos.",
  },
  despesa_total: {
    definicao: "Todas as despesas do DRE somadas.",
    fonte: "Derivada do DRE.",
    calculo: "Impostos s/ receita + CSVs + CAC + SG&A + Bônus + Impostos diretos + CAPEX.",
  },
  vendas_mrr: {
    definicao: "MRR novo vendido no mês (novas + monetização — o CRM não separa).",
    fonte: FONTE_BITRIX,
    calculo: "Soma de valor_recorrente dos deals ganhos no mês.",
  },
  vendas_pontual: {
    definicao: "Receita pontual vendida no mês.",
    fonte: FONTE_BITRIX,
    calculo: "Soma de valor_pontual dos deals ganhos no mês (mesma série da Venda Pontual da aba Overview).",
  },
  colaboradores: {
    definicao: "Headcount total ativo no fim do mês.",
    fonte: FONTE_INHIRE,
    calculo: "Contagem de pessoas ativas. Acumulado = posição do último mês fechado.",
  },
  receita_cabeca: {
    definicao: "Receita gerada por colaborador.",
    fonte: "Derivada.",
    calculo: "Receita Faturável do mês ÷ Número de Colaboradores (mesma definição do orçado da planilha).",
  },
  mrr_cabeca: {
    definicao: "MRR sustentado por colaborador.",
    fonte: "Derivada.",
    calculo: "MRR Ativo ÷ Número de Colaboradores do mês.",
  },
  clientes: {
    definicao: "Clientes com contrato ativo no fim do mês.",
    fonte: FONTE_SNAPSHOT,
    calculo: "Contagem de clientes distintos (id_task) no snapshot.",
  },
  contratos: {
    definicao: "Contratos ativos no fim do mês (um cliente pode ter vários).",
    fonte: FONTE_SNAPSHOT,
    calculo: "Contagem de contratos distintos (id_subtask) no snapshot.",
  },
  ticket_cliente: {
    definicao: "Receita média mensal por cliente da base.",
    fonte: "Derivada.",
    calculo: "Receita Faturável do mês ÷ clientes ativos (mesma definição do orçado da planilha).",
  },
  ticket_contrato: {
    definicao: "Receita média mensal por contrato.",
    fonte: "Derivada.",
    calculo: "Receita Faturável do mês ÷ contratos ativos.",
  },
  churn_mes: {
    definicao: "MRR perdido em cancelamentos solicitados no mês.",
    fonte: FONTE_CHURN,
    calculo: "Soma de valor_r de todos os encerramentos solicitados no mês (bruto, inclui abonados).",
  },
  aliquota_efetiva: {
    definicao: "Percentual da receita consumido por impostos (sobre receita + diretos).",
    fonte: "Derivada do DRE.",
    calculo: "(Impostos s/ Receita + Impostos Diretos) ÷ Receita Faturável. IRPJ/CSLL não lançados distorcem para melhor.",
  },
  margem_geracao: {
    definicao: "Percentual da receita que vira caixa gerencial.",
    fonte: "Derivada do DRE.",
    calculo: "Geração de Caixa ÷ Receita Faturável. Herda a distorção do IRPJ/CSLL não lançado.",
  },
  saldo_caixa: {
    definicao: "Saldo bancário estimado no fim do mês.",
    fonte: "Conta Azul — caz_bancos (saldo atual) + fluxos quitados.",
    calculo: "Saldo atual − fluxos líquidos quitados dos meses posteriores (reconstrução retroativa; não captura ajustes manuais de conta).",
  },
  pessoas_csv: {
    definicao: "Pessoas alocadas na entrega (conceito CSV do BP).",
    fonte: FONTE_INHIRE,
    calculo: "Setores Commerce + Tech Sites. Aproximação: o comercial está dentro de Commerce no Inhire.",
  },
  pessoas_cac: {
    definicao: "Pessoas alocadas em aquisição (conceito CAC do BP).",
    fonte: FONTE_INHIRE,
    calculo: "Setor Growth Interno. Subcontado: o comercial está dentro de Commerce no Inhire.",
  },
  pessoas_sgea: {
    definicao: "Pessoas em funções administrativas (conceito SG&A do BP).",
    fonte: FONTE_INHIRE,
    calculo: "Setores Backoffice + Sócios.",
  },

  // ===== Revenue (gerado por linha de serviço) =====
  ...infoRevenue(),

  // ===== Funil Comercial =====
  funil_vendas_mrr: {
    definicao: "MRR novo vendido no mês.",
    fonte: FONTE_BITRIX,
    calculo: "Soma de valor_recorrente dos deals ganhos. Quebra por produto indisponível (o CRM não registra valor por produto).",
  },
  funil_vendas_pontual: {
    definicao: "Receita pontual vendida no mês.",
    fonte: FONTE_BITRIX,
    calculo: "Soma de valor_pontual dos deals ganhos.",
  },
  contratos_vendidos_mrr: {
    definicao: "Quantidade de deals com MRR fechados no mês.",
    fonte: FONTE_BITRIX,
    calculo: "Contagem de deals ganhos com valor_recorrente > 0. Orçado = meta de vendas ÷ AOV orçado.",
  },
  contratos_vendidos_pontual: {
    definicao: "Quantidade de deals pontuais fechados no mês.",
    fonte: FONTE_BITRIX,
    calculo: "Contagem de deals ganhos com valor_pontual > 0. Orçado = meta ÷ AOV orçado.",
  },
  aov_venda_mrr: {
    definicao: "Ticket médio dos deals de MRR fechados no mês.",
    fonte: "Derivada.",
    calculo: "Vendas MRR ÷ contratos vendidos MRR. YTD = Σ vendas ÷ Σ contratos.",
  },
  aov_venda_pontual: {
    definicao: "Ticket médio dos deals pontuais fechados no mês.",
    fonte: "Derivada.",
    calculo: "Vendas Pontual ÷ contratos vendidos pontual. YTD = Σ ÷ Σ.",
  },
  vp_receita_total: {
    definicao: "Receita total vendida no mês (MRR + Pontual), por data de criação do contrato.",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado (exceto status "não usar").',
    calculo: "Σ valorr + Σ valorp dos contratos criados no mês. Orçado = vendas_mrr + vendas_pontual.",
  },
  vp_receita_mrr: {
    definicao: "MRR novo vendido no mês (bookings; não é a base ativa).",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado.',
    calculo: "Σ valorr dos contratos criados no mês. Orçado = vendas_mrr.",
  },
  vp_receita_pontual: {
    definicao: "Receita pontual vendida no mês.",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado.',
    calculo: "Σ valorp dos contratos criados no mês. Orçado = vendas_pontual.",
  },
  vp_num_contratos: {
    definicao: "Contratos vendidos no mês (com receita), por segmento.",
    fonte: 'ClickUp — "Clickup".cup_contratos, por data_criado.',
    calculo: "Σ contratos com MRR + Σ contratos pontuais por segmento (= soma das linhas por produto). Um contrato com MRR e Pontual conta nas duas naturezas — mesma base do orçado (Σ contratos_vendidos_*).",
  },
  vp_num_clientes: {
    definicao: "Clientes novos no mês — datados pela criação do cliente (1ª venda).",
    fonte: 'ClickUp — "Clickup".cup_contratos (cup_clientes não tem data de criação).',
    calculo: "Cliente contado uma vez, no mês do seu 1º contrato (MIN data_criado por id_task). Sem orçado.",
  },
  reunioes: {
    definicao: "Reuniões comerciais realizadas no mês.",
    fonte: "Bitrix CRM — deals com data_reuniao_realizada no mês (qualquer estágio).",
    calculo: "Contagem de reuniões realizadas, contra a meta de Reuniões Necessárias da aba CAC.",
  },
  taxa_conversao: {
    definicao: "Quantas reuniões viram negócio fechado.",
    fonte: FONTE_BITRIX,
    calculo: "Deals ganhos no mês ÷ reuniões realizadas no mês (aproximação de coorte — o deal pode fechar em mês diferente da reunião). YTD = Σ ganhos ÷ Σ reuniões.",
  },

  // ===== Capacity =====
  cap_contratos_performance: {
    definicao: "Contratos de Performance ativos no fim do mês.",
    fonte: FONTE_SNAPSHOT,
    calculo: "Mesma série da aba Revenue (Contratos — Performance).",
  },
  gestores_necessarios: {
    definicao: "Quantos gestores a base atual exige pela capacity planejada.",
    fonte: "Derivada.",
    calculo: "Contratos Performance reais ÷ capacity orçada (12 contratos/gestor, da aba CSV da planilha).",
  },
  gestores_atuais: {
    definicao: "Gestores de Performance no time hoje.",
    fonte: FONTE_INHIRE,
    calculo: "Contagem de ativos com cargo 'Gestor de Performance'. Acima do plano = vermelho (headcount é custo).",
  },
  necessidade_gestores: {
    definicao: "Quantos gestores faltam (positivo) ou sobram (negativo) vs a base real.",
    fonte: "Derivada.",
    calculo: "Gestores necessários − gestores atuais. Sem cor: atingimento sobre orçado negativo não tem leitura.",
  },
  contratos_por_gestor: {
    definicao: "Carga média real por gestor.",
    fonte: "Derivada.",
    calculo: "Contratos Performance ÷ gestores atuais. Capacity planejada: 12 — acima do orçado é eficiência, mas risco de churn por sobrecarga.",
  },
  designers_necessarios: {
    definicao: "Designers exigidos pela base atual.",
    fonte: "Derivada.",
    calculo: "Contratos Performance ÷ capacity orçada (26 contas/designer).",
  },
  designers_atuais: {
    definicao: "Designers no time hoje.",
    fonte: FONTE_INHIRE,
    calculo: "Contagem de ativos com cargo 'Designer' — pode incluir designers fora da operação de Performance.",
  },
  contas_por_designer: {
    definicao: "Carga média real por designer.",
    fonte: "Derivada.",
    calculo: "Contratos Performance ÷ designers atuais.",
  },

  // ===== SG&A (detalhamento) =====
  sga_total_detalhe: {
    definicao: "SG&A na visão da aba SG&A da planilha (Caju integral + Software).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Soma das 8 sub-linhas. Difere da linha SG&A do DRE: lá o Caju é rateado com CSV e Software fica no Stack.",
  },
  sga_uzk: {
    definicao: "Pró-labore dos sócios (UZK).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.09 (Pro-labore).",
  },
  sga_backoffice: {
    definicao: "Time de backoffice: financeiro, dados, gente & gestão, jurídico.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 06.08.x.",
  },
  sga_software: {
    definicao: "Softwares gerenciais e administrativos.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.10.01. No DRE esta categoria compõe o CSV Stack.",
  },
  sga_ocupacao: {
    definicao: "Custo de ocupação: aluguel, condomínio, energia, limpeza, expediente.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 06.02.x.",
  },
  beneficio_total_empresa: {
    definicao: "Benefício Caju da empresa inteira (sem rateio).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.10.04 integral. No DRE este valor é rateado entre CSV e SG&A pela fração orçada.",
  },
  sga_premiacoes: {
    definicao: "Premiações, uniformes e brindes internos.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.10.08 (inclui uniformes e brindes).",
  },
  sga_eventos: {
    definicao: "Eventos e confraternizações internas.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.10.06 (Confraternizações).",
  },
  sga_outras: {
    definicao: "Demais despesas administrativas.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 06.01 (Turbooh), 06.03 (tarifas/juros), 06.10.02 (consultorias), 06.10.03 (cursos) e 06.10.07.",
  },

  // ===== CAC (detalhamento) =====
  cac_total_detalhe: {
    definicao: "Despesa total de aquisição no mês.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Soma das sub-linhas comerciais — idêntica à linha CAC do DRE (mesmos prefixos de categoria).",
  },
  cac_pre_vendas: {
    definicao: "Salários do time de pré-vendas (SDRs).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.04.03.",
  },
  cac_vendas: {
    definicao: "Salários do time de vendas (closers).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.04.02 (Inside Sales).",
  },
  cac_gerencia: {
    definicao: "Gestão comercial.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.04.01 (Gestor Comercial).",
  },
  cac_comissoes: {
    definicao: "Comissões sobre vendas.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 06.04.04 (Comissão Comercial) e 06.04.05 (Indique e Ganhe).",
  },
  cac_growth: {
    definicao: "Time de growth/marketing interno.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.06.02.",
  },
  cac_ads: {
    definicao: "Mídia paga de aquisição.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.06.01 (Despesas com Anúncios).",
  },
  cac_eventos: {
    definicao: "Eventos comerciais e de marca.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.07.01.",
  },
  cac_brindes: {
    definicao: "Brindes para clientes e prospects.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categoria 06.07.02.",
  },
  cac_viagens: {
    definicao: "Viagens e locomoção comercial.",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 05.04.02 (Locomoção) e 06.05.04 (Viagens/Reuniões/Coworking).",
  },
  cac_outras_sub: {
    definicao: "Despesas comerciais sem linha no BP (não orçadas).",
    fonte: FONTE_CAZ_CAIXA,
    calculo: "Categorias 06.05.05 (Outras Despesas Comerciais) e 06.07.03 (Patrocínios).",
  },
  cac_por_cliente: {
    definicao: "Quanto custou adquirir cada cliente no mês (base para LTV/CAC).",
    fonte: "Derivada (despesa do Conta Azul ÷ deals do Bitrix).",
    calculo: "Despesa CAC ÷ deals ganhos no mês (proxy de clientes — o CRM não separa novo de cross-sell). Orçado ÷ deals esperados pelo BP (reuniões × conversão).",
  },
  cac_por_contrato: {
    definicao: "Quanto custou cada contrato vendido no mês (um deal costuma gerar mais de um contrato).",
    fonte: "Derivada (despesa do Conta Azul ÷ contratos criados no ClickUp).",
    calculo: "Despesa CAC ÷ contratos criados no mês (cup_contratos por data_criado, recorrentes + pontuais, exceto status 'não usar'; entregas Creators do mesmo cliente contam como um contrato). Mesma contagem da sub-aba Vendas por Produto. Comparável ao CAC por cliente — fica menor porque um deal gera mais de um contrato. Numerador em regime de caixa (data de pagamento) e denominador por data de criação do contrato. Orçado ÷ contratos vendidos orçados. YTD = Σ ÷ Σ.",
  },
  cac_pct_receita: {
    definicao: "Quanto de cada real novo foi consumido para adquiri-lo.",
    fonte: "Derivada.",
    calculo: "Despesa CAC ÷ (Vendas MRR + Vendas Pontual) do mês. YTD = Σ ÷ Σ.",
  },
  cac_payback_mrr: {
    definicao: "Quantos meses do MRR vendido pagam a aquisição do mês.",
    fonte: "Derivada.",
    calculo: "Despesa CAC ÷ Vendas MRR do mês. YTD = Σ ÷ Σ.",
  },

  // ===== Pontual (movimento do estoque) =====
  pontual_estoque_ini: {
    definicao: "Valor do estoque de pontual no fim do mês anterior (posição de abertura).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês anterior (valorp>0, status fora de entregue/cancelado/não usar).",
    calculo: "Soma de valorp dos contratos em estoque no snapshot anterior. Janeiro abre com dez/2025.",
  },
  pontual_venda: {
    definicao: "Pontual que entrou no estoque no mês (entrada).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos em estoque no snapshot do mês que não estavam em estoque no anterior. Não é o 'Vendas Pontual' do Bitrix.",
  },
  pontual_reativacao: {
    definicao: "Parte da 'Entrada na foto' referente a contratos que estavam FORA do estoque no snapshot anterior (ex.: pausados) e voltaram a entrar.",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que entraram no estoque e já apareciam no snapshot anterior (fora do estoque). Sub-conjunto de pontual_entrada, não soma de novo na ponte.",
  },
  pontual_entrega: {
    definicao: "Pontual que saiu do estoque por entrega no mês (saída).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que estavam em estoque e passaram a status 'entregue'.",
  },
  pontual_churn: {
    definicao: "Pontual que saiu do estoque por cancelamento no mês (saída).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que estavam em estoque e passaram a 'cancelado/inativo' ou 'não usar'.",
  },
  pontual_deletados: {
    definicao: "Pontual que sumiu do snapshot do ClickUp no mês (saída).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que estavam em estoque e não aparecem mais no snapshot do mês.",
  },
  pontual_saida_atipica: {
    definicao: "Pontual que saiu do estoque por outro motivo (ex.: valorp zerado).",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ valorp dos contratos que saíram do estoque sem ser entrega, churn ou deleção.",
  },
  pontual_reajuste: {
    definicao: "Variação de valor de contratos que permaneceram no estoque no mês.",
    fonte: "ClickUp — diferença entre snapshots de cup_data_hist.",
    calculo: "Σ (valorp atual − valorp anterior) dos contratos presentes no estoque nos dois snapshots.",
  },
  pontual_estoque_fim: {
    definicao: "Valor do estoque de pontual no fim do mês (posição de fechamento).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês (valorp>0, status fora de entregue/cancelado/não usar).",
    calculo: "Estoque inicial + venda − entrega − churn − deletados − saída atípica + reajuste.",
  },
  pontual_status_ativo: {
    definicao: "Parte do estoque final em contratos com status ativo (em execução).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'ativo'.",
  },
  pontual_status_triagem: {
    definicao: "Parte do estoque final em contratos em triagem.",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'triagem'.",
  },
  pontual_status_pausado: {
    definicao: "Parte do estoque final em contratos pausados.",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'pausado'.",
  },
  pontual_status_onboarding: {
    definicao: "Parte do estoque final em contratos em onboarding.",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'onboarding'.",
  },
  pontual_status_em_cancelamento: {
    definicao: "Parte do estoque final em contratos em cancelamento (ainda contam como estoque).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Σ valorp dos contratos em estoque com status 'em cancelamento'.",
  },
  pontual_status_outros: {
    definicao: "Parte do estoque final em contratos com outros status (defensiva).",
    fonte: "ClickUp — cup_data_hist, último snapshot do mês.",
    calculo: "Estoque final menos a soma dos cinco status conhecidos.",
  },

  // ===== Outras Receitas (detalhamento) =====
  or_total_detalhe: {
    definicao: "Total de outras receitas — idêntico à linha do DRE por construção.",
    fonte: FONTE_CAZ_COMP,
    calculo: "Soma das 3 sub-linhas (os predicados particionam o predicado do DRE).",
  },
  or_receita_variavel: {
    definicao: "Receitas variáveis e rebates de parceiros.",
    fonte: FONTE_CAZ_COMP,
    calculo: "Categoria 03.02 (Variáveis e Rebates).",
  },
  or_stack_digital: {
    definicao: "Stack de ferramentas revendido a clientes (Yampi, Shopify, Funnels).",
    fonte: FONTE_CAZ_COMP,
    calculo: "Categorias 03.03.x.",
  },
  or_demais: {
    definicao: "Mentoria, infoproduto, Turbooh e demais receitas.",
    fonte: FONTE_CAZ_COMP,
    calculo: "Categorias 04.01 e 04.03 — Mentoria/Infoproduto/Turbooh não têm categorias próprias no Conta Azul.",
  },
};
