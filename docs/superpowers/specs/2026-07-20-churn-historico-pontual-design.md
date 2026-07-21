# Histórico de churn pontual no gráfico Histórico de Churn

**Data:** 2026-07-20
**Origem:** continuação de `2026-07-20-churn-detalhamento-melhorias-design.md`, que expôs `valorp` mas
manteve o pontual restrito aos drawers.

## Contexto

O gráfico "Histórico de Churn {ano}" (`client/src/components/churn/ChurnHistoricoMensal.tsx`,
alimentado por `GET /api/analytics/churn-historico-mensal`, `server/routes.ts:5367`) mostra MRR
perdido por mês, empilhado por motivo, com linha tracejada de meta a 8% do MRR ativo.

A receita pontual não aparece. O trabalho anterior expôs `valorp` no endpoint de **detalhamento**,
mas o histórico tem endpoint próprio e ficou de fora.

## Investigação

Todas as medições em **PROD** (`dados_turbo`). O valor pontual vem de
`"Clickup".cup_contratos.valorp` por `id_subtask = task_id`. `cup_contratos.id_subtask` é único
(2.929 linhas, 2.929 distintos), então o `LEFT JOIN LATERAL … MAX(valorp)` é equivalente a um join
1:1 e não infla nada.

### Série mensal de 2026

| Mês | MRR | Pontual | Linhas | Linhas com `valorp > 0` | Pontual/MRR |
|---|---:|---:|---:|---:|---:|
| jan | 162.431,00 | 12.597 | 81 | 4 | 0,08 |
| fev | 101.655,50 | 18.497 | 41 | 2 | 0,18 |
| mar | 151.063,00 | 89.197 | 74 | 16 | 0,59 |
| abr | 152.262,00 | 95.267 | 92 | 19 | 0,63 |
| mai | 184.823,00 | 157.302 | 91 | 25 | 0,85 |
| jun | 186.662,00 | 132.452 | 79 | 30 | 0,71 |
| jul (parcial, até 20) | 66.930,00 | 171.272 | 52 | 24 | **2,56** |
| **total** | **1.005.826,50** | **676.584** | 510 | 120 | 0,67 |

**O pontual é menor que o MRR em jan–jun.** Julho é o único mês em que inverte, por duas causas
somadas: o mês está incompleto (MRR de R$ 66,9 mil, menos da metade dos anteriores) e o pontual
concentra poucos clientes grandes de Creators — Foco laser (4 × R$ 14.997) e BETTERLIFE
(4 × R$ 9.497) sozinhos são 57% do mês.

O fato relevante não é o tamanho relativo, é a **tendência**: o pontual cresceu ~10× ao longo de
2026 (R$ 12,6 mil em janeiro para R$ 130–170 mil desde maio), acompanhado do número de linhas com
`valorp > 0` (4 → 30).

### Dupla contagem: não é problema

| bucket | linhas | MRR | Pontual |
|---|---:|---:|---:|
| só MRR | 355 | 1.031.326,50 | 0 |
| só pontual | 119 | — | 664.584 |
| nenhum (inclui 6 ajustes manuais negativos) | 35 | −26.500 | 0 |
| **ambos > 0** | **1** | **1.000** | **12.000** |

Uma única linha em 2026 (`86a9v8ry2`, "Automação", 03/02/2026) tem os dois valores — 0,1% do MRR e
1,8% do pontual do ano. As séries são essencialmente disjuntas; somar as duas barras não produz
dupla contagem material.

### Empilhar por motivo seria ruim

Distribuição do `valorp` de 2026 por `motivo_cancelamento`:

| motivo | pontual | % do pontual | % do MRR |
|---|---:|---:|---:|
| Inadimplente | 178.055 | 26,3% | 8,7% |
| Erro na Venda | 166.063 | 24,5% | 10,8% |
| Inadimplente 1º Mês | 107.973 | 16,0% | 3,0% |
| **Não especificado** | 73.829 | **10,9%** | 3,8% |
| Não começou | 56.729 | 8,4% | 4,0% |

