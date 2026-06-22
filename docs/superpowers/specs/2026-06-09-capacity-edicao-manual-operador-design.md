# Edição manual de Capacity por operador — Design

**Data:** 2026-06-09
**Página afetada:** Capacity Times (`client/src/pages/CapacityTimes.tsx`)
**Status:** Aprovado, aguardando review do spec

## Objetivo

Permitir setar manualmente a **capacity por operador** pela interface, em vez de
depender do seed hardcoded. Adiciona uma aba **"Configurar"** na página Capacity
Times com CRUD completo de operadores e suas metas de capacidade.

A estrutura de dados já existe: a tabela `cortex_core.capacity_metas` guarda a
capacity por pessoa. Hoje ela é populada **apenas via seed**
(`server/seed/capacityMetas.ts`), que roda a cada boot do servidor e é destrutivo.
O que falta é (a) uma UI para editar e (b) neutralizar o comportamento destrutivo
do seed para que as edições manuais persistam.

## Decisões de produto (definidas no brainstorming)

| Tema | Decisão |
|------|---------|
| Campos editáveis | CRUD completo: `cap_mrr`, `cap_recorrente`, `cap_pontual`, `cap_contas`, `ativo`, `ordem`, além de `nome`, `categoria`, `match_responsavel` |
| Onde editar | Aba "Configurar" dentro da página Capacity Times, com tabela editável |
| Acesso | Qualquer usuário logado (a tela já exige `isAuthenticated`). Sem log de auditoria, sem roles. |
| Vínculo aos contratos | Dropdown dos responsáveis **reais** de `cup_contratos`, mostrando nº de contratos / MRR ao escolher |
| Seed | Vira **bootstrap idempotente**: só popula se a tabela estiver vazia; nunca sobrescreve/deleta depois |
| Remover | Soft (toggle `ativo`) **e** hard (botão "remover" com confirmação) |

## Contexto técnico atual

### Tabela `cortex_core.capacity_metas` (`server/db.ts:2270`)
```
id                SERIAL PRIMARY KEY
nome              TEXT NOT NULL          -- nome de exibição do operador
match_responsavel TEXT NOT NULL          -- string casada via ILIKE com cup_contratos.responsavel
categoria         TEXT NOT NULL          -- Pulse | Aura | Olimpo (operacional) | vendedor | account | gestor (comercial)
cap_recorrente    INTEGER                -- limite de contas recorrentes (squads)
cap_mrr           NUMERIC                -- alvo de MRR por pessoa
cap_pontual       INTEGER                -- limite de contratos pontuais (squads)
cap_contas        INTEGER                -- limite de contas ativas (comercial)
ordem             INTEGER DEFAULT 0      -- ordem de exibição
ativo             BOOLEAN DEFAULT TRUE
atualizado_em     TIMESTAMP DEFAULT NOW()
UNIQUE(match_responsavel, categoria)
```

### Mapeamento categoria → label de time (frontend, `CapacityTimes.tsx`)
- Operacional: `categoria` **é** o nome da squad (`Pulse`, `Aura`, `Olimpo`) → vão em `data.squads`
- Comercial: `vendedor` → "Selca", `account` → "Accounts", `gestor` → "Squadra"

### Cálculos derivados (`server/routes/capacityTimes.helpers.ts`) — NÃO mudam
- `util_pct = mrr_operando / cap_mrr` (quando `cap_mrr` setado), senão `op_total / cap_recorrente`
- `dif_mrr = cap_mrr - mrr_operando` ("Espaço de crescimento")
- Editar a capacity simplesmente realimenta esses cálculos via `/api/capacity-times`.

### Problema do seed (`server/seed/capacityMetas.ts`)
`seedCapacityMetas()` roda em `server/index.ts:167` a cada boot e:
1. Faz `INSERT ... ON CONFLICT DO UPDATE` sobrescrevendo todos os `cap_*` (linhas 71-86)
2. **Deleta** qualquer linha cujo `(match_responsavel, categoria)` não esteja no array de seed (linhas 88-94)

Sem mudança, **qualquer edição manual seria perdida no próximo restart**.

## Arquitetura da solução

### 1. Backend — novos endpoints em `server/routes/capacity.ts`

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/capacity-metas` | Lista **todas** as metas (inclusive `ativo=false`), campos brutos, ordenadas por `ordem, nome`. Distinto de `/api/capacity-times` (que agrega só ativos). |
| `POST` | `/api/capacity-metas` | Cria operador. Body validado por Zod. Retorna a linha criada. |
| `PUT` | `/api/capacity-metas/:id` | Atualiza operador (campos `cap_*`, `nome`, `categoria`, `match_responsavel`, `ativo`, `ordem`). |
| `DELETE` | `/api/capacity-metas/:id` | Hard delete. |
| `GET` | `/api/capacity-metas/responsaveis` | Responsáveis reais de `cup_contratos` para o dropdown + prévia. |

**`GET /api/capacity-metas/responsaveis` — query:**
```sql
SELECT TRIM(r.parte) AS responsavel,
       COUNT(DISTINCT c.id_subtask) AS contratos,
       COALESCE(SUM(c.valorr), 0)   AS mrr
