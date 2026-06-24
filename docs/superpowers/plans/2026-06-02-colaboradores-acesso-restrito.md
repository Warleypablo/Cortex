# Colaboradores Acesso Restrito (sem salário) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a permissão `gg.colaboradores_restrito` que concede acesso à aba de Colaboradores mas oculta todos os dados de salário no backend e no frontend.

**Architecture:** Nova chave de permissão registrada em `nav-config.ts`, exposta automaticamente no AdminUsuarios. O backend strip o campo `salario` de todos os endpoints quando o usuário tem acesso restrito. O frontend oculta coluna, formulário e totais de salário via hook `useIsColaboradoresRestrito`.

**Tech Stack:** TypeScript, React, Express, Drizzle ORM, Tailwind CSS

---

### Task 1: Registrar nova permissão em nav-config.ts

**Files:**
- Modify: `shared/nav-config.ts`

- [ ] **Step 1: Adicionar chave ao PERMISSION_KEYS.GG**

Em `shared/nav-config.ts`, localizar o bloco `GG` (linhas 92-101) e adicionar `COLABORADORES_RESTRITO` após `COLABORADORES`:

```typescript
  // G&G (Pessoas)
  GG: {
    VISAO_GERAL: 'gg.visao_geral',
    COLABORADORES: 'gg.colaboradores',
    COLABORADORES_RESTRITO: 'gg.colaboradores_restrito',
    RECRUTAMENTO: 'gg.recrutamento',
    ONBOARDING: 'gg.onboarding',
    PESQUISAS: 'gg.pesquisas',
    PATRIMONIO: 'gg.patrimonio',
    CALENDARIO_FERIAS: 'gg.calendario_ferias',
    ORGANOGRAMA: 'gg.organograma',
  },
```

- [ ] **Step 2: Adicionar rotas ao PERMISSION_TO_ROUTES para a nova chave**

Em `shared/nav-config.ts`, após a linha 313 (fim do bloco que constrói `PERMISSION_TO_ROUTES`), adicionar:

```typescript
// Rota de acesso restrito a colaboradores (sem salário)
PERMISSION_TO_ROUTES['gg.colaboradores_restrito'] = ['/colaboradores', '/colaboradores/analise'];
```

- [ ] **Step 3: Commit**

```bash
git add shared/nav-config.ts
git commit -m "feat(permissions): adiciona permissão gg.colaboradores_restrito"
```

---

### Task 2: Atualizar hasAccess no AuthContext para suportar múltiplas permissões por rota

**Files:**
- Modify: `client/src/contexts/AuthContext.tsx`

Contexto: atualmente `hasAccess` faz lookup `ROUTE_TO_PERMISSION[path]` — isso retorna apenas uma chave por rota. Como `/colaboradores` mapeia para `gg.colaboradores`, um usuário com `gg.colaboradores_restrito` seria bloqueado. A correção itera todas as permissões do usuário e verifica se alguma mapeia para o path via `PERMISSION_TO_ROUTES`.

- [ ] **Step 1: Atualizar import e função hasAccess**

Substituir linha 3 e função `hasAccess` (linhas 3, 38-46):

```typescript
import { PERMISSION_TO_ROUTES } from "@shared/nav-config";
```

```typescript
  const hasAccess = (path: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (PUBLIC_ROUTES.includes(path)) return true;
    if (user.allowedRoutes?.includes(path)) return true;
    for (const perm of (user.allowedRoutes ?? [])) {
      if (PERMISSION_TO_ROUTES[perm]?.includes(path)) return true;
    }
    return false;
  };
```

- [ ] **Step 2: Verificar que o import de ROUTE_TO_PERMISSION foi removido (não é mais usado)**

A linha `import { ROUTE_TO_PERMISSION } from "@shared/nav-config";` deve ser substituída pela nova.

- [ ] **Step 3: Commit**

```bash
git add client/src/contexts/AuthContext.tsx
git commit -m "fix(auth): hasAccess suporta múltiplas permissões por rota via PERMISSION_TO_ROUTES"
```

---

### Task 3: Criar hook useIsColaboradoresRestrito

**Files:**
- Create: `client/src/hooks/useIsColaboradoresRestrito.ts`

- [ ] **Step 1: Criar o arquivo do hook**

```typescript
import { useAuth } from "@/contexts/AuthContext";

export function useIsColaboradoresRestrito(): boolean {
  const { user } = useAuth();
  if (!user || user.role === 'admin') return false;
  const routes = user.allowedRoutes ?? [];
  return routes.includes('gg.colaboradores_restrito') && !routes.includes('gg.colaboradores');
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useIsColaboradoresRestrito.ts
git commit -m "feat(hooks): adiciona useIsColaboradoresRestrito"
```

---

### Task 4: Backend — filtrar salário em todos os endpoints de colaboradores

