# Design — Creators: Recorrente × Pontual

**Data:** 2026-06-21
**Status:** Aprovado (design) — aguardando revisão do spec
**Branch:** `feature/creators-modelo-rec-vs-pontual`
**Página:** `/creators-modelo` (grupo Gestão)

---

## 1. Pergunta de negócio

Em março/2026 a Turbo transformou o produto **Creators** de majoritariamente recorrente
em majoritariamente pontual (pontual saltou de ~30 para **109** contratos/mês em mar/2026
e ficou alto; recorrente minguou para 2-7/mês). A decisão estratégica em aberto:

> **Foi uma boa decisão?** O cliente pontual vale mais ou menos que o recorrente ao longo
> da vida, e como se comporta a retenção/churn dos dois modelos — inclusive o churn de
> clientes pontuais que saem antes de completar as 4 entregas?

A página existe para responder isso com **LT, LTV e churn comparados** entre os dois modelos,
de forma **metodologicamente honesta** (sem favorecer artificialmente nenhum lado).

---

## 2. Achados da investigação (produção `dados_turbo`, 2026-06-21)

Estes achados moldaram cada decisão de design.

### 2.1 Split atual de Creators (`cup_contratos`, `produto ILIKE '%creator%'`)
| Modelo | Contratos | Clientes | Σ valorr (MRR) | Σ valorp |
|---|---|---|---|---|
| Pontual (`valorp>0`) | 507 | 329 | — | R$ 3,07M |
| Recorrente (`valorr>0`) | 158 | 156 | R$ 560k | — |
| Sem valor | 25 | 20 | — | — |

Ambos existem desde 2024 — o "pivot" foi mudança de **mix**, não corte seco.

### 2.2 Status significa coisas diferentes nos dois modelos (NÓ CENTRAL)
- **Recorrente** — status = estado da assinatura: `ativo` (pagando) vs `cancelado/inativo`
  (churn). Limpo, 2 estados.
- **Pontual** — status = estado da **entrega**, não assinatura:
  - `entregue` (283) = entrega concluída com **sucesso** (NÃO é churn)
  - `triagem` (71) / `onboarding` / `ativo` / `pausado` = em produção
  - `cancelado/inativo` (64) = cancelado de fato (saiu no meio)

  → Juntar "concluiu" com "cancelou" no mesmo balde distorceria a decisão. Pontual precisa
  de **3 estados**: Em produção / Concluído / Cancelado.

### 2.3 Estrutura dupla do pontual (decisivo)
- Só **62 de 329 clientes pontuais (19%)** compram em **sequência de entregas**
  (`servico ~* 'entrega'`: "1ª/2ª/3ª/4ª Entrega - Creators").
- Os outros **267 (81%)** compram **pacote avulso** ("Creators Pontual",
  "Creators Pontual - Starter", "Creators Scale") = **compra única**.
- → O "funil de 4 entregas" só se aplica a 1/5 dos clientes. Para os 4/5 a retenção é
  simplesmente "recomprou?" (raro: ~1,3 contrato/cliente).

### 2.4 LT em meses do pontual é fraco
Contratos pontuais de um mesmo cliente têm `data_inicio` quase idêntica (span médio ≈ 0,5 mês),
porque são datados na **venda** (memória: `data_criado == data_inicio` 100%). Logo o "LT em meses"
do pontual quase não varia — **o sinal real de lifetime pontual é o nº de entregas**, não o tempo.

### 2.5 Funil de entregas confirma a dor do churn (base = entregas concluídas)
| Entrega | Clientes que concluíram |
|---|---|
| 1ª | 37 |
| 2ª | 16 (−57%) |
| 3ª | 10 |
| 4ª | **6** |

Só **6 de 37 (16%)** chegam à 4ª entrega concluída; maior sangria é 1ª→2ª. Confirma:
"muito churn antes da 4ª entrega".

### 2.6 Preview de LTV/LT (ballpark, será recalculado pelos helpers)
- **Recorrente** (nível contrato, LT em curso p/ ativos, exclui LT<0):
  - Ativo: 45 · LT 6,1m · MRR R$5.701 · LTV R$29.010
  - Cancelado: 110 · LT 4,0m · MRR R$2.684 · LTV R$9.943
