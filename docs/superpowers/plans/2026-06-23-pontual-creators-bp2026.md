# Pontual · Creators — BP2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar aba "Pontual · Creators" no BP2026 que exibe a ponte de estoque pontual filtrada por `produto ILIKE '%creators%'`, com drill-down por célula.

**Architecture:** Parametrizar `montarPontual` com `produtoLike?` (SQL condicional), registrar endpoint `/api/bp2026/pontual-creators`, adicionar `?segmento=creators` ao endpoint de detalhe passando o filtro até as funções de snapshot, e renderizar nova aba no `BP2026.tsx` com estado e `BPCellDetail` próprios.

**Tech Stack:** TypeScript, Drizzle ORM (`sql` template tag), React Query, Tailwind CSS, Vitest.

## Global Constraints

- Todas as mudanças são aditivas — comportamento existente da aba "Pontual" geral não pode mudar.
- SQL condicional via fragmento `sql\`\`` do Drizzle — nunca concatenação de string.
- Dark/light mode obrigatório (classes `dark:` Tailwind).
- Commit por task (Conventional Commits). Co-author: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- Testes: `npx vitest run --reporter=verbose`.

---

## Mapa de arquivos

| Arquivo | Ação |
|---------|------|
| `server/routes/bp2026.pontual.ts` | Modificar: `produtoLike?` em `Deps` + cláusula SQL condicional |
| `server/routes/bp2026.ts` | Modificar: novo endpoint `GET /api/bp2026/pontual-creators` |
| `server/routes/bp2026.detalhe.ts` | Modificar: `filtroCreators?` em 4 funções + leitura de `?segmento` |
| `client/src/components/bp2026/BPCellDetail.tsx` | Modificar: prop `segmento?` |
| `client/src/pages/BP2026.tsx` | Modificar: nova query, estado, aba, segundo `BPCellDetail` |

---

## Task 1: Parametrizar `montarPontual` + novo endpoint

**Files:**
- Modify: `server/routes/bp2026.pontual.ts` (linhas 7-11 para Deps; linhas 15-33 e 50-57 para queries)
- Modify: `server/routes/bp2026.ts` (após a última linha do handler `/api/bp2026/receitas`, antes do `}` final de `registerBp2026Routes`)

**Interfaces:**
- Produces: `montarPontual({ produtoLike: '%creators%' })` retorna `Promise<LinhaPontual[]>` filtrado; sem `produtoLike` é idêntico ao comportamento atual.
- Produces: `GET /api/bp2026/pontual-creators` → `{ linhas: LinhaPontual[], mesCorrente: number, mesFechado: number }`.

- [ ] **Step 1: Atualizar a interface `Deps` e a assinatura de `montarPontual` em `bp2026.pontual.ts`**

Em `server/routes/bp2026.pontual.ts`, substituir:
```ts
interface Deps {
  db: any;
  mesCorrente: number;
  mesFechado: number;
}

export async function montarPontual({ db, mesCorrente, mesFechado }: Deps): Promise<LinhaPontual[]> {
```
Por:
```ts
interface Deps {
  db: any;
  mesCorrente: number;
  mesFechado: number;
  produtoLike?: string;
}

export async function montarPontual({ db, mesCorrente, mesFechado, produtoLike }: Deps): Promise<LinhaPontual[]> {
```

- [ ] **Step 2: Adicionar fragmentos SQL condicionais para filtro de produto**

Logo após a abertura da função `montarPontual` (antes do `const result = await db.execute...`), adicionar:
```ts
  const filtroSnap = produtoLike
    ? sql`AND LOWER(COALESCE(h.produto, '')) LIKE ${produtoLike}`
    : sql``;
  const filtroVenda = produtoLike
    ? sql`AND LOWER(COALESCE(produto, '')) LIKE ${produtoLike}`
    : sql``;
```

- [ ] **Step 3: Injetar `filtroSnap` na query de snapshots**

A query de snapshots termina com `WHERE h.valorp::numeric > 0`. Substituir essa linha por:
```sql
    WHERE h.valorp::numeric > 0 ${filtroSnap}
```
(A linha completa fica: `    WHERE h.valorp::numeric > 0 ${filtroSnap}`)

