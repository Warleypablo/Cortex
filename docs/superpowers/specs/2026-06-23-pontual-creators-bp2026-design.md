# Design: Aba "Pontual · Creators" no BP2026

**Data:** 2026-06-23  
**Escopo:** Nova aba no `/bp-2026` mostrando a ponte de estoque pontual filtrada exclusivamente por produto Creators, com drill-down por célula.

---

## Contexto

A aba "Pontual" do BP2026 exibe a tabela de ponte de estoque para **todos** os produtos (VENDA PONTUAL + MOVIMENTO DO ESTOQUE). Foi solicitada uma aba equivalente filtrada apenas por `produto ILIKE '%creators%'`, com o mesmo nível de detalhe incluindo drill-down ao clicar nas células.

---

## Arquitetura

### Fluxo de dados

```
GET /api/bp2026/pontual-creators
  └─ montarPontual({ produtoLike: '%creators%' })
       ├─ SQL snapshots: cup_data_hist WHERE LOWER(produto) LIKE '%creators%'
       └─ SQL venda: cup_contratos WHERE LOWER(produto) LIKE '%creators%'
       └─ retorna LinhaPontual[] (mesmo formato da aba Pontual geral)

GET /api/bp2026/detalhe?metrica=pontual_*&mes=N&segmento=creators
  └─ carregaPontualSnapshot(db, mes, anterior, filtroCreators=true)
       └─ SQL: cup_data_hist WHERE ... AND LOWER(COALESCE(h.produto,'')) LIKE '%creators%'
  └─ detVendaPorEstoque(db, mes, dentro, filtroCreators=true)
       └─ SQL: cup_contratos WHERE ... AND LOWER(COALESCE(c.produto,'')) LIKE '%creators%'
```

---

## Backend

### 1. `server/routes/bp2026.pontual.ts`

Adicionar campo `produtoLike?: string` na interface `Deps`:

```ts
interface Deps {
  db: any;
  mesCorrente: number;
  mesFechado: number;
  produtoLike?: string;   // ex: '%creators%'
}
```

Ambas as queries SQL recebem a cláusula condicional:
- Query de snapshots: `AND LOWER(COALESCE(h.produto, '')) LIKE ${produtoLike}` (só quando definido)
- Query de venda comercial: `AND LOWER(COALESCE(produto, '')) LIKE ${produtoLike}` (idem)

Comportamento sem o parâmetro: idêntico ao atual — zero risco de regressão.

### 2. `server/routes/bp2026.ts` (dentro de `registerBp2026Routes`)

Novo endpoint independente:

```
GET /api/bp2026/pontual-creators
```

- Calcula `mesCorrente` / `mesFechado` com a mesma fórmula inline já usada no handler principal.
- Chama `montarPontual({ db, mesCorrente, mesFechado, produtoLike: '%creators%' })`.
- Retorna `{ linhas: LinhaPontual[], mesCorrente: number, mesFechado: number }`.

### 3. `server/routes/bp2026.detalhe.ts`

**`carregaPontualSnapshot`** — adiciona parâmetro `filtroCreators?: boolean`:
- Quando `true`: adiciona `AND LOWER(COALESCE(h.produto, '')) LIKE '%creators%'` ao SQL (filtro no banco).
- Sem o parâmetro: comportamento idêntico ao atual.

**`detVendaPorEstoque`** — adiciona parâmetro `filtroCreators?: boolean`:
- Quando `true`: adiciona `AND LOWER(COALESCE(c.produto, '')) LIKE '%creators%'` ao SQL de `cup_contratos`.

**`/api/bp2026/detalhe`** — lê `?segmento=creators` e passa `filtroCreators: segmento === 'creators'` para as funções acima. Afeta apenas o bloco `pontual_*` do handler; todos os outros `if/else` ficam intocados.

---

## Frontend

### 4. `client/src/components/bp2026/BPCellDetail.tsx`

Adiciona prop opcional:
```ts
interface Props {
  metrica: string | null;
  mes: number | null;
  linhas: BPLinha[];
  onClose: () => void;
  segmento?: string;   // quando 'creators', inclui &segmento=creators na query
}
```

O `queryKey` passa a ser:
```ts
["/api/bp2026/detalhe", { metrica, mes, ...(segmento ? { segmento } : {}) }]
```

O `getQueryFn` existente converte o objeto em query string automaticamente. Nenhuma outra mudança no componente.

### 5. `client/src/pages/BP2026.tsx`

**Query separada:**
```ts
const { data: creatorsData } = useQuery<CreatorsPontualResponse>({
  queryKey: ["/api/bp2026/pontual-creators"],
});
```

Onde `CreatorsPontualResponse = { linhas: BPLinha[]; mesCorrente: number; mesFechado: number }`.

**Estado de detalhe separado** (evita colisão de métricas de mesmo nome com a aba Pontual geral):
```ts
const [detalheCreators, setDetalheCreators] = useState<{ metrica: string; mes: number } | null>(null);
```

**Nova aba:**
```tsx
<TabsTrigger value="pontual-creators">Pontual · Creators</TabsTrigger>

<TabsContent value="pontual-creators" className="mt-4 space-y-2">
  <h3>Pontual Creators — venda comercial e movimento de estoque (só realizado)</h3>
  <p>/* mesma descrição explicativa da aba Pontual, com "filtrado por produto Creators" */</p>
  <BPDreTable
    linhas={creatorsData?.linhas ?? []}
    mesCorrente={creatorsData?.mesCorrente ?? data.mesCorrente}
    mesFechado={creatorsData?.mesFechado ?? data.mesFechado}
    mostrarOrcado={false}
    onCellClick={(metrica, mes) => setDetalheCreators({ metrica, mes })}
  />
</TabsContent>
```

**Segundo `BPCellDetail`** (logo abaixo do existente):
```tsx
<BPCellDetail
  metrica={detalheCreators?.metrica ?? null}
  mes={detalheCreators?.mes ?? null}
  linhas={creatorsData?.linhas ?? []}
  onClose={() => setDetalheCreators(null)}
  segmento="creators"
/>
```

Usar `linhas={creatorsData?.linhas ?? []}` garante que o lookup de título/valor use os dados corretos de Creators, sem ambiguidade com a aba geral.

---

## Arquivos tocados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `server/routes/bp2026.pontual.ts` | Aditiva: `produtoLike?` em `Deps` + cláusula SQL condicional |
| `server/routes/bp2026.ts` | Aditiva: novo endpoint `GET /api/bp2026/pontual-creators` |
| `server/routes/bp2026.detalhe.ts` | Aditiva: `filtroCreators?` em 2 funções + leitura de `?segmento` |
| `client/src/components/bp2026/BPCellDetail.tsx` | Aditiva: prop `segmento?` |
| `client/src/pages/BP2026.tsx` | Aditiva: nova query, novo estado, nova aba, segundo BPCellDetail |

---

## Critérios de sucesso

1. A aba "Pontual · Creators" aparece ao lado de "Pontual" no BP2026.
2. Os valores da tabela correspondem ao filtro `produto ILIKE '%creators%'` (verificável cruzando com a tela `/creators-pontual`).
3. Clicar numa célula (ex: "(−) Churn · Março") abre o drawer listando só contratos Creators.
4. A aba "Pontual" geral não é afetada — os números permanecem idênticos.
5. Funciona em dark mode e light mode.