- **Pontual** (nível cliente, LTV = Σ valorp):
  - Concluído: 223 · 1,3 contratos · LTV R$6.730
  - Em produção: 84 · 2,2 contratos · LTV R$16.269 (os recompradores — os "bons")
  - Cancelado: 21 · LTV R$9.516

---

## 3. Decisões de design (confirmadas com o usuário)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Unidade da tabela | **Toggle Por cliente / Por contrato** |
| 2 | Estados do pontual | **3 estados**: Em produção / Concluído / Cancelado |
| 3 | LT do pontual | **nº entregas + meses span lado a lado** (headline = nº entregas) |
| 4 | Comparação de churn | **Funil de sobrevivência + número-resumo** por modelo |
| 5 | Local | **Página dedicada nova** `/creators-modelo` |
| 6 | Viés de maturidade | **Filtro de período + avisos** na tela |
| 7 | Avulso vs sequenciado | **Separar**: funil p/ 19% sequenciados + card recompra p/ 81% avulsos |
| 8 | LTV recorrente | **Só realizado até hoje** (MRR × meses decorridos), comparável a valorp pago |

---

## 4. Layout da página

Filtros no topo (barra única):
**Situação** (`Ativo · Cancelado · Ambos`) · **Período de início** (default: tudo) ·
toggle **Por cliente / Por contrato** · toggle **Média / Mediana**.

> O filtro Situação mapeia: Ativo → recorrente `ativo` + pontual `Em produção`;
> Cancelado → recorrente `cancelado` + pontual `Cancelado`; Ambos → tudo
> (pontual `Concluído` sempre visível, rotulado como sucesso, nunca como churn).

### A) Cards-headline (3 colunas)
- **Recorrente** — nº clientes · LTV médio (realizado) · LT médio (meses) · churn (% cancelado)
- **Pontual** — nº clientes · LTV médio · nº entregas médio · % que não chega à 4ª (sequenciados)
- **Δ Comparação** — qual modelo entrega mais LTV/cliente + aviso de maturidade quando as
  idades médias divergem muito.

### B) Tabela principal (LT & LTV)
Linhas = modelo; pontual quebrado por estado:
```
Recorrente            n   LT(m)   —          LTV médio   LTV total   idade média
Pontual — Em produção n   span(m) nº entregas LTV médio   LTV total   idade média
Pontual — Concluído   n   span(m) nº entregas LTV médio   LTV total   idade média
Pontual — Cancelado   n   span(m) nº entregas LTV médio   LTV total   idade média
```
- Coluna "nº entregas" só para linhas pontuais (recorrente mostra "—").
- Respeita toggle cliente/contrato e média/mediana.
- "idade média da coorte" = meses desde `data_inicio` até hoje (expõe o viés de maturidade).

### C) Funil de sobrevivência + recompra (lado a lado)
- **Pontual sequenciado** (62 clientes, 19%): 1ª→2ª→3ª→4ª entrega; toggle base **vendido/entregue**
  (reaproveitado do churn-pontorrente). Rótulo: "aplica-se a 19% dos clientes pontuais".
- **Recorrente**: % ainda ativo após **1 / 3 / 6 / 12 meses** (curva de sobrevivência por coorte).
- **Card recompra** (267 avulsos, 81%): % de clientes pontuais avulsos que compraram **≥2 vezes**.

### D) Avisos de honestidade metodológica (banners discretos)
- ⚠️ Pontual é mais novo (pós-março) → LTV ainda em formação; use o filtro de período para
  comparar coortes de maturidade parecida.
- ⚠️ Funil de 4 entregas cobre só 19% dos clientes pontuais; 81% são compra única.
- ⚠️ LT em meses do pontual é pouco informativo (contratos datados na venda) → leia por nº de entregas.

---

## 5. Definições métricas (contrato de dados)

