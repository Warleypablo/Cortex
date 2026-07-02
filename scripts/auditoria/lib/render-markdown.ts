// scripts/auditoria/lib/render-markdown.ts
import { CATALOG, SECTION_TITLES, type QuerySpec, type Section } from '../catalog.js';
import type { QueryResult } from './run-query.js';
import { formatBRL } from './format-currency.js';

export interface ReportInput {
  date: string;
  results: Array<{ spec: QuerySpec; result: QueryResult }>;
}

function sumImpact(spec: QuerySpec, rows: Record<string, unknown>[]): number {
  if (!spec.hasFinancialImpact || !spec.impactColumn) return 0;
  return rows.reduce((acc, row) => {
    const v = row[spec.impactColumn!];
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function topRows(rows: Record<string, unknown>[], n: number): Record<string, unknown>[] {
  return rows.slice(0, n);
}

function rowsToTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '_(sem linhas)_';
  const cols = Object.keys(rows[0]);
  const header = '| ' + cols.join(' | ') + ' |';
  const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
  const body = rows.map(r => '| ' + cols.map(c => {
    const v = r[c];
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isFinite(v) ? v.toLocaleString('pt-BR') : '';
    return String(v).replace(/\|/g, '\\|').slice(0, 60);
  }).join(' | ') + ' |').join('\n');
  return [header, sep, body].join('\n');
}

export function renderMarkdown(input: ReportInput): string {
  const { date, results } = input;

  const impacts = results.map(r => ({
    spec: r.spec,
    total: r.result.total,
    impact: sumImpact(r.spec, r.result.rows),
    error: r.result.error,
  }));

  const totalImpact = impacts.reduce((a, b) => a + b.impact, 0);
  const top5 = [...impacts].filter(i => i.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 5);

  const headerBlock = `# Auditoria CRM → ERP — ${date}

> Diagnóstico end-to-end do funil Bitrix → ClickUp → Conta Azul. Janela: últimos 12 meses. Multi-empresa unificada (Turbo Partners + PEIXOTO DEBBANE).

## 🎯 Headline

**${formatBRL(totalImpact)} deixados na mesa nos últimos 12 meses** (estimativa worst case, soma de todas as categorias com impacto financeiro).

${impacts.filter(i => !i.spec.hasFinancialImpact && i.total > 0).reduce((acc, i) => acc + i.total, 0)} cadastros bagunçados sem impacto financeiro direto, mas que sustentam o vazamento.

## 🔥 Top 5 Vazamentos por R$ Impacto

| # | Categoria | Ocorrências | R$ Impacto | Ação |
|---|---|---:|---:|---|
${top5.map((i, idx) => `| ${idx + 1} | ${i.spec.title} | ${i.total} | ${formatBRL(i.impact)} | ${i.spec.actionSuggestion.split('.')[0]}. |`).join('\n')}

## ⚡ 3 Ações de Maior ROI Imediato

1. **Tornar CNPJ obrigatório no Bitrix antes de mover pra "Negócio Ganho"** — bloqueia futuros vazamentos da categoria 01 (raiz do problema). Esforço: baixo. Recupera: ~${formatBRL(impacts.find(i => i.spec.id === '01-deals-ganhos-sem-cnpj')?.impact ?? 0)} de potencial nos próximos 12 meses.
2. **Auditar caso a caso os deals da categoria 02** — clientes vendidos com CNPJ válido mas sem cadastro no CAZ. Lista no CSV anexo. Esforço: médio. Recupera: ${formatBRL(impacts.find(i => i.spec.id === '02-deals-ganhos-sem-cliente-caz')?.impact ?? 0)}.
3. **Cancelar parcelas indevidas de contratos encerrados (categoria 09)** — risco jurídico imediato, ${impacts.find(i => i.spec.id === '09-encerrados-com-parcelas-abertas')?.total ?? 0} casos. Esforço: baixo. Mitigação: ${formatBRL(impacts.find(i => i.spec.id === '09-encerrados-com-parcelas-abertas')?.impact ?? 0)} de exposição.

## Metodologia

- **Janela:** 12 meses, capada nos multiplicadores temporais.
- **"Deal ganho":** \`stage_name\` em ('Negócio Ganho', 'Negócios Fechados') nas pipelines 0 (Geral) e 12 (Cross Sell e Upsell). Universo: 611 deals.
- **Multi-empresa:** Turbo Partners + PEIXOTO DEBBANE unificadas (cliente "existe" se aparece em qualquer das duas).
- **CNPJ normalizado:** \`LPAD(REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g'), 14, '0')\` aplicado nas 3 fontes.
- **Recorrente:** \`tipo_fatura\` está vazio em 100% das parcelas (bug ETL); usamos categoria \`03.01.01 Receita de Serviços\` como proxy.
- **Estimativas são teto (worst case)**, não previsão. Cada caso precisa ser validado antes de virar planilha de cobrança.

## Achados de estrutura (smoking guns)

1. **DATABASE.md desatualizado:** \`crm_deal\` tem colunas \`cnpj\`, \`valor_recorrente\`, \`valor_pontual\`, \`closer\`, \`sdr\`, \`funil\`, \`empresa\`, \`data_fechamento\`, \`produtos\`, \`stage_semantic\` que não estão documentadas.
2. **\`crm_deal.stage_semantic\` está vazio em ~99,9% dos deals** — campo deveria ter S/F/P. Provável bug de ETL.
3. **Pipeline "Pós-Ganho" → stage "Subir/Ajustar Cobrança"** existe com 101 deals e zero CNPJ. Literalmente "fila pra dar entrada no financeiro" sem o dado mais básico.
4. **\`caz_parcelas.tipo_fatura\` 100% NULL** — coluna existe mas nunca foi populada. Impossível distinguir recorrente de pontual sem heurística.
5. **\`crm_deal.empresa\` 100% vazio nos deals ganhos** — não dá pra direcionar deal → empresa CAZ.
`;

  // Render sections
  const sections: Section[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const sectionBlocks = sections.map(section => {
    const sectionResults = results.filter(r => r.spec.section === section);
    const sectionImpact = sectionResults.reduce((acc, r) => acc + sumImpact(r.spec, r.result.rows), 0);
    const sectionHeader = `\n## ${SECTION_TITLES[section]}${sectionImpact > 0 ? ` — ${formatBRL(sectionImpact)} de impacto` : ''}\n`;

    const catBlocks = sectionResults.map(({ spec, result }) => {
      const impact = sumImpact(spec, result.rows);
      const top = topRows(result.rows, 10);
      if (result.error) {
        return `\n### Categoria ${spec.number} — ${spec.title}\n\n⚠️ **Erro ao executar:** \`${result.error}\`\n`;
      }
      if (result.total === 0) {
        return `\n### Categoria ${spec.number} — ${spec.title}\n\n✅ Nenhum problema encontrado.\n`;
      }
      return `\n### Categoria ${spec.number} — ${spec.title}

**Problema:** ${spec.description}

**Total:** ${result.total} ocorrências${spec.hasFinancialImpact ? ` &nbsp;·&nbsp; **Impacto estimado:** ${formatBRL(impact)} (worst case)` : ''}

**Ação sugerida:** ${spec.actionSuggestion}

**Top 10 piores:**

${rowsToTable(top)}

**CSV completo:** [csv/${spec.id}.csv](${date}/csv/${spec.id}.csv) (${result.total} linhas)
`;
    }).join('');

    return sectionHeader + catBlocks;
  }).join('');

  const footer = `

## Próximos Passos Recomendados

Ordenado por ROI (impacto × facilidade de execução):

${[...impacts].filter(i => i.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 8).map((i, idx) =>
  `${idx + 1}. **[Cat ${i.spec.number}] ${i.spec.title}** — ${formatBRL(i.impact)} potencial. ${i.spec.actionSuggestion}`
).join('\n')}

## Sub-tasks de remediação sugeridas (não implementadas aqui)

- \`[ETL]\` Investigar por que \`crm_deal.stage_semantic\` está vazio em ~99,9% dos deals
- \`[ETL]\` Investigar por que \`caz_parcelas.tipo_fatura\` está 100% NULL
- \`[DOC]\` Atualizar \`DATABASE.md\` com colunas reais de \`crm_deal\`
- \`[BITRIX]\` Tornar CNPJ obrigatório nos stages de fechamento ("Negócio Ganho", "Negócios Fechados")
- \`[BITRIX]\` Preencher campo \`empresa\` nos deals para permitir routing por empresa
- \`[ClickUp]\` Validar CNPJ no momento de criação do cliente (módulo 11)

## Anexo — Limitações conhecidas

1. Estimativas são **teto** (worst case), não previsão. Cada caso precisa ser validado individualmente antes de virar cobrança real.
2. **Categoria 08 (reajustes) é exploratória** — pode vir com falsos positivos altos.
3. Comissionamento por venda errada **não está coberto** (fora de escopo).
4. **Cobrança paralela fora do CAZ** (Pix sem registro) não é detectável — pode aparecer aqui como falso positivo de vazamento.
5. **Pipelines do Bitrix além de 0 e 12** (BootCamps, Pós-Ganho, Outbound, Inbound) **não entram** no universo de "ganho" desta auditoria por decisão do escopo.
6. **Auditoria de despesas** (\`tipo_evento='DESPESA'\`) está fora — escopo é receita.
7. **Validação módulo 11 de CNPJ** na categoria 15 está em modo grosso (length+repetidos). Validação completa fica para evolução do script.

---

_Gerado por \`scripts/auditoria-crm-erp.ts\` em ${new Date().toISOString()}._
`;

  return headerBlock + sectionBlocks + footer;
}