- [ ] **Step 4: Injetar `filtroVenda` na query de venda comercial**

A query `vendaRes` termina com:
```sql
      AND LOWER(TRIM(status)) <> 'não usar' AND valorp::numeric > 0
```
Substituir por:
```sql
      AND LOWER(TRIM(status)) <> 'não usar' AND valorp::numeric > 0
      ${filtroVenda}
```

- [ ] **Step 5: Verificar que os testes de helpers ainda passam**

```bash
npx vitest run --reporter=verbose server/routes/bp2026.pontual.helpers.test.ts
```
Esperado: todos os testes passam (as funções puras nos helpers não foram tocadas).

- [ ] **Step 6: Adicionar endpoint `/api/bp2026/pontual-creators` em `bp2026.ts`**

Dentro de `registerBp2026Routes`, logo antes do `}` final que fecha a função (após o `});` que fecha o handler de `/api/bp2026/receitas`), adicionar:

```ts
  app.get("/api/bp2026/pontual-creators", async (_req, res) => {
    try {
      const agora = new Date();
      const anoAtual = agora.getFullYear();
      const mesCorrente = anoAtual > ANO ? 12 : anoAtual < ANO ? 0 : agora.getMonth() + 1;
      const mesFechado = anoAtual > ANO ? 12 : mesCorrente <= 1 ? 0 : mesCorrente - 1;
      const linhas = await montarPontual({ db, mesCorrente, mesFechado, produtoLike: "%creators%" });
      res.json({ linhas, mesCorrente, mesFechado });
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/pontual-creators:", error);
      res.status(500).json({ error: "Failed to fetch pontual creators" });
    }
  });
```

- [ ] **Step 7: Reiniciar servidor e verificar endpoint via curl**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev &
sleep 4
curl -s "http://localhost:3000/api/bp2026/pontual-creators" | jq '{mesCorrente: .mesCorrente, qtdLinhas: (.linhas | length), primeiraMetrica: .linhas[0].metrica}'
```
Esperado: JSON com `mesCorrente` (número 1–12), `qtdLinhas` > 10, `primeiraMetrica: "pontual_venda_comercial"`.

- [ ] **Step 8: Commit**

```bash
git add server/routes/bp2026.pontual.ts server/routes/bp2026.ts
git commit -m "$(cat <<'EOF'
feat(bp2026): endpoint pontual-creators com filtro produtoLike

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Suporte a `?segmento=creators` no endpoint de detalhe

**Files:**
- Modify: `server/routes/bp2026.detalhe.ts`

**Interfaces:**
- Consumes: `carregaPontualSnapshot` (linha 306), `detPontualSnapshot` (linha 332), `detPontualMovimento` (linha 418), `detVendaPorEstoque` (linha 381), `detVendaPontualComercial` (linha 354).
- Produces: `GET /api/bp2026/detalhe?metrica=pontual_*&mes=N&segmento=creators` retorna grupos filtrados por Creators.

- [ ] **Step 1: Adicionar `filtroCreators?` em `carregaPontualSnapshot`**

Substituir a assinatura e a query em `carregaPontualSnapshot` (linha 306):

