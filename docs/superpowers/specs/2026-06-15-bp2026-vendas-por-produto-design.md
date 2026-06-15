# BP 2026 — Vendas por Produto

**Data:** 2026-06-15
**Branch:** `feature/bp2026-vendas-por-produto`
**Status:** Design aprovado, aguardando review do spec

## Objetivo

Detalhar a sub-aba "Funil Comercial" do BP 2026 por **serviço/produto**, espelhando a
planilha de orçado de vendas por produto (aba CAC). Nova sub-aba "Vendas por Produto":
matriz **serviço × mês** com realizado·orçado·atingimento, para as métricas de venda.

A tela atual (Funil Comercial) mostra Vendas MRR/Pontual, Contratos e AOV **agregados**.
O código já documentava a quebra por produto como "indisponível" (`bp2026.funil.ts:16`)
porque o CRM guarda o campo de produtos como lista de IDs sem split de valor. Este design
resolve isso decodificando os IDs e definindo uma regra de atribuição de valor por serviço.

## Escopo

**Dentro:** quebra por produto de — Vendas MRR (R$), Vendas Pontual (R$),
Contratos vendidos MRR, Contratos vendidos Pontual, AOV MRR, AOV Pontual, % mix.

**Fora:** *Reuniões realizadas* e *Taxa de conversão* — são topo de funil, sem produto
associado; permanecem apenas no Funil agregado.

## Segmentos do BP

| Natureza | Segmentos nomeados | Catch-all |
|----------|--------------------|-----------|
| Recorrente (→ Vendas MRR) | Performance, Creators, Social, Gestão de Comunidade | Others |
| Pontual (→ Vendas Pontual) | E-commerce, Site Institucional, Landing Page | Others |

## De-para de serviço (decodificado da API Bitrix)

Campo `UF_CRM_1755009751812` (tipo *enumeration*) — é o que vira `servicos_vendidos`
/`produtos` na `Bitrix.crm_deal` (ambas as colunas são idênticas, 394/394 deals iguais).
Materializar como **constante versionada no backend** (não há catálogo no banco).

| ID | Serviço (Bitrix) | Natureza | Segmento BP |
|----|------------------|----------|-------------|
| 846 | Gestão de Performance | recorrente | Performance |
| 852 | Creators Recorrente | recorrente | Creators |
| 848 | Social Media | recorrente | Social |
| 870 | Gestão de Comunidade | recorrente | Gestão de Comunidade |
| 876 | Personalizado Recorrente | recorrente | Others |
| 858 | Sustentação | recorrente | Others |
| 860 | E-mail Marketing | recorrente | Others |
| 854 | CRM | recorrente | Others |
| 878 | SEO Full | recorrente | Others |
| 1678 | Turbooh | recorrente | Others |
| 864 | Automação | recorrente | Others |
| 866 | Blog Post | recorrente | Others |
| 884 | Agente de IA | recorrente | Others |
| 868 | E-commerce | pontual | E-commerce |
| 880 | Site Institucional | pontual | Site Institucional |
| 882 | Landing Page | pontual | Landing Page |
| 850 | Creators Pontual | pontual | Others |
| 856 | CRO Pontual | pontual | Others |
| 874 | Personalizado Pontual | pontual | Others |
| 1684 | TikTok Shop | pontual | Others |
| 872 | Identidade Visual | pontual | Others |
| 862 | Estruturação Estratégica | pontual | Others |
| 1774 | Estruturação Comercial | pontual | Others |
| 1778 | Estruturação estratégica | pontual | Others |
| 1674 | Fee de Implantação | pontual | Others |

## Realizado por produto — regra em cascata

Fonte base: `Bitrix.crm_deal`, deals `stage_name = 'Negócio Ganho'`, por `data_fechamento`
(mesma fonte que já alimenta o total do funil — garante que **a soma por produto fecha
100% com o total agregado já exibido**).

Para cada deal, separar por natureza: `valor_recorrente` distribui só entre serviços
recorrentes do deal; `valor_pontual` só entre pontuais. A distribuição segue a cascata:

1. **Produto único da natureza** → valor inteiro vai para o serviço. (Determinístico:
   58% do MRR, 84% do Pontual.)
