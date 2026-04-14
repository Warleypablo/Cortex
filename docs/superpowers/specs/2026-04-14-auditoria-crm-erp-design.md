# Auditoria CRM → ERP — Design

**Data:** 2026-04-14
**Autor:** Brainstorming Warley + Claude
**Status:** Aprovado, aguardando plano de implementação

---

## 1. Contexto

Clientes que avançam no Bitrix até "Negócio Ganho" frequentemente não chegam ao Conta Azul como cobrança ativa. Quando chegam, é comum o CNPJ divergir entre os sistemas, o que impede o JOIN e mascara o problema. Resultado: a empresa opera sem cobrar parte dos clientes vendidos, e ninguém tem uma medida confiável do tamanho do vazamento.

A auditoria precisa entregar duas coisas, na ordem:

1. **O número.** Quanto dinheiro está deixado na mesa hoje, com metodologia defensável.
2. **A planilha.** Lista nominal e priorizada para cada área (Comercial, Financeiro, CS) agir caso a caso.

Tudo de forma one-shot, gerado sob demanda, versionado no git, sem dependência de UI nova.

## 2. Achados pré-brainstorm (gold rápido)

Investigação direta no banco de produção (`34.95.249.110/dados_turbo`) durante o brainstorm já revelou parte do diagnóstico:

### 2.1 Cobertura de CNPJ no Bitrix é catastrófica

Universo de "deals em estágios de fechamento" no Bitrix:

| Pipeline | Stage | Deals | Com CNPJ | % |
|---|---|---:|---:|---:|
| Geral (0) | Negócio Ganho | 608 | 204 | 33,6% |
| Pós-Ganho (8) | Subir/Ajustar Cobrança | 101 | 0 | 0% |
| BootCamps (14) | Negócios Fechados | 25 | 0 | 0% |
| Geral (0) | Contrato assinado | 4 | 0 | 0% |
| Cross Sell e Upsell (12) | Negócios Fechados | 3 | 0 | 0% |
| Pós-Ganho (8) | Fatura | 1 | 0 | 0% |
| Pós-Ganho (8) | Negócios Fechados | 1 | 0 | 0% |

Existe um pipeline inteiro chamado **"Pós-Ganho"** com um stage chamado **"Subir/Ajustar Cobrança"** — literalmente "fila de coisas pra dar entrada no financeiro" — e nenhum dos 101 deals tem CNPJ. É o nó do problema com nome próprio.

Cobertura geral de CNPJ por pipeline:

| Pipeline | Total | Com CNPJ | % |
|---|---:|---:|---:|
| Inbound (4) | 7793 | 0 | 0% |
| Outbound (2) | 3487 | 966 | 27,7% |
| Geral (0) | 2824 | 232 | 8,2% |
| Bot SDR (6) | 1391 | 0 | 0% |
| BootCamps (14) | 321 | 0 | 0% |
| Cross Sell e Upsell (12) | 42 | 1 | 2,4% |

### 2.2 `crm_deal.stage_semantic` está vazio em ~99,9% dos deals

O campo que deveria classificar S/F/P (sucesso/fail/processo) foi populado em apenas 17 das ~16.000 linhas. Provável bug de ETL ou campo nunca implementado na coleta. Identificar `stage_id`/`stage_name` é o único caminho hoje. Vai virar sub-task de remediação no rodapé do relatório.

### 2.3 `crm_deal.empresa` está 100% vazio nos deals ganhos

Não dá pra usar pra direcionar deal → empresa do CAZ. Multi-empresa fica unificada por decisão (ver §4).

### 2.4 `DATABASE.md` está desatualizado

`crm_deal` tem colunas que `DATABASE.md` não documenta: `cnpj`, `valor_recorrente`, `valor_pontual`, `closer`, `sdr`, `funil`, `empresa`, `data_fechamento`, `produtos`, `stage_semantic`. Sub-task de doc no rodapé.

