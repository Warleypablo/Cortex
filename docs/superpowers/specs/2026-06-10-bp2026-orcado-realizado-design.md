# BP 2026 — Orçado × Realizado (Parte 1: Receitas)

**Data:** 2026-06-10
**Status:** Aprovado
**Substitui:** seção BP Financeiro do OKR 2026 (que permanece no ar até as partes seguintes cobrirem seu escopo)

## Contexto

O BP 2026 foi fechado em dezembro/2025 na planilha `BP 2026 - Turbo - Financials.xlsx` (aba Overview = DRE orçado mensal). A visualização atual de orçado × realizado no OKR 2026 é imprecisa por três razões identificadas:

1. **Targets hardcoded divergem da planilha** (`server/okr2026/bp2026Targets.ts` — ex.: Outras Receitas jan R$ 24.767 no código vs R$ 20.767 na planilha).
2. **Receita Pontual realizada usa vendas ganhas do Bitrix**, misturando venda fechada com receita reconhecida.
3. **Lógica de snapshots automáticos** (`bp_snapshots`) com queries SQL embutidas em `okr2026.ts` (1.795 linhas), difícil de auditar.

A reconstrução será **do zero e por partes**. Esta é a Parte 1.

## Escopo da Parte 1

Bloco de receitas do DRE, agregado (sem drill por squad):

| Linha | Orçado total 2026 |
|---|---|
| (+) MRR Ativo | R$ 20.998.078 |
| (+) Receita Pontual | R$ 4.045.000 |
| (+) Outras Receitas | R$ 1.040.111 |
| (=) Receita Total Faturável | R$ 26.083.189 |

**Fora de escopo:** drill por squad, linhas de despesa/inadimplência/impostos, edição de orçado, exportação, gráficos.

## Decisões de design (aprovadas)

| Decisão | Escolha |
|---|---|
| Localização | Página nova dedicada `/bp-2026` |
| Fonte do orçado | Extração 1:1 do xlsx para tabela no banco (seed idempotente) |
| MRR realizado | ClickUp `cup_data_hist`, snapshot fim do mês |
| Pontual realizada | **Bitrix `crm_deal`, vendas ganhas no mês** (revisado na investigação: o Conta Azul não separa pontual de recorrente — receita de serviços cai toda na categoria 03.01.01 e o rastro parcela→venda→itens cobre só ~metade das parcelas; revisitar quando o financeiro categorizar pontual) |
| Backend | Módulo novo isolado (`server/routes/bp2026.ts`), zero herança do okr2026 |
| Layout | Tabela DRE com seletor de mês + coluna Total YTD |

## Dados

### Orçado

- Tabela nova `cortex_core.bp2026_orcado`:
  - `metrica` TEXT (`mrr_ativo` | `receita_pontual` | `outras_receitas`)
  - `mes` INT (1–12)
  - `valor` NUMERIC
  - `criado_em` TIMESTAMPTZ DEFAULT NOW()
  - PK (`metrica`, `mes`)
- `receita_total_faturavel` não é persistida — derivada como soma das três.
- Script `scripts/seed-bp2026-orcado.py` lê o xlsx (aba Overview, linhas 4–7, colunas Jan–Dez) e faz seed idempotente (`DELETE` por métrica + `INSERT`). Rodar em **local e produção** (regra do projeto).
- A planilha é imutável (BP fechado em dezembro); o seed é a única via de escrita.

### Realizado (calculado ao vivo)

| Linha | Fonte | Definição |
|---|---|---|
| MRR Ativo | `"Clickup".cup_data_hist` | Soma de `valorr` no snapshot do **último dia do mês**, status `ativo`/`onboarding`/`triagem`. Mês corrente: snapshot mais recente disponível. |
| Receita Pontual | `"Bitrix".crm_deal` | Soma de `valor_pontual` dos deals com `stage_name = 'Negócio Ganho'` e `data_fechamento` no mês. Proxy de "vendido" para "faturado" — limitação registrada. |
| Outras Receitas | `"Conta Azul".caz_parcelas` | `tipo_evento='RECEITA'` nas categorias `03.02%`, `03.03%`, `04.01%`, `04.03%`, por `data_competencia`. |
| Total Faturável | derivado | Soma das três linhas. |

