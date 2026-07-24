# Reporte Semanal de Operação — design

Data: 2026-07-24
Rota: `/reports/operacao`
Endpoint: `/api/reports/operacao`

## Problema

A liderança de operação precisa, toda semana, de uma leitura gerencial única:
quanto de MRR a casa tem, quanto perdeu e por quê, quanto entregou de pontual,
quanto ainda deve entregar (e de qual produto), e quanta receita cada pessoa da
operação está sustentando. Hoje esses números existem espalhados por
`/reports/semanal` (recorte comercial), `/estoque-pontual`, `/detalhamento-churn`
e `/bp-2026` — cada um com sua régua e sua janela temporal. Ninguém consegue
abrir uma tela só e conduzir a reunião de operação.

## Decisão de escopo

Tela **nova e independente**, não uma aba de `/reports/semanal`. Aquela tela é
dos líderes e fala de aquisição (venda nova, cross-sell, net churn); esta fala
de entrega e produtividade. Públicos e perguntas diferentes.

A tela compara a **última semana fechada (seg→dom) contra a anterior**, com
coluna Δ. A semana corrente não entra: comparar 3 dias com 7 produz queda
fantasma toda segunda — mesma decisão já tomada em `/reports/semanal`. Um
seletor permite deslizar o par para semanas anteriores.

Δ é **variação relativa** nas linhas de moeda e **pontos percentuais** nas
linhas de %. A cor do Δ é semântica por direção: em churn e estoque, cair é
bom.

**Fora de escopo, deliberadamente:** cross-sell e net churn (são da tela dos
líderes), série de 12 semanas, export PPT, envio automático por WhatsApp.

## Métricas e réguas

Todas as fotos de carteira usam `MAX(data_snapshot) <= data`, nunca igualdade
com o dia exato: `cup_data_hist` tem semanas com 6 de 7 snapshots, e exigir o
domingo preciso zeraria a carteira dessas semanas em silêncio.

### Bloco A — MRR

| Linha | Régua |
|---|---|
| MRR Ativo | `triagem + onboarding + ativo` no último snapshot `<=` domingo. Reusa `carteiraNoFim()` |
| MRR Operando | acima `+ em cancelamento` |

### Bloco B — Churn

Base: `"Clickup".cup_churn`, por `data_solicitacao_encerramento` dentro da semana.

| Linha | Régua |
|---|---|
| Churn MRR Total | `SUM(valor_r)`. Reusa `churnMrrNaSemana().total` |
| Churn MRR Abonado | `SUM(valor_r) FILTER (WHERE COALESCE(abonar_churn,'') = 'Sim')` — campo novo |
| Churn MRR Líquido | Total − Abonado |
| Churn % Líquido | Líquido ÷ MRR no último snapshot **anterior** à segunda (base de abertura, via `baseNaAbertura()`) |
| Churn Pontual Total / Abonado / Líquido | Mesma tríade. `valorp` vem de `cup_contratos` via `id_subtask = ch.task_id AND valorp > 0` |
| Churn Pontual % Líquido | Líquido ÷ estoque pontual na abertura |

**A base de todo % é a abertura da semana, não o fechamento.** O denominador é
sempre o último snapshot *anterior* à segunda-feira (`baseNaAbertura()`), ou
seja, a carteira que a semana recebeu — dividir a perda pela carteira que
sobrou depois dela subestima a taxa. Na prática essa base é o mesmo snapshot
que aparece na coluna "semana anterior" dos blocos A e D, o que dá para
conferir a olho na própria tela.

**Esta tela não bate com o "Churn Ajustado" do BP 2026 nem com o de
`/reports/semanal`, e isso é intencional.** Ajustado exclui três motivos
operacionais (`Erro na Venda`, `Não começou`, `Inadimplente 1º Mês`); Líquido
aqui exclui o que foi de fato abonado (`abonar_churn = 'Sim'`). As duas réguas
andam coladas mas não são o mesmo conjunto: nos 120 dias até 24/07/2026, dos 78
casos de `Erro na Venda` só 49 estavam abonados. A escolha por Abonado é o que
faz a conta fechar na tela (Total − Abonado = Líquido). Consequência: a tela
**precisa** declarar a régua em nota de rodapé e tooltip, senão alguém cruza com
o BP e reporta bug onde não há.