FROM "Clickup".cup_contratos c
CROSS JOIN LATERAL regexp_split_to_table(c.responsavel, ';') AS r(parte)
WHERE c.status IN ('ativo','onboarding','em cancelamento')
  AND c.responsavel IS NOT NULL AND c.responsavel <> ''
  AND TRIM(r.parte) <> ''
GROUP BY TRIM(r.parte)
ORDER BY mrr DESC
```
Retorna `[{ responsavel, contratos, mrr }]`. O frontend usa esta lista no Select de
vínculo; ao escolher um responsável, `match_responsavel` recebe o nome exato e a
prévia mostra "X contratos · R$ Y".

**Validação Zod (POST/PUT):**
```ts
const capacityMetaSchema = z.object({
  nome: z.string().min(1),
  match_responsavel: z.string().min(1),
  categoria: z.string().min(1),
  cap_recorrente: z.number().int().nonnegative().nullable(),
  cap_mrr: z.number().nonnegative().nullable(),
  cap_pontual: z.number().int().nonnegative().nullable(),
  cap_contas: z.number().int().nonnegative().nullable(),
  ordem: z.number().int().nonnegative(),
  ativo: z.boolean(),
});
```
Campos `cap_*` usam `.nullable()` (vêm de inputs que podem ficar vazios → `null`;
`.optional()` rejeitaria `null` explícito). Violação do `UNIQUE(match_responsavel,
categoria)` (Postgres erro `23505`) → resposta `409` com mensagem "Operador já
cadastrado nesse time".

### 2. Mudança no seed (`server/seed/capacityMetas.ts`)

`seedCapacityMetas()` vira bootstrap idempotente:
```ts
export async function seedCapacityMetas(): Promise<void> {
  const { rows } = await db.execute(sql`SELECT COUNT(*)::int AS n FROM cortex_core.capacity_metas`);
  if ((rows[0]?.n ?? 0) > 0) return; // tabela já populada → UI é a fonte de verdade
  // insere CAPACITY_METAS_SEED uma única vez (INSERT simples, sem ON CONFLICT destrutivo)
}
```
- Remove o `DELETE ... NOT IN` (linhas 88-94) e o upsert destrutivo.
- Atualiza o comentário "não há edição manual de metas".
- Sem mudança de schema → nada a aplicar manualmente em prod (tabela já existe e
  já está populada em ambos os ambientes, então o bootstrap não roda em nenhum).

### 3. Frontend

**`CapacityTimes.tsx`:** adicionar `<TabsTrigger value="__config__">⚙️ Configurar</TabsTrigger>`
ao fim da `TabsList` e a `<TabsContent value="__config__">` renderizando o novo componente.

**Novo `client/src/components/capacity-times/CapacityMetasConfig.tsx`:**
- `useQuery(['/api/capacity-metas'])` → tabela ordenada por `ordem`.
- Colunas: ordem · nome · categoria · vínculo (+ nº contratos casados) · `cap_mrr` ·
  `cap_recorrente` · `cap_pontual` · `cap_contas` · toggle `ativo` · ações (editar / remover).
- Botão **"+ Adicionar operador"** abre `Dialog` (shadcn) com o form.
- Form (add/edit):
  - `nome` (input)
  - `categoria` (Select com as existentes — Pulse, Aura, Olimpo, vendedor, account,
    gestor — **e** opção de digitar nova squad operacional)
  - **vínculo** (Select dos responsáveis reais de `/api/capacity-metas/responsaveis`,
    exibindo "X contratos · R$ Y MRR" ao selecionar)
  - `cap_mrr`, `cap_recorrente`, `cap_pontual`, `cap_contas` (inputs numéricos, vazio = null)
  - `ordem` (input numérico — reordenação simples, sem drag-and-drop)
  - `ativo` (toggle/switch)
- `useMutation` (POST/PUT/DELETE/toggle) via `apiRequest`. **Ao salvar, invalida tanto
  `['/api/capacity-metas']` quanto `['/api/capacity-times']`** para refletir os novos
  números nos cards e nas outras abas.
- `Dialog` de confirmação no "remover".
- Dark/light mode com variantes `dark:` em todos os elementos.

### 4. Testes (mínimos)
- Schema Zod: aceita `cap_*` null; rejeita `nome`/`match_responsavel`/`categoria` vazios.
- Seed bootstrap: `seedCapacityMetas()` não insere quando a tabela já tem linhas.

## Fora de escopo (YAGNI)
- Drag-and-drop de reordenação (usa campo numérico `ordem`).
- Log de auditoria / histórico de alterações.
- Controle de permissão/roles (qualquer logado edita).
- Edição inline direto nas tabelas das abas de squad/comercial.

## Arquivos afetados
- `server/routes/capacity.ts` — novos endpoints CRUD + responsáveis
- `server/seed/capacityMetas.ts` — bootstrap idempotente
- `server/index.ts` — (sem mudança; seed continua chamado, agora idempotente)
- `client/src/pages/CapacityTimes.tsx` — nova aba
- `client/src/components/capacity-times/CapacityMetasConfig.tsx` — novo componente
- Testes: `server/routes/capacity.metas.test.ts` (schema) + ajuste em teste do seed se houver
