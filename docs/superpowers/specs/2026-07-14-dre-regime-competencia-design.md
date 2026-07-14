# DRE — Passar a base de data para Competência

**Data:** 2026-07-14
**Branch:** `feature/dre-regime-competencia`

## Problema

A tela DRE (`/dashboard/dre`) operava em **regime de caixa** — o título "(Regime de
Caixa)" era hard-coded e o endpoint montava os valores por `data_quitacao` (quando o
dinheiro entrou/saiu). O que se quer ver é o resultado pela **competência**: o mês em que a
receita/despesa foi reconhecida (faturada), não o mês em que foi paga.

> **Decisão do usuário:** a DRE deve ser **sempre por competência**. Não há alternância de
> regime — nada de toggle Caixa/Competência. (Uma primeira iteração chegou a ter o toggle,
> mas foi removida a pedido: só competência.)

## Descoberta-chave

A tabela `"Conta Azul".caz_parcelas` **possui `data_competencia`** (coluna real no banco,
não mapeada no `shared/schema.ts`). Está 100% preenchida em prod (10.560/10.560) e local
(10.420/10.420), cobrindo nov/2024 → set/2026, inclusive parcelas pendentes/atrasadas e de
competência futura. Isso permite competência **real** — não uma proxy por vencimento como
no Investors Report.

## Definição adotada

A base de cada valor da DRE passa a ser:

| | Antes (Caixa) | Agora (Competência) |
|---|---|---|
| Campo de data (define mês/ano) | `data_quitacao` | `data_competencia` |
| Valor | `valor_pago` | `valor_bruto` |
| Filtro de status | `status = 'QUITADO'` | (nenhum — todos os status) |

Semântica: **faturado** — reconhece o valor cheio (`valor_bruto`) no mês de competência,
incluindo parcelas pendentes, atrasadas e futuras.

Validação (Receita Bruta 2026, competência): Jan R$ 1.375.191, Fev 1.352.749,
Mar 1.408.504, Abr 1.685.819, Mai 1.362.089, Jun 1.704.845, Jul 1.681.984,
Ago 1.191.798 (mês futuro, que em caixa aparecia vazio).

## Design

### Backend — `server/routes/dre.ts`

As duas queries (principal + fornecedores) passam a usar, sem parâmetro de regime:
- `EXTRACT(… FROM p.data_competencia)` para mês/ano;
- `p.valor_bruto` como valor na query principal (a de fornecedores já usava `valor_bruto`);
- sem o filtro `status = 'QUITADO'`.

### Frontend — `client/src/pages/DRE.tsx`

- Título fixo em "(Regime de Competência)".
- Barra de filtros sem seletor de regime — mantém Ano, Empresa, Visão e AV%.

## Fora de escopo (YAGNI)

- Alternância de regime / toggle Caixa vs Competência.
- Mapear `data_competencia` no `shared/schema.ts` (a query é SQL raw, não usa o objeto Drizzle).
- Alterar `caz_receber`/`caz_pagar` ou o módulo de regime do Investors Report.

## Validação

- `npx tsc --noEmit` limpo nos arquivos tocados.
- Query real conferida contra o banco local e prod.
- Teste visual no browser em `/dashboard/dre` (título "Regime de Competência", coluna de
  agosto passa a exibir valores).