### Bloco C — Churn por motivo

Tabela com uma linha por motivo presente na semana atual **ou** na anterior:

```
Motivo | MRR atual | MRR ant. | Pontual atual | Pontual ant.
```

Usa churn **bruto** (abonados incluídos): os motivos operacionais são
justamente o que se quer enxergar, e assim o total da tabela fecha com a linha
Churn Total do bloco B. Ordena por MRR atual desc, com linha de Total ao pé.

Motivo vazio vira `(sem motivo)` — são R$ 43k em 42 casos nos 120 dias até
24/07/2026, volume grande demais para omitir.

### Bloco D — Pontual

| Linha | Régua |
|---|---|
| Pontual Entregue | Passou a `entregue` entre o snapshot de abertura e o de fechamento. Reusa `entregaPontualNaSemana()` |
| Estoque Pontual | Foto no fim da semana: `valorp > 0 AND status NOT IN ('entregue','cancelado/inativo','não usar')` — régua canônica do `/estoque-pontual`. `'cancelado/inativo'` é UM valor de status, usar igualdade exata, nunca ILIKE |
| Estoque por produto | Mesma foto, `GROUP BY produto`. Fill de `produto` no snapshot é 93–98% nas últimas 3 semanas; o resto agrupa em `Sem produto` em vez de sumir da soma |

O estoque é foto de **fim de semana** (não de abertura, como o `basePontual` de
`/reports/semanal`): a coluna "semana anterior" é a foto do domingo anterior.

### Bloco E — Produtividade

| Linha | Régua |
|---|---|
| Headcount Operação | `admissao <= data AND (demissao IS NULL OR demissao > data)`, `setor ∈ {Commerce, Tech Sites}`, squad normalizado ≠ Vendas |
| MRR por cabeça | MRR Ativo (fim da semana) ÷ headcount naquela data |
| Faturamento por cabeça | Receita Faturável do mês ÷ headcount. Numerador via `computarBpReceitas()` |

Headcount valida contra produção: 75 em 2026-07-19, 76 em 2026-07-12, 72 hoje.
`admissao` está 100% preenchida em `rh_pessoal` (0 nulos em 344 linhas), então a
régua histórica é confiável.

A normalização de squad remove emoji e *variation selectors* antes de comparar —
o campo tem `🪖 Selva` e `Selva` como valores distintos, além de sufixos
`(OFF)`. A lista de setores e a exclusão de Vendas vivem em
`shared/headcount-operacao.ts` como constantes testadas, não como string solta
dentro de um SQL.

Duas limitações que a tela deve declarar:

1. O denominador é **operação (72–76 pessoas)**, não colaboradores totais (110).
   O valor sai ~50% acima do `receita_cabeca` do BP 2026 de propósito.
2. `Faturamento por cabeça` tem numerador **mensal**: dentro de um mesmo mês só
   se move pelo headcount. O mês corrente é parcial e sai marcado com `*`.

`computarBpReceitas()` é reusada em vez de uma query nova para não criar a
terceira régua de faturamento do repositório. Ela tem cache interno de 10
minutos compartilhado com `/bp-2026`.

## Arquitetura

Estende `server/reportsSemanal/` em vez de criar um módulo paralelo. O motivo é
concreto: quando a mesma métrica tem duas implementações, elas divergem em
silêncio — foi o que aconteceu com venda nova × cross-sell até 22/07/2026,
quando 40 dos 106 deals de expansão contavam em duas linhas ao mesmo tempo.
Churn Total nesta tela é literalmente a mesma função que alimenta a dos líderes.

