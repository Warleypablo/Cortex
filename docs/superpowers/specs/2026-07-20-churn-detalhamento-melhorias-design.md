# Melhorias em /dashboard/churn-detalhamento

**Data:** 2026-07-20
**Origem:** revisão da tela em call (4 anotações sobre prints dos drawers, aba Submotivo e gráfico Histórico de Churn 2026)

## Contexto

A tela `/dashboard/churn-detalhamento` (`client/src/pages/ChurnDetalhamento.tsx`) mostra churn de MRR
por dimensão (motivo, produto, cluster, pessoa, squad), com drill em drawer lateral de 4 abas
(Contratos, Submotivo, Voz do Cliente, Timing) e um histórico mensal empilhado por motivo.

Fonte: `cortex_core.vw_cup_churn_ajustado` — um `UNION ALL` de `"Clickup".cup_churn` com
`cortex_core.churn_ajustes_manuais` (ajustes entram com `valor_r` negativo e todos os campos de
responsável nulos).

Quatro problemas foram apontados:

1. Contratos aparecem como "R$ 0" no drawer
2. O ranking por Cluster está vazio
3. Não dá para ver quem é o responsável pelo contrato perdido
4. O histórico só fala em reais, sem percentual

## Investigação (realizada antes do design)

Todas as medições em **PROD** (`dados_turbo`). O banco local está 13 dias atrasado —
julho/2026 tem 23 linhas no local contra 52 em prod. Qualquer conferência de julho feita só no
local subestima em ~2×.

### O "R$ 0" é receita pontual invisível

A view **não tem** coluna de valor pontual — só `valor_r`. O pontual vive em
`"Clickup".cup_contratos.valorp`, alcançável por `ct.id_subtask = v.task_id` (casa 51 de 52 linhas
de julho/26).

Julho/2026 (2026-07-01 a 2026-07-20, prod):

| métrica | valor |
|---|---:|
| linhas | 52 |
| com `valor_r` 0 ou NULL | 26 (50,0%) |
| dessas, com `valorp > 0` | 24 |
| SUM(`valor_r`) | R$ 66.930 |
| SUM(`valorp`) | R$ 171.272 |

As linhas são mutuamente exclusivas no período: quem tem `valor_r` tem `valorp` 0/nulo e
vice-versa. **O pontual é 2,6× o recorrente e está 100% fora da tela.** No ano de 2026: R$ 664.584
de pontual invisível contra R$ 1.005.826 de `valor_r`.

`tipo_negocio` existe mas é 80,8% nulo e seus únicos valores (`Ecommerce`, `Lead`, `Info`) não
distinguem recorrente de pontual — **não serve** como discriminador. A separação deve vir de qual
dos dois campos de valor está preenchido.

### Cluster: o dado não existe em lugar nenhum

| tabela | linhas | `cluster` preenchido |
|---|---:|---:|
| `"Clickup".cup_churn` | 4.497 | **0** |
| `"Clickup".cup_clientes` | 1.488 | **0** |
| `cortex_core.clientes` | 1.657 | **0** |

Não é bug de join na view — é ausência total de dado nas duas pontas.
`cortex_core.catalog_clusters` tem o vocabulário canônico (`Regulares`, `Imperdíveis`, `Chaves`,
`NFNC`, `Empty`) mas nenhuma tabela operacional o referencia.

A única fonte viva é `"Bitrix".crm_deal.bx_cluster`. Enriquecer por CNPJ foi medido e **rejeitado**:

- A coluna `cnpj` da view está 1% preenchida em 2026 (5 de 510); recuperável a 95,7% via fallback
  `cup_clientes.task_id = v.parent_id`, mas isso é código novo
