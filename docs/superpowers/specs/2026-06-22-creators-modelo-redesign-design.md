# Design — Redesign /creators-modelo: "Vale mais pontual ou recorrente?"

**Data:** 2026-06-22
**Status:** Aprovado (design) — aguardando revisão do spec
**Substitui:** a tela `/creators-modelo` atual (tabela-auditoria) por completo
**Origem:** revisão executiva Victor Peixoto (CEO) + feedback do usuário de que a tela não decide

---

## 1. Pergunta de negócio (a única que importa)

> **Vale mais a pena vender Creators PONTUAL ou RECORRENTE?**

Tensão real, confirmada nos dados: o **recorrente retém e vale muito mais por cliente**, mas o
**pontual gera muito mais caixa/volume** (pós-pivot de mar/2026). A tela atual mostra métricas
lado a lado mas **não responde** — termina num funil sem "e daí?". O redesign transforma uma
tela de auditoria numa tela de **decisão executiva**.

## 2. Diagnóstico que motiva o redesign (Victor + recompute)

Recomputado em `cortex_dev` (espelho; prod estava com timeout de rede). Números-âncora:

| Dimensão | Recorrente | Pontual |
|---|---|---|
| LTV por cliente (realizado, blended) | **R$ 14,4k** (R$ 29,5k entre ativos) | **R$ 9,4k** |
| Receita total no histórico | R$ 2,24M realizado + **R$ 248k/mês** MRR vivo | **Σ R$ 3,06M** (valorp) |
| Clientes | 155 | 325 |
| Ticket por entrega (concluído) | — | R$ 5,3k |
| Retenção | LT maior, churn por cancelamento | ~5% recompram; 88% compram 1x |

**Break-even decisivo (faixa):** um cliente pontual precisa recomprar **~2,7×** (R$14,4k realizado
blended ÷ R$5,3k) a **~5–6×** (R$29,5k maduro/ativo ÷ R$5,3k) para igualar 1 recorrente — mas
**~5% recompram uma vez** (avulsos médios ~1,05 compras). → Por cliente, recorrente domina; pontual
só vence por **volume de clientes novos**, não pelos mesmos clientes.

### Bugs que o Victor recalculou (corrigir no redesign)
1. **LTV recorrente ativo subestimado ~9%**: `classifyEstadoRecorrente` (helpers.ts:37) trata todo
   `!isChurned` como ativo, incluindo status `entregue`/`em cancelamento` com `ltv_recorrente=NULL`
   (somado como 0). Real R$29.469 vs exibido R$26.727.
2. **Filtro "Situação" só afeta a tabela** — cards/funil/recompra ignoram (CreatorsModelo.tsx:93).
   Card diz "filtrado" mas mostra a base inteira.
3. **Curva de sobrevivência mistura coortes** → "97% morre em 1 ano" (contradiz LT médio 6m) e
   quebra (0%) com filtro de período. Tem que ser por safra.
4. **Aviso de maturidade desligado**: limiar absoluto `|11,4−7,5|>6` = false, mesmo com recorrente
   52% mais velho. Trocar por razão (>40%).
5. **Sem item de menu / cross-links** (nav-config tem; faltam cross-links de /creators-pontual e /lt-ltv-churn).

## 3. Decisões de design (confirmadas com o usuário)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Resposta no topo | **Placar de 2 dimensões + break-even** (não força vencedor único) |
| 2 | LTV maduro do recorrente | **Faixa realizado → projetado** (piso MRR×LT → projeção por churn) |
| 3 | Mix de receita no tempo | **Mensal desde 2024** (vendas novas por modelo, R$ + contagem) |
| 4 | Substituição | **Substituir a /creators-modelo atual por completo** |
| 5 | Margem (custo creator) | **Fora** — só 12% de cobertura (`contratos_creators`); sinalizar como "dado insuficiente" |
| 6 | Simulador de cenários / CAC-payback | **v2** (sem dado de CAC por modelo) |
| 7 | LT do cliente pontual | **span entre 1ª e última entrega elegível** (status entregue/ativo/pausado) — preservado da branch de fix |

## 4. Layout (a tela de cima p/ baixo)

Filtro global no topo: **Período de início** (default: tudo). O filtro de Situação some do topo
(virou redundante com o placar); se mantido, afeta TODOS os blocos (correção do bug #2).

### Seção 1 — Placar da decisão (3 blocos grandes, hero)
- **Bloco A — Por cliente (valor/retenção):** LTV/cliente **blended×blended** (apples-to-apples):
  Recorrente R$14,4k vs Pontual R$9,4k (~1,5x). Subtexto: "entre ativos, recorrente R$29,5k; ajuste
  de maturidade na Seção 3". NÃO comparar recorrente-ativo com pontual-blended (o erro que a tela
  atual comete).
- **Bloco B — Volume/caixa no período:** Pontual Σ valorp vs Recorrente (LTV realizado + MRR
  corrente/mês), com nº de clientes de cada. Leitura "pontual gerou ~M% mais caixa, p/ ~2x clientes".
- **Bloco C — Break-even de recompra (faixa):** frase-âncora "um pontual precisa recomprar ~2,7x
  (realizado) a ~5–6x (maduro) para igualar 1 recorrente; hoje só ~5% recompram". Cor/ícone que
  sinaliza o gap entre o necessário e o real.

### Seção 2 — Mix de receita no tempo (a história do pivot)
Gráfico de barras empilhadas/combinado, **mensal desde jan/2024**: vendas novas por modelo
(R$ de valorp pontual vs novo MRR recorrente) + contagem de contratos novos por modelo + linha do
MRR recorrente vivo decaindo. Marco visual em mar/2026 (109 pontuais × 3 recorrentes). Conta o pivot.