| | **Recorrente** | **Pontual** |
|---|---|---|
| Universo | `produto ILIKE '%creator%' AND valorr>0` | `produto ILIKE '%creator%' AND valorp>0` |
| Unidade de valor | MRR (`valorr`) | `valorp` |
| **LTV** | MRR × **meses decorridos** (realizado, não projetado) | **Σ valorp** do cliente/contrato |
| **LT** | meses: `data_inicio` → `COALESCE(data_encerramento, cup_churn.ultimo_dia_operacao)`; ativos = até hoje; **excluir LT<0** | nº de entregas concluídas (headline) **+** span em meses (1º→último contrato) |
| **Estados** | Ativo (`status NOT IN ('cancelado/inativo','não usar')`) / Cancelado | Em produção (`triagem/onboarding/ativo/pausado`) / Concluído (`entregue`, sem cancelamento) / Cancelado (`cancelado/inativo`) |
| **Churn** | % cancelado + curva sobrevivência mensal | funil de entregas (sequenciados) + % recompra (avulsos) |
| Sequenciado | n/a | `servico ~* 'entrega'` e `servico !~* 'rótulos'`; nível via regex `entrega\s*0*(\d+)` ou `(\d+)\s*ª?\s*entrega`, capado em 4 |

**Toggle Por cliente / Por contrato:**
- Por contrato: 1 linha = 1 `id_subtask` (recorrente) ou 1 contrato pontual.
- Por cliente: agrega por `id_task`. LTV cliente = Σ; LT recorrente cliente = do 1º início ao
  último fim; **nº de compras/entregas pontual = contagem de contratos pontuais do cliente**
  (métrica uniforme p/ avulso e sequenciado). O **funil de entregas** (seção 4C) é separado e usa
  o MAX nível sequenciado só dos 19% sequenciados — não se confunde com esta coluna da tabela.

**Higienização:** `TRIM()` em status/campos texto; comparar status em lowercase.

---

## 6. Backend

- Novo `server/routes/creatorsModelo.ts` — endpoint único `GET /api/creators-modelo`
  com params: `situacao`, `de`, `ate`, `unidade` (cliente|contrato), `agregador` (media|mediana).
- Lógica de negócio pura e testável em `server/routes/creatorsModelo.helpers.ts`
  (cálculo de LT/LTV, classificação de estados, montagem das linhas da tabela, curva de
  sobrevivência recorrente, % recompra).
- **Reaproveitar** `churnPontorrente.helpers.ts` para o funil de entregas
  (`extractNivelEntrega`, `toJornadas`, `buildFunil`) restrito a Creators.
- **Reaproveitar** a régua de LT recorrente já validada do domínio `ltLtvChurn`
  (exclusão de LT<0, `COALESCE` do fim via `cup_churn.ultimo_dia_operacao`).
- Registrar rota em `server/routes.ts` (sob `isAuthenticated`).
- Resposta tipada compartilhada em `shared/` ou nos types do componente.

**Fontes:** `"Clickup".cup_contratos` (valorr/valorp/status/datas/servico/produto/id_task),
`"Clickup".cup_churn` (`ultimo_dia_operacao`, join `task_id = id_subtask`).
Não usar `caz_parcelas` (receita só desde set/2025) nem `cup_churn.lt` (corrompido).

---

## 7. Frontend

- `client/src/pages/CreatorsModelo.tsx` — página + filtros.
- `client/src/components/creators-modelo/` — `HeadlineCards`, `TabelaLtLtv`,
  `FunilSobrevivencia`, `CardRecompra`, `AvisosMetodologicos`, `types.ts`, `utils.ts`.
- React Query para fetch; Recharts para funil/curva; dark/light obrigatório
  (`dark:` em todas as cores); formatadores de moeda sem decimais.
- Adicionar item no menu (grupo Gestão) e cross-links de `/creators-pontual` e `/lt-ltv-churn`.

---

## 8. Testes mínimos

- `creatorsModelo.helpers.test.ts`: classificação de estados (os 3 pontuais + 2 recorrentes),
  LT recorrente com exclusão de LT<0, LTV realizado (ativo vs cancelado), agregação por cliente
  vs contrato, % recompra, idade de coorte. Fixtures sintéticas (sem banco).

---

## 9. Fora de escopo (YAGNI — v2)

- Quebra por squad / vendedor / operador de entrega.
- Custo do creator externo (margem real) via `cortex_core.contratos_creators`.
- Projeção de LTV maduro (MRR ÷ churn) — decidido usar só realizado.
- Coorte forçada por safra (mantido como filtro de período opcional).