```ts
async function carregaPontualSnapshot(db: any, mes: number, anterior: boolean, filtroCreators?: boolean): Promise<RegPontualItem[]> {
  const ini = anterior ? sql`(make_date(${ANO}, ${mes}, 1) - INTERVAL '1 month')` : sql`make_date(${ANO}, ${mes}, 1)`;
  const fim = anterior ? sql`make_date(${ANO}, ${mes}, 1)` : sql`(make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month')`;
  const filtro = filtroCreators
    ? sql`AND LOWER(COALESCE(h.produto, '')) LIKE '%creators%'`
    : sql``;
  const result = await db.execute(sql`
    WITH alvo AS (
      SELECT MAX(data_snapshot::date) AS d FROM "Clickup".cup_data_hist
      WHERE data_snapshot::date >= ${ini}::date AND data_snapshot::date < ${fim}::date
    )
    SELECT h.id_subtask, h.valorp::numeric AS valorp, h.status,
           to_char(c.data_criado, 'YYYY-MM') AS criado_ym,
           COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           COALESCE(NULLIF(TRIM(h.squad), ''), '(sem squad)') AS squad,
           COALESCE(NULLIF(TRIM(h.produto), ''), '(sem produto)') AS produto
    FROM "Clickup".cup_data_hist h JOIN alvo a ON h.data_snapshot::date = a.d
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
    LEFT JOIN "Clickup".cup_contratos c ON c.id_subtask = h.id_subtask
    WHERE h.valorp::numeric > 0 ${filtro}
  `);
  return (result.rows as any[]).map((r) => ({
    idSubtask: String(r.id_subtask), valorp: parseFloat(r.valorp), status: r.status,
    criadoYm: r.criado_ym ?? null,
    cliente: r.cliente, squad: r.squad, produto: r.produto,
  }));
}
```

- [ ] **Step 2: Propagar `filtroCreators` em `detPontualSnapshot`**

Substituir a assinatura (linha 332):
```ts
async function detPontualSnapshot(
  db: any, mes: number, anterior: boolean, pred?: (r: RegPontualItem) => boolean, filtroCreators?: boolean
): Promise<ResultadoDet> {
  const regs = (await carregaPontualSnapshot(db, mes, anterior, filtroCreators)).filter(ehEstoquePontual);
```
(O restante da função permanece idêntico.)

- [ ] **Step 3: Propagar `filtroCreators` em `detPontualMovimento`**

Substituir a assinatura (linha 418):
```ts
async function detPontualMovimento(
  db: any, mes: number, categorias: CategoriaPonte | CategoriaPonte[], produtoFiltro?: string, filtroCreators?: boolean,
): Promise<ResultadoDet> {
  const cats = Array.isArray(categorias) ? categorias : [categorias];
  const ymAlvo = `${ANO}-${String(mes).padStart(2, "0")}`;
  let [ant, atual] = await Promise.all([
    carregaPontualSnapshot(db, mes, true, filtroCreators),
    carregaPontualSnapshot(db, mes, false, filtroCreators),
  ]);
```
(O restante da função permanece idêntico.)

- [ ] **Step 4: Adicionar `filtroCreators` em `detVendaPorEstoque`**

Substituir a função inteira (linhas 381–412):
```ts
async function detVendaPorEstoque(db: any, mes: number, dentro: boolean, filtroCreators?: boolean): Promise<ResultadoDet> {
  const filtroC = filtroCreators
    ? sql`AND LOWER(COALESCE(c.produto, '')) LIKE '%creators%'`
    : sql``;
  const result = await db.execute(sql`
    WITH alvo AS (
      SELECT MAX(data_snapshot::date) AS d FROM "Clickup".cup_data_hist
      WHERE data_snapshot::date >= make_date(${ANO}, ${mes}, 1)
        AND data_snapshot::date < (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month')
    ),
    est AS (
      SELECT h.id_subtask FROM "Clickup".cup_data_hist h JOIN alvo a ON h.data_snapshot::date = a.d
      WHERE h.valorp::numeric > 0 AND h.status NOT IN ('entregue','cancelado/inativo','não usar')
    )
    SELECT COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           COALESCE(NULLIF(TRIM(c.produto), ''), '(sem produto)') AS produto,
           COALESCE(c.servico, '') AS servico,
           COALESCE(c.status, '') AS status,
           c.valorp::numeric AS valor,
           c.data_criado::date::text AS data
    FROM "Clickup".cup_contratos c
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
    WHERE EXTRACT(MONTH FROM c.data_criado)::int = ${mes}
      AND c.data_criado >= ${`${ANO}-01-01`} AND c.data_criado < ${`${ANO + 1}-01-01`}
      AND LOWER(TRIM(c.status)) <> 'não usar' AND c.valorp::numeric > 0
      AND (c.id_subtask IN (SELECT id_subtask FROM est)) = ${dentro}
      ${filtroC}
    ORDER BY valor DESC
  `);
  const itens: ItemDetalhe[] = (result.rows as any[]).map((r) => ({
    grupo: r.produto, nome: r.cliente,
    detalhe: [r.servico, `status ${r.status}`].filter(Boolean).join(" · "),
    data: r.data ?? null, valor: parseFloat(r.valor),
  }));
  return { grupos: agruparItens(itens, LIMITE_ITENS), realizado: itens.reduce((s, i) => s + i.valor, 0) };
}
```

- [ ] **Step 5: Adicionar `filtroCreators` em `detVendaPontualComercial`**

Substituir a assinatura e o filtro JS (linha 354):
```ts
async function detVendaPontualComercial(db: any, mes: number, produtoFiltro?: string, filtroCreators?: boolean): Promise<ResultadoDet> {
  const result = await db.execute(sql`
    SELECT COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           COALESCE(NULLIF(TRIM(c.produto), ''), '(sem produto)') AS produto,
           COALESCE(c.servico, '') AS servico,
           COALESCE(c.status, '') AS status,
           c.valorp::numeric AS valor,
           c.data_criado::date::text AS data
    FROM "Clickup".cup_contratos c
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
    WHERE EXTRACT(MONTH FROM c.data_criado)::int = ${mes}
      AND c.data_criado >= ${`${ANO}-01-01`} AND c.data_criado < ${`${ANO + 1}-01-01`}
      AND LOWER(TRIM(c.status)) <> 'não usar' AND c.valorp::numeric > 0
    ORDER BY valor DESC
  `);
  const itens: ItemDetalhe[] = (result.rows as any[])
    .filter((r) => {
      if (filtroCreators && !r.produto.toLowerCase().includes("creators")) return false;
      if (produtoFiltro && r.produto !== produtoFiltro) return false;
      return true;
    })
    .map((r) => ({
      grupo: r.produto, nome: r.cliente,
      detalhe: [r.servico, `status ${r.status}`].filter(Boolean).join(" · "),
      data: r.data ?? null, valor: parseFloat(r.valor),
    }));
  return { grupos: agruparItens(itens, LIMITE_ITENS), realizado: itens.reduce((s, i) => s + i.valor, 0) };
}
```

- [ ] **Step 6: Ler `segmento` no handler e propagar `filtroCreators` a todos os branches pontual_***

No início do handler `app.get("/api/bp2026/detalhe", ...)`, após a linha `const prodAlvo = (...)();` (linha ~458), adicionar:
```ts
      const segmento = String(req.query.segmento ?? "");
      const filtroCreators = segmento === "creators";
```

Depois, em cada chamada das funções que lidam com métricas `pontual_*`, adicionar `filtroCreators` como último argumento. As linhas a alterar são:

```ts
// linha ~746 (prodAlvo.pai === "pontual_venda_comercial"):
({ grupos, realizado } = await detVendaPontualComercial(db, mes, produto, filtroCreators));

// linha ~748 (prodAlvo.pai === "pontual_entrada"):
({ grupos, realizado } = await detPontualMovimento(db, mes, CATS_ENTRADA, produto, filtroCreators));

// linha ~750 (prodAlvo.pai === "pontual_entrega"):
({ grupos, realizado } = await detPontualMovimento(db, mes, "entrega", produto, filtroCreators));

// linha ~752 (prodAlvo.pai === "pontual_estoque_fim"):
({ grupos, realizado } = await detPontualSnapshot(db, mes, false, (r) => (r.produto && r.produto.trim() ? r.produto : "(sem produto)") === produto, filtroCreators));

// linha ~756 (pontual_status_ por produto):
({ grupos, realizado } = await detPontualSnapshot(db, mes, false, (r) =>
  r.status === statusAlvo && (r.produto && r.produto.trim() ? r.produto : "(sem produto)") === produto, filtroCreators));

// linha ~761 (squadAlvo):
({ grupos, realizado } = await detPontualSnapshot(db, mes, false, (r) => normalizarSquad(r.squad) === sq, filtroCreators));

// linha ~763 (pontual_estoque_ini):
({ grupos, realizado } = await detPontualSnapshot(db, mes, true, undefined, filtroCreators));

// linha ~765 (pontual_estoque_fim):
({ grupos, realizado } = await detPontualSnapshot(db, mes, false, undefined, filtroCreators));

// linha ~768 (pontual_status_outros):
({ grupos, realizado } = await detPontualSnapshot(db, mes, false, (r) => !conhecidos.has(r.status), filtroCreators));

// linha ~772 (pontual_status_*):
({ grupos, realizado } = await detPontualSnapshot(db, mes, false, def2 ? (r) => r.status === def2.chave : () => false, filtroCreators));

// linha ~774 (pontual_venda_comercial):
({ grupos, realizado } = await detVendaPontualComercial(db, mes, undefined, filtroCreators));

// linha ~776 (pontual_venda_no_estoque):
({ grupos, realizado } = await detVendaPorEstoque(db, mes, true, filtroCreators));

// linha ~778 (pontual_venda_fora_estoque):
({ grupos, realizado } = await detVendaPorEstoque(db, mes, false, filtroCreators));

// linha ~780 (pontual_entrada):
({ grupos, realizado } = await detPontualMovimento(db, mes, CATS_ENTRADA, undefined, filtroCreators));

// linha ~784 (pontual_entrega, pontual_churn, pontual_deletados, pontual_saida_atipica, pontual_reajuste):
({ grupos, realizado } = await detPontualMovimento(db, mes, metrica.slice("pontual_".length) as CategoriaPonte, undefined, filtroCreators));
```

- [ ] **Step 7: Verificar detalhe via curl (sem segmento = comportamento atual)**

```bash
curl -s "http://localhost:3000/api/bp2026/detalhe?metrica=pontual_entrega&mes=1" | jq '{grupos: (.grupos | length), realizado: .realizado}'
```
Esperado: resposta com grupos e `realizado` > 0 (mesmo valor de antes).

- [ ] **Step 8: Verificar detalhe com segmento=creators**

```bash
curl -s "http://localhost:3000/api/bp2026/detalhe?metrica=pontual_entrega&mes=1&segmento=creators" | jq '{grupos: (.grupos | length), realizado: .realizado}'
```
Esperado: `realizado` ≤ valor sem segmento (subconjunto de Creators).

- [ ] **Step 9: Commit**

```bash
git add server/routes/bp2026.detalhe.ts
git commit -m "$(cat <<'EOF'
feat(bp2026): suporte a segmento=creators no endpoint de detalhe pontual

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Prop `segmento?` no `BPCellDetail`

**Files:**
- Modify: `client/src/components/bp2026/BPCellDetail.tsx` (linhas 86–100)

**Interfaces:**
- Consumes: nada de tasks anteriores (mudança de interface React).
- Produces: `<BPCellDetail segmento="creators" ...>` inclui `&segmento=creators` na query de detalhe.

- [ ] **Step 1: Adicionar `segmento?` à interface Props**

Substituir (linhas 86–91):
```ts
interface Props {
  metrica: string | null;
  mes: number | null;
  linhas: BPLinha[];
  onClose: () => void;
}
```
Por:
```ts
interface Props {
  metrica: string | null;
  mes: number | null;
  linhas: BPLinha[];
  onClose: () => void;
  segmento?: string;
}
```

- [ ] **Step 2: Incluir `segmento` na assinatura da função e no `queryKey`**

Substituir:
```ts
export function BPCellDetail({ metrica, mes, linhas, onClose }: Props) {
  const aberto = metrica !== null && mes !== null;
  const ehDerivada = metrica !== null && metrica in DERIVADAS;

  const { data, isLoading, error } = useQuery<DetalheResponse>({
    queryKey: ["/api/bp2026/detalhe", { metrica: metrica ?? "", mes: String(mes ?? "") }],
    enabled: aberto && !ehDerivada,
  });
```
Por:
```ts
export function BPCellDetail({ metrica, mes, linhas, onClose, segmento }: Props) {
  const aberto = metrica !== null && mes !== null;
  const ehDerivada = metrica !== null && metrica in DERIVADAS;

  const { data, isLoading, error } = useQuery<DetalheResponse>({
    queryKey: ["/api/bp2026/detalhe", { metrica: metrica ?? "", mes: String(mes ?? ""), ...(segmento ? { segmento } : {}) }],
    enabled: aberto && !ehDerivada,
  });
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Esperado: sem erros relacionados a `BPCellDetail`.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/bp2026/BPCellDetail.tsx
git commit -m "$(cat <<'EOF'
feat(bp2026): prop segmento opcional no BPCellDetail

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Nova aba "Pontual · Creators" em `BP2026.tsx`

**Files:**
- Modify: `client/src/pages/BP2026.tsx`

**Interfaces:**
- Consumes: `GET /api/bp2026/pontual-creators` → `{ linhas: BPLinha[], mesCorrente: number, mesFechado: number }` (Task 1).
- Consumes: `BPCellDetail` com prop `segmento?` (Task 3).

- [ ] **Step 1: Adicionar tipo e query para pontual-creators**

Logo após a interface `ReceitasResponse` (linha ~26) e antes de `export default function BP2026()`, adicionar:
```ts
interface CreatorsPontualResponse {
  linhas: BPLinha[];
  mesCorrente: number;
  mesFechado: number;
}
```

Dentro de `BP2026()`, após o `useQuery` existente (linha ~29), adicionar:
```ts
  const { data: creatorsData } = useQuery<CreatorsPontualResponse>({
    queryKey: ["/api/bp2026/pontual-creators"],
  });
```

- [ ] **Step 2: Adicionar estado para drill-down de creators**

Após a linha `const [recon, setRecon] = useState...` (linha ~32), adicionar:
```ts
  const [detalheCreators, setDetalheCreators] = useState<{ metrica: string; mes: number } | null>(null);
```

- [ ] **Step 3: Adicionar `TabsTrigger` para a nova aba**

No `<TabsList>`, após `<TabsTrigger value="pontual">Pontual</TabsTrigger>`, adicionar:
```tsx
          <TabsTrigger value="pontual-creators">Pontual · Creators</TabsTrigger>
```

- [ ] **Step 4: Adicionar `TabsContent` com tabela e loading state**

Após o `</TabsContent>` que fecha a aba `value="pontual"` (linha ~172), adicionar:
```tsx
        <TabsContent value="pontual-creators" className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
            Pontual Creators — venda comercial e movimento de estoque (só realizado)
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-4xl">
            <strong>Venda Pontual</strong> = quanto foi vendido no mês (data de criação), filtrado por produto
            Creators; decomposta em <em>entrou no estoque</em> e <em>fora do estoque</em>. O{" "}
            <strong>Movimento do estoque</strong> é a foto do ClickUp (snapshot) filtrada por Creators e fecha
            no estoque final — régua de snapshot, independente da Venda.
          </p>
          {!creatorsData ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <BPDreTable
              linhas={creatorsData.linhas}
              mesCorrente={creatorsData.mesCorrente}
              mesFechado={creatorsData.mesFechado}
              mostrarOrcado={false}
              onCellClick={(metrica, mes) => setDetalheCreators({ metrica, mes })}
            />
          )}
        </TabsContent>
```

- [ ] **Step 5: Adicionar segundo `BPCellDetail` para creators**

Após o `<BPCellDetail>` existente (que trata o `detalhe` geral), adicionar:
```tsx
      <BPCellDetail
        metrica={detalheCreators?.metrica ?? null}
        mes={detalheCreators?.mes ?? null}
        linhas={creatorsData?.linhas ?? []}
        onClose={() => setDetalheCreators(null)}
        segmento="creators"
      />
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Esperado: sem erros.

- [ ] **Step 7: Verificar no browser**

Com o servidor rodando:
1. Abrir `http://localhost:3000/bp-2026`
2. Clicar na aba "Pontual · Creators"
3. Confirmar que a tabela carrega com linhas "VENDA PONTUAL (COMERCIAL)" e "MOVIMENTO DO ESTOQUE (FOTO DO CLICKUP)"
4. Confirmar que os valores são menores que ou iguais aos da aba "Pontual" geral (subconjunto de Creators)
5. Clicar em uma célula não-nula (ex: "(−) Entrega" em qualquer mês com valor) e confirmar que o drawer abre mostrando só contratos de produto Creators
6. Verificar dark mode: trocar tema e confirmar que tabela e drawer renderizam corretamente

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/BP2026.tsx
git commit -m "$(cat <<'EOF'
feat(bp2026): aba Pontual · Creators com ponte de estoque filtrada

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
