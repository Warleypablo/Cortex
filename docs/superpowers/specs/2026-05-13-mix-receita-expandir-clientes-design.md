# Mix de Receita por Produto — Expandir clientes por produto

**Data:** 2026-05-13
**Branch sugerida:** `feature/mix-receita-expandir-clientes`
**Tela:** `/financeiro/mix-receita` — aba "Por Produto"

## Contexto e objetivo

Hoje a tabela "Mix de Receita por Produto" mostra agregados por produto (MRR Recorrente, Total Pontual, contratos, % recorrente). Para auditoria contra o ClickUp, é preciso descer um nível: ver **quais clientes possuem cada produto e quanto cada um está pagando**.

Objetivo desta feature: tornar a coluna **Produto** expansível na aba "Por Produto", revelando a lista de contratos daquele produto com nome do cliente, valores, squad, responsável e status.

## Decisões de design (alinhadas com o usuário)

| Decisão | Escolha |
|---|---|
| Padrão de UX | Linha expansível inline (mesma tabela, multi-expand permitido) |
| Estratégia fetch | Lazy — chamada on-demand ao expandir |
| Granularidade | Uma linha por contrato (subtask), refletindo ClickUp 1:1 |
| Ordenação | Valor total desc (maior receita primeiro) |
| Colunas expandidas | Cliente · MRR Recorrente · Total Pontual · Squad · Responsável · Status |

**Fora de escopo (explícito):**
- Aba "Por Squad x Produto" — fica como está
- Aba "Evolução temporal" — fica como está
- Link/ID para ClickUp — não solicitado nesta iteração

## Arquitetura

### Backend

Novo endpoint: `GET /api/financeiro/mix-receita/clientes`

**Query params:**
- `produto` (obrigatório) — nome exato do produto (o mesmo valor exibido na tabela principal, incluindo `'(sem produto)'` para nulls/vazios)
- `status` (opcional) — lista de status separada por vírgula; default = `STATUS_PADRAO` (mesmo do endpoint principal)
- `squad` (opcional) — `"todos"` ou nome do squad

**Validações:**
- `produto` ausente → `400 { error: "produto é obrigatório" }`

**Query SQL** (em `server/routes/mixReceita.ts`, mesma file do endpoint principal):

```sql
SELECT
  COALESCE(NULLIF(TRIM(cc.nome), ''), '(cliente não identificado)') AS cliente_nome,
  co.id_task,
  co.id_subtask,
  COALESCE(co.valorr::numeric, 0)::float AS mrr_recorrente,
  COALESCE(co.valorp::numeric, 0)::float AS total_pontual,
  (COALESCE(co.valorr::numeric, 0) + COALESCE(co.valorp::numeric, 0))::float AS total,
  COALESCE(NULLIF(TRIM(co.squad), ''), '(sem squad)') AS squad,
  COALESCE(NULLIF(TRIM(co.responsavel), ''), '(sem responsável)') AS responsavel,
  co.status
FROM "Clickup".cup_contratos co
LEFT JOIN "Clickup".cup_clientes cc ON co.id_task = cc.task_id
WHERE COALESCE(NULLIF(TRIM(co.produto), ''), '(sem produto)') = ${produto}
  AND co.status IN (${statusList})
  ${squadFilter}
ORDER BY total DESC, cliente_nome ASC
```

Notas:
- `LEFT JOIN` em vez de `JOIN` para não perder contratos com `id_task` órfão (defensivo).
- Tiebreaker por `cliente_nome ASC` garante ordem estável quando há vários contratos com o mesmo total.
- Reutiliza o mesmo `STATUS_PADRAO` e a mesma normalização (`TRIM`/`COALESCE`) do endpoint principal para que o filtro bata 1:1 com o card-pai.

**Response shape:**

```ts
interface ContratoCliente {
  cliente_nome: string;
  id_task: string;
  id_subtask: string;
  mrr_recorrente: number;
  total_pontual: number;
  total: number;
  squad: string;
  responsavel: string;
  status: string;
}

interface ClientesPorProdutoResponse {
  produto: string;
  contratos: ContratoCliente[];
  totais: {
    contratos: number;
    mrr_recorrente: number;
    total_pontual: number;
    receita_total: number;
  };
}
```

### Frontend

Mudanças em `client/src/pages/financeiro/MixReceita.tsx`:

**1. Estado de expansão**

```ts
const [expandedProdutos, setExpandedProdutos] = useState<Set<string>>(new Set());

const toggleExpand = (produto: string) => {
  setExpandedProdutos(prev => {
    const next = new Set(prev);
    if (next.has(produto)) next.delete(produto); else next.add(produto);
    return next;
  });
};
```

**2. Nova coluna chevron**

Header recebe um `<Th>` extra (sem ordenação) à esquerda da coluna Produto. Largura fixa ~32px, contém apenas o chevron na linha.

**3. Linha expandida**

Após cada linha de produto, se `expandedProdutos.has(produto)`, renderiza um `<tr>` filho com `<td colSpan={8}>` (7 colunas atuais + chevron) contendo o sub-componente `<ContratosCliente produto={produto} status={...} squad={...} />`.

**4. Sub-componente `<ContratosCliente>`**

O parent resolve `statusPreset` (chave) para a lista via `STATUS_PRESETS[statusPreset]` antes de passar como prop, para o sub-componente trabalhar com a lista já materializada — mesma estratégia já usada em `queryParams` na linha ~88 do `MixReceita.tsx`.

