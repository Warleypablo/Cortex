---
date: 2026-05-08
topic: CrossSell — Vendedor selecionável por oportunidade
status: aprovado pelo usuário (aguardando review do spec escrito)
---

# CrossSell — Vendedor selecionável por oportunidade mapeada

## Contexto

Hoje, na aba **CrossSell Pipeline** (`client/src/pages/CrossSellPipeline.tsx`), cada cliente pode ter várias oportunidades mapeadas (ex: "Performance", "BI", "CRM"). Na linha colapsada do cliente já é exibido um campo **Vendedor** (read-only, vindo de `cup_clientes.vendedor`).

Já na **linha da oportunidade** (dentro do expandido) só existe `cxResponsavel` — não há vendedor por oportunidade. Isso impede registrar quem é o vendedor responsável quando diferentes vendedores atuam em produtos distintos para o mesmo cliente.

## Objetivo

Permitir que cada **oportunidade mapeada** tenha um vendedor próprio, **selecionável** por meio de um combobox pesquisável, alimentado pela união dos vendedores/responsáveis já existentes em `cup_clientes`.

## Escopo

**No escopo:**
- Coluna "Vendedor" na linha da oportunidade (dentro do bloco expandido do cliente).
- Combobox pesquisável com lista unificada e ordenada de pessoas vindas de `cup_clientes`.
- Persistência por oportunidade no banco (nova coluna).
- Edição inline com PATCH otimista (mesmo padrão do `changeEtapa`/`changeValor`).

**Fora do escopo:**
- Não adicionar campo no dialog **Nova Oportunidade**.
- Não adicionar campo no dialog **Registrar Ganho** (a tabela `crosssell_negocios_ganhos` continua usando `cxResponsavel` como hoje).
- Não alterar o vendedor exibido **no nível do cliente** (continua read-only de `cup_clientes`).
- Não alterar o backend de **mapeamento automático** (oportunidades criadas pelo botão "Mapear Oportunidades" nascem com `vendedor = null`).

## Decisões

| Item | Decisão |
|------|---------|
| Onde aparece | Coluna **"Vendedor"** na linha da oportunidade (`OportunidadeRow`), entre **Produto** e **Etapa**. |
| Fonte da lista | `DISTINCT` da união de `cup_clientes.vendedor`, `cup_clientes.responsavel_geral` e `cup_clientes.responsavel`. Filtrar nulos/vazios. Ordem alfabética. |
| Componente UI | `Popover` + `Command` (shadcn) — combobox pesquisável com filtro por substring case-insensitive. |
| Item "Limpar" | Primeira opção da lista, define vendedor como `null` (exibe `—`). |
| Estado vazio | Texto "—" cinza claro quando `vendedor === null`. |
| Valor inicial em novas oportunidades | `null` (manual e mapeamento automático). |
| Persistência | Nova coluna `vendedor TEXT` (nullable) em `cortex_core.crosssell_oportunidades`. |
| Mutation | PATCH em `/api/comercial/crosssell/:id` com `{ vendedor }`. |

## Arquitetura

### 1. Banco de dados

**Migration (prod + local):**
```sql
ALTER TABLE cortex_core.crosssell_oportunidades
  ADD COLUMN vendedor TEXT;
```

A coluna é nullable e sem default — oportunidades existentes ficam com `NULL` (exibidas como `—`).

### 2. Schema (`shared/schema.ts`)

Adicionar a coluna em `crosssellOportunidades`:

```ts
export const crosssellOportunidades = cortexCoreSchema.table("crosssell_oportunidades", {
  // ... campos existentes
  vendedor: text("vendedor"),  // <— novo
  // ...
});
```

### 3. Backend (`server/routes/crosssell.ts`)

#### 3.1 `GET /api/comercial/crosssell` (listagem)

Adicionar `o.vendedor` no SELECT do CTE `oportunidades_filtradas` e no `json_build_object` que monta cada oportunidade. O `vendedor` retornado **no nível do cliente** (`MAX(of_.vendedor)` agregado) **continua vindo de `cup_clientes`** — não muda.

```sql
-- dentro do json_build_object:
'vendedor', of_.vendedor,
```

E mapear no JS:
```ts
oportunidades: (r.oportunidades ?? []).map((op: any) => ({
  // ...
  vendedor: op.vendedor ?? null,  // <— novo
})),
```

#### 3.2 `PATCH /api/comercial/crosssell/:id` (atualização)

Aceitar `vendedor` no corpo (string ou null). Adicionar à lista de campos atualizáveis no UPDATE dinâmico que já existe.

#### 3.3 `GET /api/comercial/crosssell/vendedores` (novo endpoint)

Retorna a lista unificada e ordenada para o combobox.

```sql
SELECT DISTINCT pessoa
FROM (
  SELECT vendedor          AS pessoa FROM "Clickup".cup_clientes WHERE vendedor IS NOT NULL AND vendedor <> ''
  UNION
  SELECT responsavel_geral AS pessoa FROM "Clickup".cup_clientes WHERE responsavel_geral IS NOT NULL AND responsavel_geral <> ''
  UNION
  SELECT responsavel       AS pessoa FROM "Clickup".cup_clientes WHERE responsavel IS NOT NULL AND responsavel <> ''
) t
ORDER BY pessoa ASC;
```