- O gargalo é o Bitrix: `bx_cluster` preenchido em 4,6% dos deals (856 de 18.504)
- Cobertura final: **33,7%** (172 de 510). Restariam 338 logos / R$ 638.570 em "sem cluster"
- `1480` e `1476` são IDs crus de enum **sem de-para no banco** (verificado em `catalog_aliases`,
  `system_field_options`, `cup_custom_field_definitions` e no schema `"Bitrix"` inteiro; `bx_cluster`
  não é lido por nenhum código do Cortex). Só resolvíveis via API do Bitrix
- `Chaves`, `NFNC` e `Empty` nunca aparecem no Bitrix — os dois lados são parcialmente disjuntos

### Responsável

A view não tem coluna `responsavel`. Tem `responsavel_geral` (92,0% preenchido, escolhido),
`cs_responsavel` (96,5%) e `vendedor` (84,5%). Ambos aceitam `"Nome A; Nome B"`.

`"Clickup".cup_data_hist` **não tem** `responsavel_geral` — só `responsavel` (operador da subtask)
e `cs_responsavel`. O campo vive em `cup_clientes.responsavel_geral`, alcançável por
`cup_clientes.task_id = cup_data_hist.id_task`.

MRR base de julho/2026 por `responsavel_geral` (régua replicada de `server/routes.ts:5404-5433`,
snapshot resolvido 2026-07-01):

| | valor |
|---|---:|
| total do endpoint | R$ 1.197.868,00 |
| soma por `responsavel_geral` | R$ 1.197.868,00 |
| Δ | **R$ 0,00** |

Sem fan-out no join (573 linhas antes e depois). NULL/vazio = R$ 90.901 (7,6%). Nomes com `;`
dentro da base de julho: 1 linha, R$ 3.897 (0,33%).

## Decisões

| Item | Decisão |
|---|---|
| Escopo MRR × Pontual | Colunas separadas **dentro dos drawers** + dois totais no header. Rankings e KPIs do topo permanecem só-MRR |
| Percentual no histórico | **% da base MRR do mês** (mesma régua da meta de 8%), não composição do mês |
| % por responsável | **Participação (soma 100%) + Churn% sobre a carteira**, lado a lado |
| Campo de responsável | `responsavel_geral` |
| Cluster | **Esconder a dimensão** enquanto não houver dado. Não derivar do Bitrix |
| Filtro de squads quebrado | Fora desta tarefa |

## Design

### 1. MRR × Pontual no drawer

**Backend** — `GET /api/analytics/churn-detalhamento` (`server/routes.ts:4924`):

- Adicionar `LEFT JOIN "Clickup".cup_contratos ct ON ct.id_subtask = v.task_id`
- Mapear `valorp: Number(ct.valorp) || 0` no objeto retornado (`routes.ts:4988-5028`)
- O join não cobre linhas de ajuste manual (`task_id LIKE 'AJUSTE-%'`) nem 14 linhas de 2026 sem
  contrato correspondente — nesses casos `valorp` é 0, o que é o comportamento correto

**`ChurnContract`** (`client/src/components/churn/types.ts`): novo campo `valorp: number`.

**`DrawerContratosTable.tsx`**: a coluna `MRR` vira duas — `MRR` e `Pontual`. Ambas renderizam
`—` em cinza quando o valor é 0 ou nulo, em vez do `R$ 0` enganoso de hoje.

**`ChurnDrillDrawer.tsx`**: o header (linhas 63-70) mostra os dois totais:

```
Produto: Performance
16 contratos · MRR perdido: R$ 36.176 · Pontual: R$ 12.034
```

**Largura**: `SheetContent` passa de `sm:max-w-2xl` para `sm:max-w-4xl` (672 → 896px) para
acomodar 8 colunas. Drawers de Squad chegam a 17 linhas e ganham legibilidade.

**Consequência aceita**: o card do ranking mostra só MRR enquanto o drawer aberto a partir dele
mostra MRR + Pontual. É intencional — a meta de 8% é sobre MRR. Decidido não levar o pontual para
os KPIs do topo.

