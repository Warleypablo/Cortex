# DRE — Filtro de Regime (Caixa / Competência)

**Data:** 2026-07-14
**Branch:** `feature/dre-regime-competencia`

## Problema

A tela DRE (`/dashboard/dre`) opera hoje exclusivamente em **regime de caixa** — o
título "(Regime de Caixa)" é hard-coded e o endpoint só sabe montar os valores por
`data_quitacao`. Queremos permitir alternar para **regime de competência** para ver o
resultado pelo mês em que a receita/despesa foi reconhecida (faturada), não pelo mês em
que foi paga.

## Descoberta-chave

A tabela `"Conta Azul".caz_parcelas` **possui `data_competencia`** (coluna real no banco,
não mapeada no `shared/schema.ts`). Está 100% preenchida em prod (10.560/10.560) e local
(10.420/10.420), cobrindo nov/2024 → set/2026, inclusive parcelas pendentes/atrasadas e de
competência futura. Isso permite competência **real** — não uma proxy por vencimento como
no Investors Report.

## Definição dos regimes

| | Caixa (atual) | Competência (novo) |
|---|---|---|
| Campo de data (define mês/ano) | `data_quitacao` | `data_competencia` |
| Valor | `valor_pago` | `valor_bruto` |
| Filtro de status | `status = 'QUITADO'` | (nenhum — todos os status) |

Semântica de competência aprovada: **faturado** — reconhece o valor cheio (`valor_bruto`)
no mês de competência, incluindo parcelas pendentes, atrasadas e futuras. Nada de filtro
de status.

Validação (Receita Bruta 2026): caixa Jan = R$ 1.251.488 (bate com a tela atual);
competência Jan = R$ 1.375.191; Jul caixa = R$ 657.589 (parcial) vs competência
R$ 1.792.369; Ago competência = R$ 1.222.749.

## Design

### Backend — `server/routes/dre.ts`

- Novo query param `regime` (`'caixa'` | `'competencia'`), default `'caixa'`.
- Fragmentos SQL condicionais aplicados às **duas** queries (principal + fornecedores):
  - `dataCol` = `p.data_competencia` (competência) ou `p.data_quitacao` (caixa) — usado no
    `EXTRACT(MONTH …)` e `EXTRACT(YEAR …)`.
  - `valorPrincipal` = `p.valor_bruto` (competência) ou `p.valor_pago` (caixa) — só na
    query principal; a de fornecedores já usa `valor_bruto`.
  - `statusFilter` = `AND p.status = 'QUITADO'` (caixa) ou vazio (competência).
- `regime` incluído na resposta JSON (documenta o modo usado).
- O modo caixa permanece byte-a-byte igual ao de hoje (default), sem regressão.

### Frontend — `client/src/pages/DRE.tsx`

- Novo state `regime: 'caixa' | 'competencia'`, default `'caixa'`.
- Entra na `queryKey` e na URL do fetch (`&regime=${regime}`).
- Novo `<Select>` "Regime" na barra de filtros (após Empresa, antes de Visão), opções
  "Caixa" / "Competência" — mesmo padrão visual dos Selects existentes, com dark/light.
- Título deixa de ser fixo: `(Regime de Caixa)` / `(Regime de Competência)` conforme o
  state.

## Fora de escopo (YAGNI)

- Mapear `data_competencia` no `shared/schema.ts` (a query é SQL raw, não usa o objeto Drizzle).
- Alterar `caz_receber`/`caz_pagar` ou o módulo de regime do Investors Report.
- Persistir a preferência de regime do usuário.

## Validação

- `npx tsc --noEmit` limpo.
- Query real nos dois regimes conferida contra o banco local e prod.
- Teste manual da rota `/api/financeiro/dre?ano=2026&regime=competencia` e visual no browser
  (caixa deve bater com a tela atual; competência deve mostrar os números da tabela acima).