## 3. Decisões aprovadas no brainstorm

| Decisão | Escolha | Implicação |
|---|---|---|
| Entregável | Relatório one-shot (não dashboard, não alerta proativo) | Script + arquivos versionados |
| Escopo | Amplo — saúde de dados ponta a ponta (23 categorias) | Cobre vazamento, sub-cobrança, churn, higiene, status, cross-CRM, cobertura |
| Formato | Markdown + CSVs anexos por categoria | Narrativa pra executivo, planilhas pras áreas |
| Janela | 12 meses + snapshot atual | Estimativas acumuladas, não só fluxo corrente |
| "Deal ganho" | `stage_name='Negócio Ganho'` em pipeline 0 + `stage_name='Negócios Fechados'` em pipeline 12 | Universo: 611 deals |
| Multi-empresa | União Turbo Partners + PEIXOTO DEBBANE | Cliente "existe" se aparece em qualquer das duas |
| Metodologia $ | Ver §6 | Worst case, capado em 12 meses |

## 4. Arquitetura

**Tipo:** Script Node único, executado sob demanda, gera artefatos estáticos versionados no git.

```
scripts/auditoria-crm-erp.ts  (runner)
     │
     ├─→ conecta no prod (read-only) via DATABASE_URL do .env
     ├─→ habilita pg_trgm na sessão (CREATE EXTENSION IF NOT EXISTS)
     ├─→ executa 23 queries SQL em sequência
     │      cada uma retorna: { categoria, descricao, total, impacto_rs, rows[] }
     ├─→ escreve docs/auditoria/2026-04-14-auditoria-crm-erp.md   (relatório)
     ├─→ escreve docs/auditoria/2026-04-14/csv/<NN-slug>.csv      (1 por categoria)
     └─→ imprime no terminal: resumo executivo + tempo de cada query
```

**Stack:**
- Node + tsx (já no projeto)
- `pg` direto (sem Drizzle — queries são raw SQL longas; ORM atrapalha)
- `csv-stringify` (lib leve) pra CSVs
- Markdown gerado por template literal (sem dep extra)

**Layout de arquivos:**

```
scripts/
  auditoria-crm-erp.ts                        # runner
  auditoria/
    queries/
      01-deals-ganhos-sem-cnpj.sql
      02-deals-ganhos-sem-cliente-caz.sql
      03-deals-com-cliente-sem-parcela.sql
      04-contratos-cup-sem-cliente-caz.sql
      05-contratos-cup-sem-recorrente.sql
      06-mrr-contratado-vs-cobrado.sql
      07-valor-pontual-sem-parcela.sql
      08-reajustes-nao-refletidos.sql
      09-encerrados-com-parcelas-abertas.sql
      10-inadimplencia-pos-churn.sql
      11-duplicatas-cnpj-cup.sql
      12-duplicatas-cnpj-caz.sql
      13-cup-sem-cnpj.sql
      14-caz-sem-cnpj.sql
      15-cnpjs-malformados.sql
      16-nomes-divergentes-cup-caz.sql
      17-cup-inativo-com-parcelas.sql
      18-cup-ativo-sem-parcela-6m.sql
      19-bitrix-perdido-cup-ativo.sql
      20-cup-ativo-sem-deal.sql
      21-pct-cnpj-por-pipeline.sql
      22-pct-stage-semantic.sql
      23-campos-criticos-vazios.sql
    lib/
      normalize-cnpj.ts
      validate-cnpj.ts          # módulo 11
      format-currency.ts
      render-markdown.ts
      render-csv.ts
      run-query.ts              # wrapper com timing + erro graceful
    templates/
      report.md.tpl             # opcional — pode ficar inline no runner
docs/
  auditoria/
    2026-04-14-auditoria-crm-erp.md
    2026-04-14/
      csv/
        01-deals-ganhos-sem-cnpj.csv
        ...
        23-campos-criticos-vazios.csv
package.json   # adicionar script "auditoria-crm-erp"
```