**Files:**
- Modify: `server/routes/colaboradores.ts`

- [ ] **Step 1: Adicionar helper isColaboradoresRestrito após isAuthenticated (linha ~18)**

```typescript
function isColaboradoresRestrito(req: any): boolean {
  const routes: string[] = req.user?.allowedRoutes ?? [];
  return routes.includes('gg.colaboradores_restrito') &&
    !routes.includes('gg.colaboradores') &&
    req.user?.role !== 'admin';
}
```

- [ ] **Step 2: GET /api/colaboradores — strip salário da lista**

Substituir o corpo do handler `GET /api/colaboradores` (linhas 21-30):

```typescript
  app.get("/api/colaboradores", async (req, res) => {
    try {
      const colaboradores = await storage.getColaboradores();
      console.log(`[DEBUG] Colaboradores encontrados no banco: ${colaboradores.length} total, ${colaboradores.filter(c => c.status === 'Ativo').length} ativos`);
      const restricted = isColaboradoresRestrito(req);
      const result = restricted
        ? colaboradores.map(({ salario, ...rest }: any) => rest)
        : colaboradores;
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching colaboradores:", error);
      res.status(500).json({ error: "Failed to fetch colaboradores" });
    }
  });
```

- [ ] **Step 3: Export endpoint — remover coluna salário quando restrito**

No handler `exportarColaboradores`, após a definição de `exportColumns` (após linha 68, antes de `const result = await db.execute`), adicionar:

```typescript
      const effectiveColumns = isColaboradoresRestrito(req)
        ? exportColumns.filter((col) => col.key !== 'salario')
        : exportColumns;
```

E substituir as duas ocorrências de `exportColumns` no bloco de seleção (linhas 119-121) por `effectiveColumns`:

```typescript
      const selectedColumns = requestedKeys.length > 0
        ? effectiveColumns.filter((col) => requestedSet.has(col.key))
        : effectiveColumns;
```

- [ ] **Step 4: GET /api/colaboradores/:id — strip salário do detalhe**

Após a linha 729 (`linkedUser: linkedUser,`) e antes de `res.json(colaborador)` (linha 731), adicionar:

```typescript
      if (isColaboradoresRestrito(req)) {
        delete (colaborador as any).salario;
      }
```

- [ ] **Step 5: GET /api/colaboradores/analise-geral — strip stats de salário**

Substituir o `res.json(...)` final do endpoint (linhas 579-591) por:

```typescript
      const restricted = isColaboradoresRestrito(req);
      res.json({
        healthDistribution,
        headcountBySquad,
        nivelDistribution,
        salarioByTempo: restricted ? null : salarioByTempo,
        salarioBySquad: restricted ? null : salarioBySquad,
        tempoBySquad,
        estatisticas: {
          totalColaboradores,
          salarioMedio: restricted ? null : salarioMedio,
          tempoMedioMeses: Math.round(tempoMedio * 10) / 10,
        },
      });
```

- [ ] **Step 6: Commit**

```bash
git add server/routes/colaboradores.ts
git commit -m "feat(api): filtra dados de salário para usuários com acesso restrito"
```

---

### Task 5: Frontend — ocultar salário em Colaboradores.tsx

**Files:**
- Modify: `client/src/pages/Colaboradores.tsx`

- [ ] **Step 1: Importar o hook**

Adicionar import no topo do arquivo (junto dos outros imports de hooks):

```typescript
import { useIsColaboradoresRestrito } from "@/hooks/useIsColaboradoresRestrito";
```

- [ ] **Step 2: Usar o hook dentro do componente**

No início do componente `Colaboradores` (após os outros `useState`/`useQuery`), adicionar:

```typescript
  const isRestrito = useIsColaboradoresRestrito();
```

- [ ] **Step 3: Ocultar card de Folha nos métricas (linha ~2755)**

Envolver o Card de Folha (linhas 2755-2775) com condicional:

```tsx
{!isRestrito && (
  <Card className="hover-elevate">
    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
      <div className="flex items-center gap-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">Folha</CardTitle>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Soma dos salários de todos os colaboradores ativos</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Banknote className="w-4 h-4 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold" data-testid="metric-folha">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(metrics.folhaAtivos)}
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 4: Ocultar header da coluna Salário na tabela (linha ~2838)**

Envolver o `<TableHead>` de Salário (linhas 2838-2847) com condicional:

```tsx
{!isRestrito && (
  <TableHead 
    className="min-w-[120px] bg-muted/50 cursor-pointer select-none" 
    onClick={() => handleSort('salario')}
    data-testid="table-header-salario"
  >
    <div className="flex items-center">
      Salário
      {getSortIcon('salario')}
    </div>
  </TableHead>
)}
```

- [ ] **Step 5: Ocultar célula de Salário na linha da tabela (linha ~1967)**

Envolver o `<TableCell>` com salário (linhas 1967-1971) com condicional:

```tsx
{!isRestrito && (
  <TableCell className="py-3">
    <div className="text-sm font-medium" data-testid={`text-salario-${colaborador.id}`}>
      {colaborador.salario ? formatCurrency(parseFloat(String(colaborador.salario))) : "-"}
    </div>
  </TableCell>
)}
```

- [ ] **Step 6: Ocultar campo salário no formulário de criação (linha ~1088)**

Envolver o `<FormField name="salario">` (linhas 1088-1106) com condicional:

```tsx
{!isRestrito && (
  <FormField
    control={form.control}
    name="salario"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Salário</FormLabel>
        <FormControl>
          <Input 
            {...field} 
            value={field.value || ""} 
            data-testid="input-salario" 
            type="number" 
            step="0.01"
            placeholder="0.00" 
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)}
```

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Colaboradores.tsx
git commit -m "feat(ui): oculta dados de salário para usuário com acesso restrito em Colaboradores"
```

---

### Task 6: Frontend — ocultar salário em DetailColaborador.tsx

**Files:**
- Modify: `client/src/pages/DetailColaborador.tsx`

- [ ] **Step 1: Importar o hook**

```typescript
import { useIsColaboradoresRestrito } from "@/hooks/useIsColaboradoresRestrito";
```

- [ ] **Step 2: Usar o hook dentro do componente**

No início do componente `DetailColaborador`, adicionar:

```typescript
  const isRestrito = useIsColaboradoresRestrito();
```

- [ ] **Step 3: Ocultar "Salário Atual" no resumo financeiro (linha ~4078)**

Substituir o div do salário atual (linhas 4077-4082) por:

```tsx
{!isRestrito && (
  <div className="p-3 rounded-lg bg-muted/50">
    <p className="text-xs text-muted-foreground mb-1">Salário Atual</p>
    <p className="text-base font-bold text-green-600 dark:text-green-400">
      {colaborador.salario ? `R$ ${parseFloat(colaborador.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-"}
    </p>
  </div>
)}
```

- [ ] **Step 4: Ocultar InfoCard de Salário (linha ~5940)**

Envolver o `<InfoCard label="Salário" .../>` (linhas 5940-5946) com condicional:

```tsx
{!isRestrito && (
  <InfoCard 
    icon={DollarSign} 
    label="Salário" 
    value={colaborador.salario ? `R$ ${Math.floor(parseFloat(colaborador.salario)).toLocaleString('pt-BR')}` : null}
    iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
    iconColor="text-emerald-600 dark:text-emerald-400"
  />
)}
```

- [ ] **Step 5: Ocultar seção Salário nas informações profissionais (linha ~6101)**

Envolver o div do Salário na grid de informações profissionais (linhas 6101-6108 — o primeiro `<div>` dentro do `grid grid-cols-3`) com condicional:

```tsx
{!isRestrito && (
  <div>
    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Salário</p>
    <p className="font-semibold flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="text-prof-salario">
      <DollarSign className="w-4 h-4" />
      {colaborador.salario ? `R$ ${parseFloat(colaborador.salario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "-"}
    </p>
  </div>
)}
```

- [ ] **Step 6: Ocultar campos de salário no formulário de promoção (linhas ~455-494)**

Envolver o `<div className="grid grid-cols-1 md:grid-cols-2 gap-4">` que contém `salarioAnterior` e `salarioNovo` (linhas 455-494) com condicional:

```tsx
{!isRestrito && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      control={form.control}
      name="salarioAnterior"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Salário Anterior</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              {...field} 
              data-testid="input-promocao-salario-anterior" 
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="salarioNovo"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Salário Novo</FormLabel>
          <FormControl>
            <Input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              {...field} 
              data-testid="input-promocao-salario-novo" 
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/DetailColaborador.tsx
git commit -m "feat(ui): oculta dados de salário para usuário com acesso restrito em DetailColaborador"
```

---

### Task 7: Push e verificação final

- [ ] **Step 1: Push para o remote**

```bash
git push
```

- [ ] **Step 2: Verificar no AdminUsuarios**

Acessar `/admin/usuarios`, editar qualquer usuário, abrir a aba G&G. Confirmar que a permissão "Colaboradores Restrito" aparece como opção.

- [ ] **Step 3: Testar concessão da permissão**

Conceder `gg.colaboradores_restrito` (sem `gg.colaboradores`) a um usuário de teste e confirmar que:
- O usuário acessa `/colaboradores` normalmente
- A coluna Salário não aparece na tabela
- O card de Folha não aparece nos métricas
- O campo Salário não aparece no formulário de criação
- A API não retorna o campo `salario` (verificar no DevTools → Network)