### 2. Percentual no Histórico de Churn 2026

`ChurnHistoricoMensal.tsx`. `mrrBasePorMes` já vem no payload (linha 25) e já alimenta a linha de
meta — **nenhuma mudança de backend**.

**Tooltip** (`CustomTooltip`, linhas 97-131):

```
Jan 2026
Churn: R$ 162.431 · 8,4%
Meta (8%): R$ 82.407 · +R$ 80.024 (+0,4pp)
─────────────────────────────
● Falta de Resultado    R$ 32.727   1,69%
● Erro Operacional      R$ 31.047   1,60%
● Pausa/Reestruturação  R$ 20.336   1,05%
```

O excedente da meta sai também em pontos percentuais. A soma dos percentuais dos motivos bate com
o percentual do total (mesma base) — o tooltip é internamente consistente.

**Label no topo da barra** (`LabelList`, linhas 183-188): duas linhas, valor em cima e percentual
embaixo, com **cor condicional** — vermelho acima de 8%, verde dentro. Leitura instantânea de quais
meses bateram a meta sem seguir a linha tracejada com o olho.

**Subtítulo** (linha 139): acrescentar que os percentuais são sobre o MRR ativo do mês, para o
número não ser lido como composição.

**Mês corrente**: marcado com `*` e nota "mês em curso". Sem isso, julho aparece com percentual
baixo só porque o mês não acabou, ao lado de uma meta cheia de 8% — parece performance boa.

**Guarda**: quando `mrrBasePorMes[mes]` for 0 ou ausente, omitir o percentual (mostrar só o valor)
em vez de renderizar `Infinity%` ou `0%`. A série gera meses até o mês corrente mesmo sem snapshot.

### 3a. Coluna Responsável

`DrawerContratosTable.tsx`: coluna `Responsável` entre `Cliente` e `MRR`, truncada com `title` no
hover. `responsavel` já vem no payload (`routes.ts:5016`) — sem mudança de backend. Vale
automaticamente nos dois usos do componente (aba Contratos e rodapé "Contratos perdidos" da aba
Submotivo).

### 3b. Bloco por responsável na aba Submotivo

`DrawerSubMotivo.tsx`. Os dois blocos atuais (Evitabilidade, Motivo → Submotivo) são donut +
legenda num grid de 2 colunas e **já mostram participação percentual** (linhas 133 e 224). O bloco
novo carrega duas métricas por linha, o que não cabe numa legenda de donut — vai como **tabela
compacta ocupando a largura inteira, abaixo do grid**:

```
Responsável                    Contratos      R$      Part.    Churn%
● Glauber Pereira da Silva            4    12.988      36%     13,2%
● Debora Mund                         5    10.494      29%      5,0%
● Ana Paula                           3     7.497      21%     16,6%
● Não especificado                    5     4.797      13%        —
```

Ordenado por R$ desc. Bolinha com `severityHex`, mesma escala do bloco de motivos.

- `Part.%` = MRR do responsável ÷ MRR do recorte. Frontend puro.
- `Churn%` = MRR perdido ÷ MRR da carteira daquele responsável no início do mês. Exige backend.

**Backend para o `Churn%`**: expor MRR base por `responsavel_geral` no endpoint
`churn-detalhamento`, replicando a régua de `routes.ts:5404-5433` (primeiro snapshot do mês entre
dias 1-5, fallback último do mês anterior, status `ativo`/`onboarding`/`triagem`), com
`LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task`. Validado: soma bate ao centavo
com o total do endpoint.

**Range multi-mês**: o endpoint aceita `startDate`/`endDate` livres, mas a régua de base é mensal.
O denominador é a **soma das bases mensais de cada mês tocado pelo range**, por responsável — mesma
convenção que a tela já usa no agregado (`metricas.soma_mrr_bases`). Um range de 3 meses divide o
churn dos 3 meses pela soma das 3 bases daquele responsável. Ranges parciais (meio de mês) usam a
base do mês inteiro; o `Churn%` fica subestimado nesse caso, igual ao comportamento atual do
agregado.