**Por que script e não rota Express?** O usuário pediu one-shot. Rota traz fricção (auth, log, deploy). Script local roda em 30–90s, gera arquivos versionáveis, pode ser re-executado quando quiser. Se um dia virar dashboard, as 23 queries já estão isoladas em arquivos `.sql` — só envelopa em endpoint.

## 5. Catálogo de verificações (23 categorias)

Cada item lista: lógica de detecção (alta nível), impacto financeiro (se houver) e colunas do CSV.

### 5.A 🩸 Vazamento de caixa

#### 01. Deals ganhos sem CNPJ — `$`
- **Lógica:** `crm_deal WHERE category_id IN (0,12) AND stage_name IN ('Negócio Ganho','Negócios Fechados') AND (cnpj IS NULL OR TRIM(cnpj)='')`
- **Impacto:** `Σ valor_recorrente × meses_desde_data_fechamento (cap 12)` + `Σ valor_pontual`
- **CSV:** `id_deal, title, company_name, contact_name, closer, sdr, data_fechamento, valor_recorrente, valor_pontual, meses_aberto, impacto_estimado_rs, link_bitrix`

#### 02. Deals ganhos com CNPJ válido mas sem cliente no CAZ — `$`
- **Lógica:** deals ganhos + CNPJ preenchido + `normalize_cnpj(deal.cnpj)` NÃO existe em `caz_clientes` (nas duas empresas) **nem** por fuzzy match de nome (`similarity(deal.company_name, caz.nome) > 0.6`).
- **Impacto:** igual #01.
- **CSV:** `id_deal, cnpj_normalizado, title, company_name, melhor_match_caz_nome, similaridade, valor_recorrente, valor_pontual, impacto`

#### 03. Deals ganhos com cliente no CAZ mas sem parcela aberta há 90 dias — `$`
- **Lógica:** deal ganho ↔ caz_cliente OK, mas `NOT EXISTS (caz_parcelas WHERE id_cliente = caz.ids AND tipo_evento='receita' AND data_vencimento >= NOW() - INTERVAL '90 days')`
- **Impacto:** `valor_recorrente × meses_sem_cobranca (cap 12)`
- **CSV:** `id_deal, cnpj, cliente_caz_nome, ultima_parcela_data, meses_sem_cobranca, valor_recorrente, impacto`

#### 04. Contratos ativos no ClickUp sem cliente no CAZ — `$`
- **Lógica:** `cup_contratos.status='ATIVO'` JOIN `cup_clientes` por `id_task`, normaliza CNPJ, NÃO existe em `caz_clientes`. Caminho alternativo do mesmo vazamento (pega casos onde o lead nem passou pelo Bitrix).
- **Impacto:** `valorr × meses_desde_data_inicio (cap 12)` + `Σ valorp`
- **CSV:** `id_subtask, cup_cliente_nome, cnpj_clickup, servico, valorr, valorp, data_inicio, meses_aberto, impacto`

#### 05. Contratos ativos no ClickUp sem parcela recorrente nos últimos 60 dias — `$`
- **Lógica:** cliente existe em ambos, contrato ativo no CUP, mas zero parcelas com `tipo_fatura='RECORRENTE'` (ou heurística por `descricao` se a coluna não distinguir — ver §8) nos últimos 60 dias.
- **Impacto:** `valorr × 2` (perda corrente)
- **CSV:** `id_subtask, cliente, cnpj, servico, valorr, ultima_parcela_recorrente, dias_desde, impacto`

### 5.B 💧 Sub-cobrança