Três motivos concentram **66,8%** do pontual; os cinco primeiros, 86,1%. E **9 dos 21 motivos têm
`valorp` exatamente zero** — incluindo pesos altos do MRR como Erro Operacional (9,7% do MRR),
Pausa/Reestruturação (9,2%) e Internalizou Serviço (8,4%). Empilhar produziria uma pilha de ~4
blocos visíveis com metade da legenda sem representação na barra.

"Não especificado" pesa 10,9% do pontual contra 3,8% do MRR — motivo em branco é quase 3× mais
frequente, em valor, no pontual.

### `valorp` só existe em 2026

| ano | linhas | com match em `cup_contratos` | com `valorp > 0` | Pontual |
|---|---:|---:|---:|---:|
| 2023 | 140 | 50,7% | **0,0%** | **0** |
| 2024 | 428 | 55,4% | **0,0%** | **0** |
| 2025 | 945 | 71,1% | 3,7% | 152.743 |
| 2026 | 510 | **96,1%** | **23,5%** | 676.584 |

Em 2023 e 2024 o join encontra ~55% das linhas mas **nenhuma** tem `valorp` preenchido. 2025 é
marginal e irregular (primeiro registro em mar/2025). O gráfico aceita `?ano=`, então sem
tratamento a barra apareceria vazia nesses anos — comunicando "não houve churn pontual" quando a
verdade é "não temos o dado".

### O abono afeta as duas séries em magnitudes diferentes

| recorte | Pontual | MRR |
|---|---:|---:|
| Todos | 676.584 | 1.005.826,50 |
| Abonados | 229.107 (**33,9%**) | 135.032 (13,4%) |
| Não abonados | 447.477 | 870.794,50 |

45 das 82 linhas abonadas (55%) têm `valorp > 0`. O toggle retira 33,9% do pontual contra 13,4% do
MRR. É informação real sobre o negócio, não defeito — decidido não mascarar.

## Decisões

| Item | Decisão |
|---|---|
| Forma | **Barras lado a lado** — MRR empilhada por motivo (como hoje) + Pontual ao lado |
| Composição da barra de pontual | **Sólida, cor única** — não empilhar por motivo |
| Percentual e meta | **Só valor em R$.** Sem % e sem meta para o pontual |
| Anos sem dado | **Ocultar a série e avisar no subtítulo**, por régua de **cobertura ≥ 10%** das linhas do ano (2025 fica de fora, com 3,7%) |
| Assimetria do abono | **Nada** — o filtro se aplica igual às duas séries |

Racional do "sem percentual": não existe base de estoque pontual consolidada com a mesma régua do
MRR base (primeiro snapshot do mês, status ativos). Inventar um denominador produziria um número
que ninguém consegue auditar. A meta de 8% permanece definida sobre MRR.

## Design

### Backend — `GET /api/analytics/churn-historico-mensal`

A query principal (`server/routes.ts:5379-5392`) ganha o join lateral já validado no endpoint de
detalhamento e passa a somar `valorp`:

```sql
FROM cortex_core.vw_cup_churn_ajustado c
LEFT JOIN LATERAL (
  SELECT MAX(x.valorp::numeric) AS valorp
  FROM "Clickup".cup_contratos x
  WHERE x.id_subtask = c.task_id
) ct ON TRUE
```

**Não agregar o pontual por motivo** — a barra é sólida, basta um total por mês. O `GROUP BY 1, 2`
existente (mês, motivo) continua servindo ao MRR; o pontual é somado no mesmo pivot para
`mesesMap[mes].pontual`.

`MesSerie` ganha `pontual: number`. A resposta ganha **`pontualDisponivel: boolean`**, calculado por
**cobertura**, não por existência:

```
pontualDisponivel = (linhas com valorp > 0) / (total de linhas do ano) >= 0.10
```

Aplicado aos dados medidos:

| ano | cobertura | `pontualDisponivel` |
|---|---:|---|
| 2026 | 23,5% | **true** |
| 2025 | 3,7% | false |
| 2024 | 0,0% | false |
| 2023 | 0,0% | false |

O limiar de 10% é o ponto que separa 2026 (23,5%) de 2025 (3,7%) com folga dos dois lados — não é
um valor de fronteira sensível a pequenas variações do dado.