**Tratamentos exigidos pelos dados:**

- **Linha "Não especificado"** — 8% dos contratos sem `responsavel_geral`, e os ajustes manuais
  entram com `valor_r` negativo e responsável nulo (−R$ 26.500 em abril/2026). Sem tratamento a
  linha pode aparecer com valor e participação negativos. Fica sempre por último, fora da
  ordenação, e sem `Churn%` (não há carteira a que atribuir).
- **Nomes múltiplos** — atribuir o contrato inteiro ao **primeiro nome** (`split_part(x, ';', 1)`),
  não ratear. Rateio inventa precisão que o dado não tem, e agrupar pela string crua cria buckets
  falsos. Impacto de qualquer régua: ~0,3%.
- **Quando o recorte não tiver base** (drawer de um mês sem snapshot), `Churn%` mostra `—`.

### 4. Esconder Cluster

**Frontend**: remover `"cluster"` do type `Dimensao` (`ChurnPorDimensao.tsx:6`), o label (linha 11),
o botão do seletor (linha 195) e o filtro de clusters em `ChurnControls.tsx`. Se a dimensão ativa
estiver persistida como `cluster`, cai para `motivo`.

**Backend: não mexer.** `churn_por_cluster` (`routes.ts:5271-5279`) e `filtros.clusters` continuam
sendo calculados. Não custam nada e, quando `cup_clientes.cluster` for preenchida, a dimensão volta
descomentando três linhas de UI.

## Testes

Lógica de negócio a cobrir com teste, sem depender de banco (funções puras sobre arrays de
`ChurnContract`):

- Agregação por responsável: participação soma 100%; `"A; B"` cai inteiro em `A`; linha
  "Não especificado" fica por último mesmo com valor negativo; `Churn%` ausente quando não há base
- Percentual do histórico: base 0 ou ausente omite o percentual em vez de `Infinity`/`0%`
- Totais do header do drawer: MRR e Pontual somados independentemente, nulos tratados como 0

## Validação manual

- Reconciliar contra **prod**, não local (local 13 dias atrasado: julho tem 23 linhas contra 52)
- Conferir o drawer "Produto: Performance" contra o print de origem: os contratos hoje em "R$ 0"
  (Envase Brand, Flico, LUMAI) devem passar a mostrar valor na coluna Pontual
- Dark mode e light mode nos dois drawers e no gráfico
- Drawer de Squad (17 linhas) na largura nova, sem scroll horizontal

## Dívidas registradas (fora do escopo)

| Dívida | Impacto |
|---|---|
| Filtro de squads irrelevantes é no-op — compara com `'turbo interno'` mas os valores têm prefixo emoji (`🚀 Turbo Interno`). MRR base com e sem filtro é idêntico: R$ 1.197.868 | Corrigir muda o denominador do churn% e da meta de 8% em **todos** os meses. Merece validação própria |
| `cup_clientes.cluster` 100% vazia na origem, com `catalog_clusters` já definido | Bloqueia a dimensão Cluster. Caminho de maior retorno — a view já expõe a coluna |
| `responsavel_geral` sem histórico no banco | O `Churn%` de meses passados usa o responsável **atual**; troca de carteira atribui churn antigo a quem pegou a conta depois |
| 7,6% do MRR base (R$ 90.901) sem `responsavel_geral` | Buraco de preenchimento no ClickUp, corrigível na origem |
| `tipo_negocio` 80,8% nulo e sem valor que distinga recorrente de pontual | A separação MRR × Pontual depende de qual campo de valor está preenchido, não do tipo |
| `cnpj` da view 1% preenchido em 2026 (era 45% em 2024) | Regressão de preenchimento na origem; bloqueia qualquer cruzamento por CNPJ a partir da view |