#### 06. MRR contratado ≠ MRR cobrado — `$`
- **Lógica:** para cada `cup_contratos.status='ATIVO'`, `mrr_contratado = valorr` vs `mrr_cobrado = AVG(valor_bruto) das últimas 6 parcelas recorrentes do cliente`. Filtra `(mrr_contratado - mrr_cobrado) > 50`.
- **Impacto:** `(diff) × meses_no_periodo (cap 12)`. Apenas diffs positivos (estamos cobrando *menos* do que contratamos).
- **CSV:** `id_subtask, cliente, cnpj, valorr_contratado, mrr_cobrado_avg, diff_mensal, meses, impacto`

#### 07. Valor pontual no Bitrix sem parcela pontual no CAZ — `$`
- **Lógica:** deals ganhos com `valor_pontual > 0` e CNPJ casável; verifica se existe `caz_parcelas` (não recorrente) com `valor_bruto` próximo (±10%) na janela ±60 dias do `data_fechamento`.
- **Impacto:** `Σ valor_pontual` dos não casados.
- **CSV:** `id_deal, cliente, cnpj, valor_pontual_deal, data_fechamento, parcela_proxima_encontrada, impacto`

#### 08. Reajustes contratados não refletidos no faturamento — `$` (exploratório)
- **Lógica:** comparar `cup_data_hist.valorr` mais recente com média dos últimos 6 meses; se subiu mas as parcelas recorrentes do CAZ continuam no valor antigo → flag.
- **Risco:** falsos positivos altos. Marcado como "exploratório" no relatório. Pode ser cortado durante implementação se vier ruim.
- **CSV:** `id_subtask, cliente, valorr_atual, valorr_6m_atras, valor_parcela_caz, diff, impacto`

### 5.C 🪦 Pós-churn

#### 09. Contratos encerrados com parcelas ainda abertas — `$` (risco jurídico)
- **Lógica:** `cup_contratos.data_encerramento IS NOT NULL` JOIN parcelas onde `data_vencimento > data_encerramento + 30 dias` AND `status NOT IN ('PAGO','CANCELADO')`.
- **Impacto:** `Σ valor_bruto`. Não é "perda" — é exposição/risco.
- **CSV:** `id_subtask, cliente, cnpj, data_encerramento, parcela_id, parcela_vencimento, valor_bruto, status_parcela`

#### 10. Inadimplência pós-churn > 90 dias — `$`
- **Lógica:** contratos encerrados, parcelas vencidas há > 90 dias e `nao_pago > 0`.
- **Impacto:** `Σ nao_pago` (provisão de perda).
- **CSV:** `cliente, cnpj, data_encerramento, parcela_id, vencimento, nao_pago, dias_atraso`

### 5.D 🪪 Saúde de cadastro (sem $)

#### 11. Duplicatas CNPJ em `cup_clientes` — `🩺`
- **Lógica:** `GROUP BY normalize_cnpj(cnpj) HAVING COUNT(*) > 1` em `cup_clientes`.
- **CSV:** `cnpj, ids_clickup_array, nomes_array, count`

#### 12. Duplicatas CNPJ em `caz_clientes` — `🩺`
- **Lógica:** mesmo padrão em `caz_clientes`, considerando as duas empresas.
- **CSV:** mesmo formato + `empresa`

#### 13. `cup_clientes` sem CNPJ — `🩺`
- **CSV:** `id, nome, status, responsavel`

#### 14. `caz_clientes` sem CNPJ — `🩺`
- **CSV:** `id, nome, empresa`

#### 15. CNPJs malformados — `🩺`
- **Lógica:** validação módulo 11 em CNPJs preenchidos das 3 fontes (`cup_clientes`, `caz_clientes`, `crm_deal`).
- **CSV:** `fonte, id, cnpj_invalido, motivo`

#### 16. Mesmo cliente, nomes muito divergentes — `🩺`
- **Lógica:** JOIN `cup_clientes` ↔ `caz_clientes` por CNPJ normalizado, filtra `similarity(cup.nome, caz.nome) < 0.3`.
- **CSV:** `cnpj, nome_clickup, nome_caz, similaridade`

### 5.E 🔄 Status divergente

