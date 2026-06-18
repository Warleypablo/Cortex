# BP 2026 — Orçado × Realizado (Parte 6: Drill-down por célula)

**Data:** 2026-06-10
**Status:** Aprovado
**Base:** Partes 1–5b. Clicar numa célula (linha × mês) abre o detalhamento dos itens que compõem o realizado.

## Decisões (aprovadas pelo usuário)

| Decisão | Escolha |
|---|---|
| Container | Drawer lateral (Sheet do shadcn) — matriz visível ao fundo |
| Organização | Grupos com subtotal (por categoria do Conta Azul; por squad no MRR) |
| Derivadas | Mini-demonstrativo do mês com as linhas componentes — client-side, sem ida ao banco |
| DFC real | Grupos "Entradas" e "Saídas" por categoria, 10 maiores itens por grupo + agregado "+N itens" |

## Arquitetura

- **`server/routes/bp2026.predicados.ts`** (novo): única fonte de verdade dos predicados de categoria por métrica (`PREDICADOS_DESPESA: Record<string, SQL>`), usado pela agregação (`bp2026.ts`) e pelo detalhe — célula e detalhamento não podem divergir.
- **`server/routes/bp2026.detalhe.ts`** (novo): `GET /api/bp2026/detalhe?metrica=X&mes=N` (registrado junto da rota existente). Sem cache (consulta pontual e leve).
- `bp2026.ts` passa a importar os predicados (refactor sem mudança de comportamento, verificado por diff de payload).

## Contrato da API de detalhe

```json
{
  "metrica": "csv_salarios", "mes": 5, "titulo": "(−) CSV — Salários",
  "orcado": 488401, "realizado": 363558,
  "grupos": [
    { "titulo": "05.01.02 Gestor de Performance", "total": 65000,
      "itens": [{ "nome": "Fulano", "detalhe": "Pagamento Colaborador", "data": "2026-05-05", "valor": 5000 }],
      "itensOmitidos": { "qtd": 12, "valor": 18000 } }
  ],
  "nota": "…"
}
```

`mes` 1–12; métrica inválida ou derivada → 400; mês sem realizado (futuro) → 200 com grupos vazios e realizado null.

## Detalhe por métrica

| Métrica | Fonte e agrupamento |
|---|---|
| `mrr_ativo` | `cup_data_hist` no snapshot usado pelo mês (mesma resolução MAX(d) da agregação) + join `cup_clientes ON task_id = id_task`; grupos por `squad`; item = cliente · serviço · valorr. Sem `itensOmitidos` (lista completa). |
| `receita_pontual` | `crm_deal` ganhos no mês; grupo único "Vendas pontuais"; item = title · closer (campo `detalhe`) · data_fechamento · valor_pontual. |
| `outras_receitas` | Parcelas RECEITA por `data_competencia` no mês, categorias da agregação; grupos por categoria; item = contraparte · descricao · data · valor_liquido. |
| `inadimplencia` | 2 grupos: "Vencidas não pagas" (RECEITA, `data_vencimento` no mês e ≤ hoje, `nao_pago > 0`; item = contraparte · descricao · data_vencimento · nao_pago) e "Estornos e devoluções" (bucket 05.06 por quitação). |
| `impostos_receita`, `csv_salarios`, `csv_stack`, `cac`, `bonus`, `impostos_diretos`, `capex` | Parcelas DESPESA QUITADO do bucket (predicado compartilhado) por `data_quitacao` no mês; grupos por categoria (prefixo normalizado de `categoria_nome`); item = contraparte · descricao · data_quitacao · valor_pago. |
| `csv_beneficio` | Parcelas do Caju (06.10.04) no mês + **rodapé de rateio**: campo extra `rateio: { fracao, totalBruto, totalRateado }` — o realizado da célula = totalBruto × fração orçada. |
| `sga` | Bucket por categoria + grupo sintético final "Complemento do benefício (rateio)" com 1 item agregado (valor = complemento do mês). |
| `dfc_real` | 2 grupos: "Entradas" e "Saídas" — dentro de cada, subgrupos por categoria? Não: grupos = categorias, separados por um campo `secao: "entradas" | "saidas"`; 10 maiores itens por grupo + `itensOmitidos`. Simplificação aceita: grupos por categoria com prefixo "(+)"/"(−)" no título e ordenados (entradas primeiro). |
| derivadas (`receita_total_faturavel`, `receita_liquida`, `margem_bruta`, `ebitda`, `geracao_caixa`) | **Client-side**: o drawer mostra as linhas componentes do mês (orçado/realizado/atingimento, dados do payload existente). Endpoint retorna 400 para elas. |

Contraparte: `LEFT JOIN "Conta Azul".caz_clientes c ON p.id_cliente::text = c.ids::text` (cobertura 99,96% validada); fallback para `descricao` quando nula.

**Invariante:** soma dos `total` dos grupos = realizado da célula (exceto `csv_beneficio`, onde a célula = `rateio.totalRateado`, e `sga`, onde o grupo sintético fecha a conta). Verificado em teste/smoke.

**Limite de itens:** grupos de despesa/receita listam até 50 itens; excedente vira `itensOmitidos { qtd, valor }`. DFC: 10 por grupo.

## Frontend

- **`client/src/components/bp2026/BPCellDetail.tsx`** (novo): Sheet lateral. Header = título da linha · mês/2026 · orçado | realizado | atingimento (cor por direção). Corpo = grupos com subtotal (Collapsible aberto por padrão quando ≤ 3 grupos, fechado quando mais). Rodapé = total + nota da linha. Para `csv_beneficio`, bloco do rateio. Para derivadas, mini-demonstrativo client-side (componentes do payload). Loading skeleton + estado de erro.
- **`BPDreTable.tsx`**: célula com `realizado !== null` ganha `cursor-pointer` + hover (`hover:bg-gray-50 dark:hover:bg-zinc-800/70`) + onClick → `onCellClick(metrica, mes)`. Página `BP2026.tsx` controla o estado `{metrica, mes} | null` e renderiza o Sheet. YTD não clicável nesta parte.
- React Query: `queryKey: ["/api/bp2026/detalhe", { metrica, mes: String(mes) }]` — o `getQueryFn` do projeto (queryClient.ts:74-87) converte o objeto da posição 1 em query string automaticamente; cache por célula sai de graça.
- Dark/light obrigatório.

## Testes
- Helpers puros de agrupamento (`agruparPorCategoria(itens)`, corte de 50 + itensOmitidos) com testes unitários.
- Smoke do endpoint: invariante soma dos grupos = célula para ≥ 3 métricas (salários, inadimplência, dfc) num mês fechado.

## Fora de escopo
- Clique no YTD; exportação; edição; drill do orçado (orçado é da planilha, sem itens).

## Workflow
Mesma branch/PR #247. Subagent-driven; validação visual dark/light.
