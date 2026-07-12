// scripts/auditoria/catalog.ts

export type Section = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface QuerySpec {
  id: string;                 // matches filename minus .sql
  number: number;             // 1..23
  section: Section;
  title: string;
  hasFinancialImpact: boolean;
  impactColumn?: string;      // column in result rows that holds R$ for sum
  description: string;        // shown in the report
  actionSuggestion: string;
}

export const CATALOG: QuerySpec[] = [
  // Section A — Vazamento
  { id: '01-deals-ganhos-sem-cnpj', number: 1, section: 'A',
    title: 'Deals ganhos sem CNPJ no Bitrix',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Deals em "Negócio Ganho" (pipeline 0) ou "Negócios Fechados" (pipeline 12) sem CNPJ preenchido. Sem CNPJ é fisicamente impossível casar com o ERP.',
    actionSuggestion: 'Comercial: preencher CNPJ retroativo nos deals listados. Curto prazo: tornar campo obrigatório nos stages de fechamento.' },
  { id: '02-deals-ganhos-sem-cliente-caz', number: 2, section: 'A',
    title: 'Deals ganhos com CNPJ válido mas sem cliente no Conta Azul',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Deal tem CNPJ, CNPJ validou no módulo 11, mas não existe cliente correspondente em nenhuma das duas empresas do CAZ.',
    actionSuggestion: 'Financeiro: criar cadastro do cliente no CAZ e iniciar cobrança.' },
  { id: '03-deals-com-cliente-sem-parcela', number: 3, section: 'A',
    title: 'Deals ganhos com cliente no CAZ mas sem parcela aberta há 90 dias',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Cadastro existe mas ninguém criou a primeira parcela (ou a recorrência foi pausada e esquecida).',
    actionSuggestion: 'Financeiro: validar contrato e gerar parcelas pendentes.' },
  { id: '04-contratos-cup-sem-cliente-caz', number: 4, section: 'A',
    title: 'Contratos ativos no ClickUp sem cliente no Conta Azul',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Caminho alternativo do mesmo vazamento: contratos que entraram direto na operação sem passar pelo CRM.',
    actionSuggestion: 'CS + Financeiro: validar e cadastrar.' },
  { id: '05-contratos-cup-sem-recorrente', number: 5, section: 'A',
    title: 'Contratos ativos no ClickUp sem parcela recorrente nos últimos 60 dias',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Cliente existe nos dois sistemas, contrato ativo, mas a recorrência mensal não está sendo gerada.',
    actionSuggestion: 'Financeiro: investigar por que parou de gerar e regularizar.' },

  // Section B — Sub-cobrança
  { id: '06-mrr-contratado-vs-cobrado', number: 6, section: 'B',
    title: 'MRR contratado ≠ MRR cobrado (sub-cobrança)',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Diferença positiva entre cup_contratos.valorr e a média mensal das parcelas recorrentes do cliente nos últimos 6 meses.',
    actionSuggestion: 'Financeiro: revisar contratos e ajustar valor cobrado.' },
  { id: '07-valor-pontual-sem-parcela', number: 7, section: 'B',
    title: 'Valor pontual no Bitrix sem parcela pontual no CAZ',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Deals com valor_pontual > 0 que não geraram cobrança pontual no CAZ na janela ±60 dias do fechamento.',
    actionSuggestion: 'Financeiro: cobrar valor pontual retroativo.' },
  { id: '08-reajustes-nao-refletidos', number: 8, section: 'B',
    title: 'Reajustes contratados não refletidos no faturamento (exploratório)',
    hasFinancialImpact: true, impactColumn: 'impacto_estimado_rs',
    description: 'Heurística: cup_data_hist mostra valorr maior que 6 meses atrás, mas as parcelas recorrentes do CAZ continuam no valor antigo. Risco alto de falso positivo.',
    actionSuggestion: 'Financeiro: validar caso a caso — é exploratório.' },

  // Section C — Pós-churn
  { id: '09-encerrados-com-parcelas-abertas', number: 9, section: 'C',
    title: 'Contratos encerrados com parcelas ainda abertas (risco jurídico)',
    hasFinancialImpact: true, impactColumn: 'valor_bruto',
    description: 'Cobrança ativa em cliente que já cancelou. Risco jurídico/reputação.',
    actionSuggestion: 'Financeiro: cancelar parcelas indevidas imediatamente.' },
  { id: '10-inadimplencia-pos-churn', number: 10, section: 'C',
    title: 'Inadimplência pós-churn > 90 dias',
    hasFinancialImpact: true, impactColumn: 'nao_pago',
    description: 'Parcelas não pagas há mais de 90 dias de clientes já encerrados — provisão de perda real.',
    actionSuggestion: 'Financeiro: provisionar como perda ou negativar.' },

  // Section D — Higiene (sem $)
  { id: '11-duplicatas-cnpj-cup', number: 11, section: 'D',
    title: 'Duplicatas de CNPJ em cup_clientes', hasFinancialImpact: false,
    description: 'Mesmo CNPJ aparece em mais de um registro de cup_clientes.',
    actionSuggestion: 'CS: deduplicar manualmente.' },
  { id: '12-duplicatas-cnpj-caz', number: 12, section: 'D',
    title: 'Duplicatas de CNPJ em caz_clientes', hasFinancialImpact: false,
    description: 'Mesmo CNPJ aparece em mais de um registro de caz_clientes (considerando ambas as empresas).',
    actionSuggestion: 'Financeiro: mesclar cadastros.' },
  { id: '13-cup-sem-cnpj', number: 13, section: 'D',
    title: 'Clientes em cup_clientes sem CNPJ', hasFinancialImpact: false,
    description: 'Cadastro de cliente sem CNPJ — impossível casar com CAZ.',
    actionSuggestion: 'CS: completar cadastro.' },
  { id: '14-caz-sem-cnpj', number: 14, section: 'D',
    title: 'Clientes em caz_clientes sem CNPJ', hasFinancialImpact: false,
    description: 'Cadastro financeiro sem CNPJ.',
    actionSuggestion: 'Financeiro: completar cadastro.' },
  { id: '15-cnpjs-malformados', number: 15, section: 'D',
    title: 'CNPJs malformados em qualquer fonte', hasFinancialImpact: false,
    description: 'CNPJs preenchidos que não passam na validação módulo 11.',
    actionSuggestion: 'Corrigir nas três fontes.' },
  { id: '16-nomes-divergentes-cup-caz', number: 16, section: 'D',
    title: 'Mesmo CNPJ, nomes muito divergentes entre ClickUp e CAZ', hasFinancialImpact: false,
    description: 'Similaridade de nomes < 0.3 via pg_trgm — sinal de cadastro errado em um dos dois lados.',
    actionSuggestion: 'CS+Financeiro: investigar e padronizar nome.' },

  // Section E — Status divergente
  { id: '17-cup-inativo-com-parcelas', number: 17, section: 'E',
    title: 'Cliente inativo no ClickUp ainda recebendo parcelas',
    hasFinancialImpact: true, impactColumn: 'valor_pago',
    description: 'Parcela quitada > 30 dias após cancelamento no ClickUp. Pode indicar cobrança indevida ou falta de baixa no CRM.',
    actionSuggestion: 'CS: validar e dar baixa correta.' },
  { id: '18-cup-ativo-sem-parcela-6m', number: 18, section: 'E',
    title: 'Cliente ativo no ClickUp sem parcela há > 6 meses', hasFinancialImpact: false,
    description: 'Sintoma de churn não registrado — provavelmente já cancelou na prática mas o CRM não foi atualizado.',
    actionSuggestion: 'CS: validar status real.' },

  // Section F — Cross-CRM
  { id: '19-bitrix-perdido-cup-ativo', number: 19, section: 'F',
    title: 'Deal perdido no Bitrix mas cliente ativo no ClickUp', hasFinancialImpact: false,
    description: 'Recuperação que nunca foi atualizada no CRM — distorce taxa de conversão.',
    actionSuggestion: 'Comercial: atualizar deal pra Negócio Ganho.' },
  { id: '20-cup-ativo-sem-deal', number: 20, section: 'F',
    title: 'Cliente ativo no ClickUp sem deal correspondente no Bitrix', hasFinancialImpact: false,
    description: 'Origem desconhecida — possível comissionamento órfão.',
    actionSuggestion: 'Comercial: rastrear origem.' },

  // Section G — Cobertura
  { id: '21-pct-cnpj-por-pipeline', number: 21, section: 'G',
    title: '% de CNPJ preenchido por pipeline no Bitrix', hasFinancialImpact: false,
    description: 'Cobertura de CNPJ por pipeline. Smoking gun.',
    actionSuggestion: 'Bitrix admin: tornar CNPJ obrigatório.' },
  { id: '22-pct-stage-semantic', number: 22, section: 'G',
    title: '% de stage_semantic preenchido por pipeline', hasFinancialImpact: false,
    description: 'Bug de ETL — campo deveria estar populado com S/F/P, mas está vazio em ~99,9% dos deals.',
    actionSuggestion: 'Tech: investigar ETL Bitrix.' },
  { id: '23-campos-criticos-vazios', number: 23, section: 'G',
    title: 'Top campos críticos vazios em cada sistema', hasFinancialImpact: false,
    description: 'Visão geral dos buracos de dado.',
    actionSuggestion: 'Cada área: priorizar preenchimento.' },
];

export const SECTION_TITLES: Record<Section, string> = {
  A: '🩸 Vazamento de caixa',
  B: '💧 Sub-cobrança',
  C: '🪦 Pós-churn',
  D: '🪪 Saúde de cadastro',
  E: '🔄 Status divergente',
  F: '🪞 Cross-CRM',
  G: '🔭 Cobertura de dado',
};