#### 17. Cliente inativo no ClickUp ainda recebendo parcelas — `$`
- **Lógica:** `cup_clientes.status` indicando inativo (string exata a confirmar — ver §8) JOIN parcelas pagas com `data_quitacao > 30 dias após a inativação`.
- **Impacto:** `Σ valor_pago`.
- **CSV:** `cliente, cnpj, status_cup, data_inativacao_estimada, parcela_id, data_quitacao, valor_pago`

#### 18. Cliente ativo no ClickUp sem parcela há > 6 meses — `🩺`
- **Lógica:** sintoma de churn não registrado.
- **CSV:** `cliente, cnpj, status_cup, ultima_parcela, meses_desde, valorr_clickup`

### 5.F 🪞 Cross-CRM

#### 19. Deal "perdido" no Bitrix mas cliente ativo no ClickUp — `🩺`
- **CSV:** `id_deal, deal_title, stage_name, lost_reason, cliente_cup, status_cup, valorr`

#### 20. Cliente ativo no ClickUp sem deal no Bitrix em nenhum estágio — `🩺`
- **Lógica:** sinal de origem desconhecida — comissionamento órfão.
- **CSV:** `id_task, cliente, cnpj, valorr, vendedor, data_inicio`

### 5.G 🔭 Cobertura de dado

#### 21. % CNPJ por pipeline no Bitrix — `🩺`
- **Output:** tabela inline no MD + CSV.

#### 22. % `stage_semantic` populado por pipeline — `🩺`
- **Output:** tabela inline.

#### 23. Top 10 campos críticos vazios por sistema — `🩺`
- **Output:** tabela inline (`cup_clientes.cnpj`, `crm_deal.cnpj`, `crm_deal.empresa`, etc.).

## 6. Metodologia de impacto financeiro

### 6.1 Vazamento (categorias 01–05)

- **MRR esperado por caso** = `valor_recorrente` do deal Bitrix se houver, senão `cup_contratos.valorr`.
- **Multiplicador temporal** = meses entre `data_fechamento` (Bitrix) ou `data_inicio` (ClickUp) e hoje, **capado em 12 meses**.
- **Total da categoria** = `Σ (MRR × meses_perdidos)`.
- **Casos pontuais (cat 07)** = `valor_pontual` direto, sem multiplicador.

### 6.2 Sub-cobrança (categoria 06)

- Por contrato: `(valorr_contratado − mrr_cobrado_avg_6m) × meses_no_periodo`, capado em 12 meses.
- Total = soma dos diffs positivos.

### 6.3 Pós-churn (categorias 09–10)

- **#09:** Σ `valor_bruto` das parcelas com `data_vencimento > data_encerramento + 30d` e status pendente. Esse número é **exposição/risco**, não perda contábil.
- **#10:** Σ `nao_pago` das parcelas vencidas há > 90 dias de clientes encerrados. Esse número é **provisão de perda**.

### 6.4 Status divergente (categoria 17)

- Σ `valor_pago` das parcelas quitadas > 30 dias após inativação no ClickUp. A regra dos 30 dias reduz falso positivo de "última cobrança legítima após cancelamento".

### 6.5 Higiene (sem $)

Sem cálculo. Apenas contagens. O relatório explica que essas categorias são *sintomas* do vazamento, não números pra cobrar.

### 6.6 Ressalvas globais (vão para o Anexo)

1. Estimativas são **teto** (worst case), não previsão. Cada caso precisa ser validado individualmente antes de virar planilha de cobrança.
2. Janela fixa em 12 meses.
3. Casos em mais de uma categoria são contados em cada uma. O resumo executivo traz um **"impacto único deduplicado por cliente"** pra evitar inflação na narrativa headline.
4. Não detecta cobrança paralela fora do CAZ (Pix sem registro). Risco aceitável dada a janela.
5. Pipelines do Bitrix além de 0 e 12 não entram (decisão do brainstorm). Listado explicitamente como "não auditado".
6. `crm_deal.empresa` está vazio — não dá pra direcionar deal → empresa CAZ. Tratamos como universo único.

