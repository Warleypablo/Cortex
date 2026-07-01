# Gestão de Receita — Drill-down por célula

**Data:** 2026-06-30 · **Rota base:** `/gestao/receita` · **Status:** aprovado

## Objetivo
Ao clicar num elemento da página (card, linha de tabela, item de ranking, barra do
funil), abrir um **Sheet lateral** com a lista de itens que compõem aquele número —
espelhando o drill-down do BP 2026.

## Decisões (aprovadas)
1. Drill em **todas as 4 famílias** de células.
2. **Sheet lateral** (mesmo componente/UX do `BPCellDetail`).
3. Drill por **elemento** (não célula isolada).

## Arquitetura
- **Backend:** endpoint `GET /api/gestao/receita/detalhe?tipo=X&chave=Y&mes=YYYY-MM`
  em `server/routes/gestaoReceita.detalhe.ts` (lógica) registrado no
  `registerGestaoReceitaRoutes`. Retorna `{ titulo, subtitulo, total, unidade, grupos: GrupoDetalhe[] }`.
  Reusa `agruparItens()` e `ItemDetalhe` de `bp2026.helpers`. Limite 50/grupo.
- **Frontend:** componente `client/src/components/gestao/GestaoReceitaDetalhe.tsx`
  (Sheet de `@/components/ui/sheet`), acionado por `const [drill,setDrill]=useState(null)`
  em `GestaoReceita.tsx`. Query React: `["/api/gestao/receita/detalhe", {tipo,chave,mes}]`.

## Tipos de drill (whitelist) → query
| tipo | chave | fonte | itens (grupo) |
|---|---|---|---|
| `venda_mrr` | — | Bitrix ganho, valor_recorrente>0 | deal (por closer), valor=recorrente |
| `venda_pontual` | — | Bitrix ganho, valor_pontual>0 | deal (por closer), valor=pontual |
| `canal` | source | Bitrix ganho, source=chave | deal (por closer) |
| `closer` | nome | Bitrix ganho, closer=chave | deal (por canal) |
| `sdr` | nome | Bitrix ganho, sdr=chave | deal (por closer) |
| `funil_etapa` | lead/ra/rr/venda | Bitrix por data da etapa | deal (por canal); valor=0 p/ lead/ra/rr |
| `mql` | MQL/NMQL/sem | Bitrix leads do mês | deal (por canal); valor=0 (contagem) |
| `produto` | produto | ClickUp data_criado | contrato (por status), valor=valorr+valorp |
| `churn_motivo` | motivo | cup_churn por encerramento | contrato (por vendedor), valor=valor_r |
| `churn_vendedor` | vendedor | cup_churn por encerramento | contrato (por motivo), valor=valor_r |
| `cac` / `custo_comercial` / `comissoes` | — | caz_parcelas (predicados BP) | parcela (por subcategoria), valor=valor_pago |

## Affordance
Elementos clicáveis ganham `cursor-pointer` + hover; layout inalterado. Cada drill
usa o **mesmo filtro/data da célula** (total do Sheet bate com o número clicado;
exceção: produto pontual mostra entregas com nota, pois a célula dedupa por jornada).

## Segurança
`tipo` validado contra a whitelist acima; `chave`/datas sempre parametrizadas no SQL.

## Limitações
- Itens de contagem (lead/ra/rr, mql) vêm com valor=0 → o Sheet exibe contagem (padrão BP).
- Produto pontual: o drill lista entregas reais (não deduplica) — total pode diferir da
  célula deduplicada; nota no Sheet explica.