**Gate de validação (executado em 2026-06-10 contra produção):**

| Mês | MRR (ClickUp) | Pontual (Bitrix) | Outras (Conta Azul) |
|---|---|---|---|
| Jan | 1.119.046 ✅ (= referência manual da planilha) | 318.311 (ref. manual: 326.472, Δ 2,5%) | 18.179 |
| Fev | 1.139.795 | 472.127 | 17.812 |
| Mar | 1.260.758 | 333.635 | 14.636 |
| Abr | 1.100.088 | 386.082 | 17.954 |
| Mai | 1.030.229 | 364.076 | 15.992 |

## API

`GET /api/bp2026/receitas` (atrás do `isAuthenticated` global):

```json
{
  "linhas": [
    {
      "metrica": "mrr_ativo",
      "titulo": "(+) MRR Ativo",
      "meses": [
        { "mes": 1, "orcado": 1156850, "realizado": 1119046, "atingimento": 0.967, "fonteAproximada": false },
        { "mes": 7, "orcado": 1806544, "realizado": null, "atingimento": null }
      ]
    }
  ],
  "atualizadoEm": "..."
}
```

- Meses futuros: `realizado: null`.
- Cache em memória de 10 minutos (padrão das rotas pesadas do Cortex).
- Registrado em `server/routes.ts`.

## Frontend

Página `client/src/pages/BP2026.tsx` (rota `/bp-2026`, entrada na seção financeira do menu):

- **`BPDreTable.tsx`** — tabela em cascata com prefixos `(+)/(=)`; colunas **Orçado | Realizado | Atingimento** do mês selecionado + coluna fixa **Total YTD** (acumulado orçado × realizado até o mês selecionado). Para MRR Ativo (métrica de estoque, não fluxo), o YTD usa o valor do mês selecionado, não soma.
- **`BPMonthSelector.tsx`** — ◀ Mês ▶, default mês corrente, meses futuros desabilitados.
- Cores semânticas do atingimento: verde ≥ 100%, âmbar 90–99%, vermelho < 90%, cinza sem dado.
- `fonte_aproximada: true` ⇒ tooltip indicando que o snapshot usado não é exatamente o último dia do mês.
- React Query para fetch; sem Recharts nesta parte; dark/light mode obrigatório (`dark:` variants); formatadores de moeda do projeto.

## Erros e casos-limite

- Snapshot do fim do mês ausente em `cup_data_hist` ⇒ usar o snapshot mais próximo **anterior dentro do mês** e marcar `fonte_aproximada: true`.
- Falha de banco ⇒ estado de erro padrão da página (sem cache stale silencioso).
- `caz_parcelas` só tem dados desde set/2025 — não afeta 2026, mas registrado como limite conhecido.

## Testes

- Helpers puros em `server/routes/bp2026.helpers.ts`: cálculo de atingimento, agregação YTD (fluxo vs estoque), resolução de snapshot do mês. Testes unitários no padrão `estoquePontual.helpers.test.ts`.
- Teste local nos dois temas (dark/light) antes de PR.

## Workflow

- Branch `feature/bp2026-orcado-realizado` (worktree isolado).
- Etapa de Investigação obrigatória antes de codar: validar as 3 queries de realizado em produção com o usuário.
- Commits granulares (Conventional Commits), PR para staging.

## Partes futuras (referência, não escopo)

2. Inadimplência + impostos → Receita Líquida
3. CSV → Margem Bruta
4. CAC + SG&A + Bônus → EBITDA; IR/CSLL + CAPEX → Geração de Caixa
5. Métricas gerais (vendas, headcount, clientes/contratos, churn) e drill por squad