## 7. Estrutura do relatório Markdown

```
# Auditoria CRM → ERP — 14 de abril de 2026

## Sumário Executivo
  - 1 parágrafo de contexto
  - Headline: "R$ X.XXX deixados na mesa nos últimos 12 meses (worst case)"
  - Tabela: TOP 5 vazamentos por R$ impacto
  - 3 ações de maior ROI imediato

## Metodologia
  - Janela 12 meses, multi-empresa unificada, pg_trgm para fuzzy
  - Definição de "ganho", multiplicadores de impacto
  - Ressalvas (estimativa = teto)

## Achados de Estrutura (smoking guns)
  - DATABASE.md desatualizado: lista de colunas faltantes
  - stage_semantic vazio em ~99,9% — bug ETL
  - "Pós-Ganho" / "Subir/Ajustar Cobrança": 0% CNPJ

## Seção A — 🩸 Vazamento de caixa (5 categorias)
  Para cada categoria:
    ### Categoria N — <título>
    **Problema:** descrição em 1 parágrafo
    **Total:** X ocorrências
    **Impacto estimado:** R$ X (worst case)
    **Top 10 piores:** tabela inline
    **Ação sugerida:** quem age + 1 frase de o que fazer
    **Como verificar este número:** SQL exata copiável (DBeaver-friendly)
    **CSV completo:** [csv/01-deals-ganhos-sem-cnpj.csv](csv/...)

## Seção B — 💧 Sub-cobrança (3 categorias)
## Seção C — 🪦 Pós-churn (2 categorias)
## Seção D — 🪪 Saúde de cadastro (6 categorias, sem $)
## Seção E — 🔄 Status divergente (2 categorias)
## Seção F — 🪞 Cross-CRM (2 categorias)
## Seção G — 🔭 Cobertura de dado (3 categorias)

## Próximos Passos Recomendados (ordenados por ROI)
  - 5–8 ações priorizadas, cada uma com R$ recuperável estimado e dono sugerido

## Sub-tasks de remediação sugeridas (não implementadas aqui)
  - [ETL] Investigar stage_semantic vazio
  - [DOC] Atualizar DATABASE.md com colunas reais de crm_deal
  - [BITRIX] Tornar CNPJ obrigatório nos stages de fechamento
  - [ClickUp] Validar CNPJ no momento de criação do cliente

## Anexo — Limitações conhecidas
```

## 8. Pontos a resolver durante implementação

Estes detalhes precisam de query exploratória **antes** de escrever cada query final:

1. **Normalização de CNPJ:** função SQL única `regexp_replace(cnpj, '[^0-9]', '', 'g')` + zero-pad pra 14 chars. Aplicar nos 3 lados antes de qualquer JOIN.
2. **`tipo_fatura` no CAZ:** verificar se distingue recorrente/pontual. Se não, criar heurística por `descricao` (regex de termos como "mensalidade", "manutenção", etc.). Documentar a regra escolhida.
3. **Strings de status no ClickUp:** rodar `SELECT DISTINCT status, COUNT(*) FROM cup_clientes GROUP BY 1` e idem em `cup_contratos`. Definir no spec da implementação quais strings = ativo / inativo / pausado.
4. **Como inferir `data_inativacao` em `cup_clientes`:** a tabela não tem campo explícito. Opções: usar o `data_encerramento` máximo dos contratos do cliente; ou usar data de modificação se existir; ou descobrir um histórico em `cup_data_hist`.
5. **Lookup do `id_cliente`** entre `caz_clientes.ids` e `caz_parcelas.id_cliente` — confirmar se é match exato ou se `ids` contém múltiplos valores separados.
6. **`pg_trgm`:** habilitar via `CREATE EXTENSION IF NOT EXISTS pg_trgm` no início do script. Read-only friendly em uma sessão; falha graceful se permissão negar.
7. **Fallbacks temporais:** quando `crm_deal.data_fechamento` for NULL, usar `date_modify`. Quando ambos forem NULL, descartar o caso da estimativa $ mas listar no CSV com `meses_aberto = NULL` e `impacto_estimado_rs = NULL`. Mesma regra pra `cup_contratos.data_inicio`.
8. **Definição de "última parcela":** `MAX(data_vencimento)` para detecção de gap; `MAX(data_quitacao)` apenas quando o filtro for "quitado". Documentar a escolha em cada query.
9. **"Últimas 6 parcelas recorrentes" (cat 06):** clarificar se são as 6 últimas por `data_vencimento` ou as parcelas dos últimos 6 meses. Decisão default: **últimos 6 meses calendário** (`data_vencimento >= NOW() - INTERVAL '6 months'`). Evita distorção quando frequência de cobrança varia.