```ts
function ContratosCliente({ produto, statusFiltro, squad }: {
  produto: string;
  statusFiltro: string[]; // já resolvido pelo parent via STATUS_PRESETS[statusPreset]
  squad: string;
}) {
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("produto", produto);
    if (statusFiltro.length > 0) p.set("status", statusFiltro.join(","));
    if (squad !== "todos") p.set("squad", squad);
    return p.toString();
  }, [produto, statusFiltro, squad]);

  const { data, isLoading, error } = useQuery<ClientesPorProdutoResponse>({
    queryKey: [`/api/financeiro/mix-receita/clientes?${params}`],
    staleTime: 60 * 1000,
  });
  // ... renderiza sub-tabela
}
```

Visual da sub-tabela (dentro de `bg-gray-50 dark:bg-zinc-900/30` para destacar):
- Header próprio (mais discreto): Cliente | MRR | Pontual | Squad | Responsável | Status
- Linhas com hover sutil
- Status com badge colorido (verde=ativo, âmbar=onboarding/pausado, rosa=em cancelamento, cinza=outros)
- Footer: "N contratos · Total R$ X" (resumo do que foi listado)
- Estados: loading (3 skeletons), error (mensagem rose), empty ("Sem contratos para este produto")

**5. Comportamento com filtros**

Quando `statusPreset` ou `squad` mudam:
- Não colapsa expansões (UX consistente)
- React Query refaz fetch automaticamente porque a `queryKey` inclui os filtros
- Cliente vê os clientes daquele produto sob os novos filtros

**6. Coerência visual**

- Cor MRR Recorrente verde (`emerald-700/400`) — mesma da tabela-pai
- Cor Total Pontual laranja (`orange-700/400`) — mesma da tabela-pai
- Padding menor nas células filhas (`p-2`) vs `p-3` da tabela-pai, criando hierarquia visual
- Tipografia: nome do cliente `font-medium`, demais `font-normal`

## Fluxo de dados

```
Usuário clica chevron em "Performance"
  → setExpandedProdutos(prev + "Performance")
  → Re-render mostra <tr> filha com <ContratosCliente produto="Performance" ...>
  → useQuery dispara GET /api/financeiro/mix-receita/clientes?produto=Performance&status=...&squad=...
  → Backend executa SQL acima
  → Frontend renderiza sub-tabela ordenada por total desc
```

## Tratamento de erros

| Cenário | Comportamento |
|---|---|
| Backend 500 | Sub-tabela mostra `<div className="text-rose-...">Erro ao carregar contratos: {msg}</div>` |
| Produto sem contratos no filtro | Mostra `<div className="text-zinc-500">Sem contratos para este produto com os filtros atuais</div>` |
| Cliente sem nome em `cup_clientes` | Mostra `(cliente não identificado)` em cinza |
| Latência alta | Skeleton de 3 linhas com altura fixa |

## Performance

- Lazy fetch evita carga inicial extra (continua igual ao endpoint principal: ~22 produtos)
- Por expansão: query retorna no máximo ~150 contratos por produto (o maior tem ~142 contratos no print)
- `staleTime: 60s` evita refetch ao re-expandir rapidamente
- Index `idx_cup_contratos_status` já existe; JOIN em `id_task` é coluna indexada via `idx_cup_contratos_id_task`

## Testes

Manual (browser, antes de commit):
1. ✅ Expandir "Performance" → lista clientes ordenada por valor total desc
2. ✅ Expandir 2 produtos simultâneos → ambos abertos
3. ✅ Colapsar e re-expandir → React Query cacheado (não refaz request)
4. ✅ Mudar squad → expansões abertas refazem fetch
5. ✅ Mudar status preset → expansões abertas refazem fetch
6. ✅ Dark mode + Light mode → cores consistentes
7. ✅ Produto sem clientes no filtro → empty state
8. ✅ Conferir 3 valores aleatórios contra ClickUp (validação de negócio)

Backend (curl):
```bash
curl 'http://localhost:3000/api/financeiro/mix-receita/clientes?produto=Performance' | jq '.totais'
# Deve bater com a linha "Performance" da tabela principal
```

## Critério de aceite

- [ ] Tabela "Por Produto" mostra chevron na coluna inicial
- [ ] Clicar no chevron expande/colapsa a linha
- [ ] Sub-tabela mostra: Cliente, MRR Recorrente, Total Pontual, Squad, Responsável, Status
- [ ] Ordenação por total desc
- [ ] Totais da sub-tabela batem com a linha-pai
- [ ] Filtros (status/squad) propagam para a sub-tabela
- [ ] Dark/light mode OK
- [ ] Multi-expand permitido

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Contratos com `id_task` órfão (sem match em `cup_clientes`) | LEFT JOIN + fallback `'(cliente não identificado)'` |
| Total da sub-tabela não bater com a linha-pai | Usar EXATAMENTE os mesmos `COALESCE/TRIM/NULLIF` e mesmo filtro de status; validar 3 produtos manualmente |
| Performance se um produto tiver muitos contratos | Limite natural ~150 linhas; sem virtualização nesta v1. Se virar problema, adicionar `LIMIT 200` + indicador "Mostrando 200 de N" |
| Múltiplas expansões simultâneas causam N requests | Aceitável — cada produto é cacheado independentemente, e o usuário inicia cada expansão deliberadamente |