### Seção 3 — LTV por cliente, ajustado por maturidade
Barras Recorrente vs Pontual:
- Recorrente: **faixa** realizado-até-hoje → projetado maduro (piso `MRR × LT médio blended`;
  topo `MRR ÷ churn mensal`), com a premissa rotulada.
- **Coorte-controle:** toggle "mesma idade" que filtra ambos os modelos para clientes que entraram
  na mesma janela (ex.: mar–jun/2026), removendo o viés de maturidade. Mostra que o recorrente
  empata/ultrapassa o pontual já em poucos meses.
- Aviso de maturidade por **razão** (recorrente/pontual idade > 1,4).

### Seção 4 — Retenção
- Pontual: funil de entregas (1ª→4ª, base vendido/entregue) — mantido, eixos rotulados.
- Recorrente: **sobrevivência por safra real** (% ainda ativo por mês-de-entrada), não a curva
  misturada atual.
- Card de recompra dos avulsos (mantido).
- Escalas/eixos separados e rotulados (correção visual do Victor).

### Seção 5 — Leitura recomendada ("e daí?")
2–3 linhas contextuais, sem forçar vencedor:
- *Pontual ganha em caixa/volume **se** houver fluxo contínuo de clientes novos a CAC baixo.*
- *Recorrente ganha em valor por cliente e ativo que compõe (MRR).*
- *Risco do pivot: trocar MRR composto por caixa de uma vez; pontual quase não recompra.*

## 5. Definições métricas (contrato de dados)

| Métrica | Definição |
|---|---|
| LTV/cliente recorrente (realizado) | Σ `ltv_recorrente` por `id_task`; **excluir contratos com `ltv_recorrente IS NULL` do balde ativo** (correção bug #1); ativo = `is_churned=false AND ltv_recorrente IS NOT NULL` |
| LTV maduro recorrente (faixa) | piso = `MRR_ativo × LT_médio_blended`; topo = `MRR_ativo ÷ churn_mensal`. Churn mensal = cancelados no mês ÷ base ativa início do mês (ou `1/LT_médio` como proxy, rotulado) |
| Receita pontual (período) | Σ `valorp` dos contratos pontuais Creators no período |
| Receita recorrente (período) | Σ `ltv_recorrente` realizado + `MRR corrente` (Σ valorr dos ativos) |
| Break-even recompra (faixa) | mínimo = `LTV_rec_realizado_blended ÷ ticket_pontual_médio(entregue)`; máximo = `LTV_rec_maduro ÷ ticket_pontual_médio`. Comparar com a recompra real (~5%) |
| LTV/cliente recorrente (blended) | Σ `ltv_recorrente` por `id_task` / nº clientes recorrentes (inclui cancelados); base do Bloco A |
| Mix mensal | por mês de `data_inicio`: nº e Σ valor de contratos novos por modelo; MRR vivo via snapshot/soma |
| Curva sobrevivência recorrente (safra) | por mês de entrada (`data_inicio`), % ainda ativo após N meses dentro da própria coorte |
| LT pontual | span 1ª→última entrega elegível (`status IN entregue/ativo/pausado`); ~0 se 1 entrega; null se nenhuma |
| Coorte-controle | filtra ambos os modelos por janela de `data_inicio` igual |

Fonte única: `cortex_core.vw_lt_contratos` (produto='Creators'). Margem (`contratos_creators`):
cobertura 12% → **não usar como métrica**; opcionalmente exibir "custo de creator conhecido em só
12% dos clientes — insuficiente p/ margem".

## 6. Backend

- Estender `server/routes/creatorsModelo.helpers.ts`: novos builders puros e testáveis —
  `buildPlacar` (3 blocos), `buildMixMensal`, `buildLtvMaduro` (faixa), `buildBreakEven`,
  `buildSobrevivenciaSafra`. Corrigir `classifyEstadoRecorrente`/agregação do LTV ativo (bug #1).
- Endpoint `GET /api/creators-modelo` retorna o novo payload (placar, mixMensal, ltvMaduro,
  breakEven, retencao{funil, safra, recompra}, leitura, meta). Filtro de período propagado a TODOS
  os blocos (bug #2).
- Reaproveita funil (`churnPontorrente.helpers`) e `mediana` (`ltLtvChurn.helpers`).
- Preserva `isEntregaElegivel` + LT pontual da branch de fix (decisão #7).

## 7. Frontend

- `client/src/pages/CreatorsModelo.tsx` reescrita p/ as 5 seções.
- `client/src/components/creators-modelo/`: `PlacarDecisao`, `MixReceitaTempo`,
  `LtvMaturidade`, `Retencao` (funil+safra+recompra), `LeituraRecomendada`, atualizar `types.ts`.
  Componentes antigos (HeadlineCards, TabelaLtLtv, AvisosMetodologicos) removidos ou absorvidos.
- Recharts; dark/light obrigatório; `formatCurrencyNoDecimals`.
- Adicionar cross-links de `/creators-pontual` e `/lt-ltv-churn`; confirmar item no menu Gestão.

## 8. Testes mínimos

- `creatorsModelo.helpers.test.ts`: placar (3 blocos, LTV ativo SEM fantasmas), LTV maduro (faixa
  piso<topo), break-even (razão correta), mix mensal (agrupamento por mês×modelo), curva por safra
  (coorte isolada não mistura), filtro de período afeta todos os builders. Fixtures sintéticas.

## 9. Fora de escopo (sinalizado, não escondido)

- Margem / custo de creator (cobertura 12%).
- Simulador de cenários com sliders (CAC, recompra, churn).
- CAC / payback por modelo (sem dado de CAC por modelo).
- Estes aparecem como "dado insuficiente / v2" na tela, não como lacuna silenciosa.