## 9. Como rodar

```bash
# Pré-requisito: .env com DATABASE_URL apontando pra prod (read-only)
npm run auditoria-crm-erp

# direto:
tsx scripts/auditoria-crm-erp.ts

# dry-run (só 3 primeiras queries, valida estrutura):
tsx scripts/auditoria-crm-erp.ts --dry-run
```

Adicionar ao `package.json`:
```json
"scripts": {
  "auditoria-crm-erp": "tsx scripts/auditoria-crm-erp.ts"
}
```

**Idempotente:** rodar de novo no mesmo dia sobrescreve os arquivos do dia. Rodar em outra data cria nova pasta — histórico fica versionado no git.

**Tempo esperado:** 30–90s. Cada query loga seu tempo no terminal.

## 10. Error handling

- Conexão prod falha → log claro + `exit 1`, nenhum arquivo gerado parcial.
- Query individual falha → log + continua as outras + seção do MD marca `⚠️ Erro: <msg>` em vez de pular silenciosamente.
- `pg_trgm` indisponível → log + falha graceful das queries 02 e 16, resto roda.
- Categoria com 0 resultados → seção do MD aparece como `✅ Nenhum problema encontrado`. Ausência de problema é resultado, importante mostrar.

## 11. Validação

- **Sanity check manual após primeira execução:** abrir 3 categorias à mão, conferir 2–3 casos cada via Bitrix/ClickUp/CAZ pelos IDs do CSV.
- **Cada categoria com `$` traz no MD a SQL exata** copiável pra defender o número em reunião.
- **Sem testes unitários para os SQLs.** Cada query roda contra dados reais como teste em si. Bug = output esquisito = corrigir e rodar de novo.
- **Helpers (`normalize_cnpj`, `validate_cnpj`, `format_currency`)** ganham 1 teste rápido cada — funções puras, vale 5 minutos.

## 12. O que NÃO está coberto (limitações)

1. Comissionamento por venda (fora de escopo).
2. Cobrança paralela fora do CAZ (Pix sem registro).
3. Pipelines Bitrix além de 0 e 12 (BootCamps, Pós-Ganho, etc.).
4. Direcionamento deal → empresa CAZ (campo `crm_deal.empresa` vazio).
5. Reajustes não refletidos é exploratório — pode vir com falsos positivos altos.
6. Auditoria de despesas / contas a pagar (escopo é receita).

## 13. Decisões adiadas (intencionalmente fora deste spec)

- **Virar dashboard ao vivo no Cortex.** Decisão futura. As 23 queries em arquivos `.sql` separados facilitam essa transição quando vier.
- **Alertas proativos no fluxo (bloquear deal sem CNPJ).** Decisão futura, vai ser uma sub-task de remediação.
- **Pipeline de remediação automática** (corrigir CNPJs em massa). Fora de escopo — auditoria diagnóstica, não corretiva.

---

**Próximo passo:** invocar `superpowers:writing-plans` para gerar o plano de implementação task por task.