Resposta: `string[]`.

### 4. Frontend (`client/src/pages/CrossSellPipeline.tsx`)

#### 4.1 Tipos

```ts
interface Oportunidade {
  // ... campos existentes
  vendedor: string | null;  // <— novo
}
```

#### 4.2 Query da lista de vendedores

```ts
const { data: vendedoresList = [] } = useQuery<string[]>({
  queryKey: ["/api/comercial/crosssell/vendedores"],
  staleTime: 5 * 60 * 1000, // 5 min — dado quase estático
});
```

Carregada uma vez no componente principal e passada via props até o `OportunidadeRow`.

#### 4.3 Componente novo: `VendedorCombobox`

Recebe:
- `value: string | null`
- `options: string[]`
- `onChange: (v: string | null) => void`

UI:
- Trigger: span clicável que mostra `value ?? "—"` com hover sutil.
- Popover abre com `Command` contendo:
  - `CommandInput` para busca.
  - Item especial "Limpar" no topo (chama `onChange(null)`).
  - `CommandGroup` com os vendedores filtrados.
  - `CommandEmpty` → "Nenhum vendedor encontrado".
- Selecionar fecha popover e dispara `onChange`.
- Suporte a dark/light mode via classes Tailwind `dark:`.

#### 4.4 Mutation

```ts
const changeVendedor = useMutation({
  mutationFn: async ({ id, vendedor }: { id: number; vendedor: string | null }) => {
    const res = await fetch(`/api/comercial/crosssell/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendedor, alteradoPor: user?.name }),
    });
    if (!res.ok) throw new Error("Erro ao atualizar vendedor");
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/comercial/crosssell"] });
  },
});
```

#### 4.5 `OportunidadeRow` — novo grid

Antes:
```
"16px 220px 140px 100px 100px 32px 56px"
 dot  produto etapa  R     P     comm  trophy
```

Depois:
```
"16px 200px 130px 130px 90px  90px  32px 56px"
 dot  prod   vend   etapa R    P     comm trophy
```

(Larguras ajustadas para encaixar a nova coluna sem causar overflow no breakpoint atual.)

A coluna **Vendedor** fica entre **Produto** e **Etapa**, refletindo a leitura natural "qual produto, quem vende, em que etapa".

### 5. Comportamento

| Cenário | Comportamento |
|---------|---------------|
| Oportunidade sem vendedor | Mostra `—` em cinza claro, hover sugere clicabilidade. |
| Click na célula | Abre popover com input de busca focado. |
| Buscar | Filtra por substring case-insensitive. |
| Selecionar nome | Fecha popover, dispara PATCH, invalida query. |
| Selecionar "Limpar" | Define `null`, fecha popover, dispara PATCH. |
| PATCH falha | React Query exibe erro silenciosamente; estado anterior é mantido. |
| Etapas `sugerido_sistema` e `descartado` | Vendedor permanece editável (consistente com etapa que já é editável nessas linhas). |

### 6. Dark/Light mode

Todas as superfícies do `Popover`/`Command` e o trigger usam classes `dark:` seguindo o padrão da página: `bg-white dark:bg-zinc-900`, `border-gray-200 dark:border-zinc-700`, `text-gray-900 dark:text-white`, etc.

## Plano de testes manuais

1. Abrir a aba CrossSell Pipeline; expandir um cliente; expandir uma etapa.
2. Verificar que a coluna "Vendedor" aparece em todas as linhas de oportunidade.
3. Para uma oportunidade existente sem vendedor: deve mostrar `—`.
4. Clicar no `—` → popover abre, input de busca focado.
5. Digitar "wa" → ver lista filtrada.
6. Selecionar um nome → popover fecha, célula passa a mostrar o nome, requisição PATCH ocorre, lista é re-fetchada.
7. Reabrir popover → selecionar "Limpar" → célula volta a `—`.
8. Recarregar a página → estado persiste.
9. Testar em dark mode E light mode.
10. Verificar que oportunidades em etapas `sugerido_sistema` e `descartado` também permitem editar vendedor.

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Lista de vendedores grande (>200 nomes) deixa popover lento | `Command` (cmdk) já é virtualizado/eficiente; `staleTime` de 5 min evita refetch frequente. |
| Migration prod vs. local fora de sincronia | Aplicar `ALTER TABLE` no GCP **e** no `cortex_dev` local antes do merge (regra obrigatória do projeto). |
| Endpoint novo de vendedores conflita com rota dinâmica `/:id` | Registrar `/vendedores` **antes** de qualquer rota com `:id` no Express, ou usar regex específica. Verificar ordem em `crosssell.ts`. |
| Nome com espaços/acentuação difere entre `vendedor`/`responsavel`/`responsavel_geral` | Aceitar — o DISTINCT vai expor todas variações. Decisão consciente: não normalizar agora; se virar problema, abrir tarefa separada. |

## Referências

- Frontend: `client/src/pages/CrossSellPipeline.tsx` (`OportunidadeRow`, ~linha 848).
- Backend: `server/routes/crosssell.ts` (listagem ~linha 36, PATCH ~linha 156+).
- Schema: `shared/schema.ts` (`crosssellOportunidades` ~linha 3255).
- Banco produção: `cortex_core.crosssell_oportunidades` (GCP `34.95.249.110/dados_turbo`).