```
server/reportsSemanal/
  semanas.ts            (reuso) + parSemanas(ate) → [fechada, anterior]
  queries.ts            (estender) churnMrrNaSemana e churnPontualNaSemana
                        ganham o campo `abonado` — aditivo, a tela dos líderes
                        ignora o campo novo
  queriesOperacao.ts    (novo) estoquePontualNoFim · estoquePontualPorProduto
                        churnPorMotivo · headcountOperacao
                        + gêmeas de drill: detalheEstoquePontual,
                          detalheChurnPorMotivo, detalheChurnAbonado
  derivarOperacao.ts    (novo, puro) monta o par de semanas e calcula os Δ
server/routes/reportsOperacao.ts   (novo)
shared/headcount-operacao.ts       (novo) setores e exclusões como constantes
```

**Pool.** `server/db.ts` é `max: 5`, compartilhado com o app inteiro. São ~7
queries por semana × 2 semanas: as semanas rodam **em série** e as queries de
cada semana em lotes de no máximo 4, deixando uma conexão livre para o resto do
app.

**Erros.** Nenhuma query com `try/catch` silencioso. Falha vira HTTP 500 e a
tela mostra o erro. Numa tela cujo único valor é número que a liderança confia
de cabeça, uma linha zerada plausível é pior que um erro visível. Mesma decisão
de `server/reportsSemanal/queries.ts`.

**Drill.** Cada query de drill é gêmea da query de série correspondente e repete
o mesmo filtro. Se um filtro mudar, o par muda junto — é o que impede o drawer
de deixar de somar a célula. Abrem drawer: Churn (total, abonado, líquido, e
cada motivo), Pontual Entregue e Estoque Pontual (total e por produto). Não
abrem: MRR e as linhas por cabeça, que são agregados de carteira e de RH.

**Frontend.** `client/src/pages/relatorio-operacao/` com arquivos de propósito
único: `TabelaComparativa` (blocos A/B/D/E), `TabelaChurnMotivo`,
`TabelaEstoqueProduto`, `DrawerDetalhe`, `useRelatorioOperacao`, `types.ts`
(espelho comentado dos tipos do server, seguindo a convenção de
`relatorio-semanal/types.ts`). Dark e light em todos.

**Acesso.** Não precisa de SQL nem de mexer em `auth_users`. O gate real é
`ROUTE_TO_PERMISSION` em `shared/nav-config.ts`: `hasAccess()` resolve a rota
para uma *permission key* e libera quem tiver aquela chave. Mapeando
`/reports/operacao` → `PERMISSION_KEYS.REPORTS.MENSAL` — a mesma chave de
`/reports/semanal` e `/reports/mensal` — todo mundo que já vê os reportes ganha
a tela nova no mesmo deploy, e admin passa direto.

## Testes

`derivarOperacao.test.ts`, sobre a derivação pura (sem banco):

- Líquido = Total − Abonado, inclusive quando Abonado = Total (líquido zero)
- Δ relativo em moeda × Δ em pontos percentuais nas linhas de %
- headcount 0 → `null` (renderiza `—`), nunca `Infinity`
- base de abertura 0 → % zerado, não `NaN`
- semana sem churn → tabela de motivos vazia, não quebra
- motivo presente só na semana anterior aparece na tabela com atual = 0

`headcount-operacao.test.ts`: a normalização de squad casa `🪖 Selva` e `Selva`,
e exclui `💰 Vendas`, `Vendas` e `Hunters (OFF)` corretamente.

**Validação contra produção.** Diferente de `/reports/semanal`, esta tela não
usa `channel` do CRM — a coluna não existe no banco local, o que impedia
conferir aquela tela em dev. Esta dá para validar em `localhost` desde que
`cup_contratos`, `cup_churn`, `cup_data_hist` e `rh_pessoal` estejam
sincronizados. Ainda assim, a reconciliação final (drawer × célula, em pelo
menos duas semanas fechadas) roda contra produção, porque o local é espelho
parcial.