2. **Multi-produto com match no ClickUp** → o ClickUp define o **mix** (proporção entre os
   serviços); aplica-se a proporção ao valor do deal no Bitrix. Match: CNPJ normalizado
   (`regexp_replace(cnpj,'\D','','g')`, LENGTH 14/11) → `cup_clientes.cnpj` →
   `cup_contratos` (via `id_task = cup_clientes.task_id`), considerando contratos cujo
   `produto` ∈ serviços do deal com `valorr`/`valorp > 0`.
3. **Sem match / ClickUp incompleto** → fallback: rateio ponderado pelo **AOV médio** de
   cada serviço, calculado dos deals de produto único (onde o valor é limpo).

**Decisão-chave (passo 2):** usar o ClickUp para a **proporção**, não o valor absoluto.
Ex.: Dra Roberta — ClickUp soma R$ 7.991 (contrato cheio) vs deal R$ 6.000 (com desconto).
Usar absoluto quebraria a consistência com o total do funil; usar o mix mantém o total do
Bitrix e ainda assim a distribuição é real.

- **Contratos por produto** = contagem de ocorrências do serviço nos deals ganhos. Deal
  multi-produto conta 1 em cada serviço → a soma por produto é naturalmente maior que o
  total de contratos (na planilha: 67 vs 50). Comportamento esperado e consistente.
- **AOV por produto** = valor por produto ÷ contratos por produto.
- **% mix** = valor do segmento ÷ total da natureza no mês.

## Orçado por produto

Vem de `server/okr2026/bp2026Targets.ts`. Performance já está modelado
(`sales_mrr_performance_target`, `aov_performance`, `contracts_performance`,
`sales_performance_share_pct`). Completar os demais segmentos (Creators, Social, Gestão de
Comunidade, Others / E-commerce, Site, Landing Page) com os valores da planilha CAC.

## Arquitetura

- **Backend novo:** `server/routes/bp2026.vendasProduto.ts` — monta a matriz serviço × mês
  (realizado via cascata + orçado dos targets). Reusa helpers de `bp2026.helpers.ts`
  (`calcAtingimento`, `calcYtd`).
- **De-para:** constante em `server/okr2026/` (ID → {serviço, natureza, segmento}).
- **Targets:** completar `bp2026Targets.ts`.
- **Endpoint:** integrar ao payload do BP 2026 (padrão de `bp2026.ts` → `montarFunil`),
  expondo as linhas por segmento.
- **Frontend:** nova sub-aba "Vendas por Produto" em `client/src/pages/BP2026.tsx`
  reusando o componente de tabela do BP (`BPDreTable` ou equivalente), agrupando por
  Recorrente/Pontual e por segmento. Dark/light mode obrigatório.

## Setup

A coluna `servicos_vendidos` existe **apenas no prod** hoje. Replicar no banco local
(ou usar a coluna `produtos`, idêntica, no ambiente local durante o desenvolvimento).

## Dados de referência (validados no prod, 2026)

- Deals ganhos com valor: 1 produto = 289 deals; multi = 104; sem produto = 1.
- Split por natureza: MRR 58% determinístico / 40% ambíguo / 1% sem id rec;
  Pontual 84% / 10% / 6%.
- Match ClickUp dos deals com MRR ambíguo: 51/59 (86%) casam por CNPJ.
- Ressalva de timing: deals recentes (mês corrente) frequentemente ainda não têm contrato
  cadastrado no ClickUp → caem no fallback (passo 3). Meses fechados casam bem.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Soma por produto não bater com o total do funil | Total sempre = Bitrix; ClickUp só dá mix → fecha por construção |
| Deal recente sem contrato no ClickUp (timing) | Fallback por AOV médio (passo 3) |
| Cliente com múltiplos contratos do mesmo produto | Somar `valorr`/`valorp` por produto antes de calcular a proporção |
| ID de serviço novo no Bitrix não mapeado | Default → Others (por natureza); logar IDs desconhecidos |
| `servicos_vendidos` só no prod | Replicar local / usar `produtos` no dev |

## Critérios de sucesso

1. Soma das linhas por produto (MRR e Pontual) = total do Funil agregado em cada mês.
2. Os 7 segmentos nomeados + Others aparecem com realizado·orçado·atingimento por mês.
3. Meses fechados refletem o mix real do ClickUp; mês corrente degrada para AOV sem quebrar.
4. Dark/light mode ok.