Régua por cobertura, e não por "existe algum `valorp > 0`", porque 2025 tem R$ 152.743 espalhados
em 3,7% das linhas: uma série que aparenta medir churn pontual mas mede ~4% dele é pior que série
nenhuma. Preferido a um corte hardcoded em 2026 porque a série liga sozinha quando a origem for
corrigida, sem tocar no código e sem manutenção na virada do ano.

### Frontend — `ChurnHistoricoMensal.tsx`

**Barra nova:** `<Bar dataKey="pontual">` **sem `stackId`**. As barras de motivo usam
`stackId="churn"`; no Recharts, uma barra sem esse `stackId` é posicionada lado a lado com o grupo
empilhado. Renderizada apenas quando `pontualDisponivel` for verdadeiro.

**Cor:** âmbar, a mesma família que a coluna Pontual do drawer já usa. Seguindo o padrão de cor em
SVG do próprio arquivo (`axisColor`/`gridColor`), theme-aware:
`const pontualColor = isDark ? "#fbbf24" : "#d97706";`

**Tooltip:** linha `Pontual: R$ X` abaixo do bloco de MRR, separada por divisor, sem percentual. O
bloco de motivos continua pertencendo apenas ao MRR. Quando `pontual` for 0 no mês, a linha é
omitida (mesma regra de não renderizar zero como se fosse informação).

**Subtítulo:** quando `pontualDisponivel` for falso, acrescentar
"· sem dado de churn pontual neste ano", para que a ausência da barra seja lida como falta de dado
e não como ausência de churn.

O texto é deliberadamente genérico. "Disponível a partir de 2026" seria hardcode disfarçado: mentiria
num ano futuro que porventura não tenha pontual, e exigiria manutenção se 2025 for corrigido na
origem. A frase atual é verdadeira em qualquer cenário.

**Legenda:** a linha de meta passa a se chamar `Meta {pct} (MRR)`. Com duas barras por mês, o
Recharts desenha a `Line` no centro do grupo, ou seja, visualmente entre as duas barras — e a meta
vale só para a de MRR. Optado por explicitar na legenda em vez de reposicionar a linha: mexer em
posicionamento por estética costuma quebrar em telas estreitas.

**Label do topo:** permanece só na barra de MRR (valor + percentual da base, com cor condicional
pela meta). A barra de pontual não recebe label — o tooltip cobre, e dois labels por mês poluiriam.

## Testes

Funções puras, em `client/src/components/churn/churnAggregations.test.ts` (hoje 33 testes):

- Montagem do `chartData` com `pontual`: mês sem pontual gera 0, não `undefined`; o `*` de mês
  corrente e o fallback de base continuam intactos
- `pontualDisponivel` falso ⇒ a série não é montada

Backend: sem teste automatizado (o endpoint não tem suíte hoje); validação por reconciliação
manual contra os números desta spec.

## Validação manual

- Reconciliar contra **prod**: 2026 deve dar R$ 676.584 de pontual no ano e a série mensal da
  tabela acima. O banco local está 13 dias atrasado.
- `?ano=2025` e `?ano=2024` devem ocultar a barra e exibir "· sem dado de churn pontual neste ano"
  no subtítulo (coberturas de 3,7% e 0,0%, ambas abaixo do limiar de 10%). `?ano=2026` mostra a
  barra (23,5%)
- Alternar o toggle de abono: a barra de pontual cai ~34% e a de MRR ~13% — comportamento esperado
- Dark mode e light mode

## Dívidas registradas (fora do escopo)

| Dívida | Impacto |
|---|---|
| `valorp` vazio em 2023/2024 e 3,7% em 2025 na origem | Impede série histórica de pontual antes de 2026 |
| `logos` conta linhas de churn, não clientes | No pontual infla: 8 clientes com 4 subtasks somam R$ 245 mil dos R$ 676 mil de 2026. Comportamento já existente para MRR; mudar a semântica é outra discussão |
| "Não especificado" é 10,9% do pontual (vs 3,8% do MRR) | Preenchimento de motivo pior em contratos pontuais, corrigível na origem |
| `valorp` vem da tabela viva `cup_contratos` | É o valor de hoje, não o do momento do churn — numa tela retrospectiva isso é uma aproximação |
