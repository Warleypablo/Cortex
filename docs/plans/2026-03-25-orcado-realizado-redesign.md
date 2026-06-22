# Orçado x Realizado Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign da aba Orçado x Realizado com visual profissional (cards hero + tabelas), metas editáveis por funil, e fix do bug de metas em ranges multi-mês.

**Architecture:** Backend: migrar tabela `growth_budgets` para PK com funil, novo endpoint que agrega metas de múltiplos meses. Frontend: reescrever layout para cards hero minimalistas + tabelas densas por segmento, edição inline por funil.

**Tech Stack:** React, TanStack Query, Tailwind CSS, PostgreSQL (JSONB), Express

---

### Task 1: Migrar tabela growth_budgets para suportar funil

**Files:**
- Modify: `server/routes/growth.ts` (init table + endpoints)

**Step 1: Alterar criação da tabela para incluir coluna funil**

Na inicialização da tabela em `growth.ts`, adicionar coluna `funil` com default `'todos'` e alterar constraint unique para `(mes, segmento, funil)`:

```sql
CREATE TABLE IF NOT EXISTS meta_ads.growth_budgets (
  id SERIAL PRIMARY KEY,
  mes VARCHAR(7) NOT NULL,
  segmento VARCHAR(20) NOT NULL,
  funil VARCHAR(100) NOT NULL DEFAULT 'todos',
  metricas JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(mes, segmento, funil)
);
```

Se a tabela já existe, rodar migration:
```sql
ALTER TABLE meta_ads.growth_budgets ADD COLUMN IF NOT EXISTS funil VARCHAR(100) NOT NULL DEFAULT 'todos';
-- Drop old constraint and create new one
ALTER TABLE meta_ads.growth_budgets DROP CONSTRAINT IF EXISTS growth_budgets_mes_segmento_key;
ALTER TABLE meta_ads.growth_budgets ADD CONSTRAINT growth_budgets_mes_segmento_funil_key UNIQUE(mes, segmento, funil);
```

**Step 2: Commit**

```
feat(growth): add funil column to growth_budgets table
```

---

### Task 2: Atualizar endpoints de budgets para suportar funil + multi-mês

**Files:**
- Modify: `server/routes/growth.ts:1383-1476` (GET/PUT/copy budgets endpoints)

**Step 1: GET /budgets — aceitar funil e range multi-mês**

Alterar `GET /api/growth/orcado-realizado/budgets`:
- Novos query params: `funil` (default `'todos'`), `startDate`, `endDate`
- Se `startDate` e `endDate` fornecidos, buscar metas de TODOS os meses no range
- Para métricas absolutas (números, moeda): somar as metas de cada mês
- Para métricas percentuais: fazer média (não somar taxas)
- Se apenas `mes` fornecido, comportamento atual (backward compatible)

```typescript
app.get("/api/growth/orcado-realizado/budgets", async (req, res) => {
  try {
    const mes = req.query.mes as string;
    const funil = (req.query.funil as string) || 'todos';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Determinar meses a buscar
    let meses: string[] = [];
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        meses.push(format(cursor, 'yyyy-MM'));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else if (mes) {
      meses = [mes];
    } else {
      return res.status(400).json({ error: "mes or startDate+endDate required" });
    }

    // Buscar budgets de todos os meses para o funil
    const result = await db.execute(sql`
      SELECT mes, segmento, metricas
      FROM meta_ads.growth_budgets
      WHERE mes = ANY(${meses}) AND funil = ${funil}
    `);

    // Agregar: somar métricas absolutas, média para percentuais
    // Retornar { mql: {...}, nao_mql: {...}, ads: {...}, meses_com_meta: [...] }
    ...
  }
});
```

Lista de métricas percentuais (NÃO somar, calcular média):
- `percReuniaoAgendada`, `percNoShow`, `taxaVendas`, `txContratosRecorrentes`, `txContratosImplantacao`
- `ctr`, `percMqls`, `connectRate`, `taxaConversaoPagina`

Todas as demais são absolutas (somar): `reunioesAgendadas`, `novosClientes`, `faturamentoAceleracao`, `investimento`, etc.

**Step 2: PUT /budgets — aceitar funil**

```typescript
app.put("/api/growth/orcado-realizado/budgets", async (req, res) => {
  const { mes, segmento, funil = 'todos', metricas } = req.body;
  // ... upsert com ON CONFLICT (mes, segmento, funil)
});
```

**Step 3: POST /budgets/copy — copiar incluindo funil**

Alterar para aceitar `funil` no body e filtrar por ele na query de origem. Copiar mantendo o mesmo funil no destino.

**Step 4: Commit**

```
feat(growth): support funil and multi-month aggregation in budget endpoints
```

---

### Task 3: Atualizar frontend — busca de metas com funil + multi-mês

**Files:**
- Modify: `client/src/pages/GrowthOrcadoRealizado.tsx:248-274`

**Step 1: Alterar query de budgets para passar funil e date range**

Substituir a query que busca budgets por `selectedMonth` para usar `dateRange.startDate` e `dateRange.endDate` + funil selecionado:

```typescript
// Novo state para funil de metas (diferente do filtro de dados)
const [selectedFunilMeta, setSelectedFunilMeta] = useState<string>('todos');

const { data: budgetsData } = useQuery<Record<string, any>>({
  queryKey: ['/api/growth/orcado-realizado/budgets', dateRange.startDate, dateRange.endDate, selectedFunilMeta],
  queryFn: async () => {
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      funil: selectedFunilMeta,
    });
    const res = await fetch(`/api/growth/orcado-realizado/budgets?${params}`);
    if (!res.ok) return {};
    return res.json();
  },
});
```

**Step 2: Alterar saveEdits para passar funil**

```typescript
body: JSON.stringify({
  mes: selectedMonth,  // Salva sempre para o mês do startDate
  segmento,
  funil: selectedFunilMeta,
  metricas
})
```

**Step 3: Alterar copyBudgets para passar funil**

```typescript
body: JSON.stringify({
  mesOrigem,
  mesDestino: selectedMonth,
  funil: selectedFunilMeta
})
```

**Step 4: Commit**

```
feat(growth): connect frontend budgets to funil and multi-month aggregation
```

---

### Task 4: Redesign visual — Cards hero minimalistas

**Files:**
- Modify: `client/src/pages/GrowthOrcadoRealizado.tsx:966-1100` (area dos cards)

**Step 1: Substituir cards hero por versão minimalista**

Remover gradientes pesados, usar design limpo:

```tsx
{/* Card Hero - exemplo Investimento */}
<Card className="border bg-card">
  <CardContent className="pt-5 pb-4 px-5">
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Investimento</span>
      <Badge variant={investimentoPerc >= 100 ? 'default' : investimentoPerc >= 80 ? 'secondary' : 'destructive'}
             className="text-xs font-mono">
        {investimentoPerc.toFixed(1)}%
      </Badge>
    </div>
    <div className="text-2xl font-bold tracking-tight mb-1">
      {formatValue(investimentoRealizado, 'currency')}
    </div>
    <div className="text-xs text-muted-foreground">
      Meta: {formatValue(investimentoOrcado, 'currency')}
    </div>
    <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all",
        investimentoPerc >= 100 ? "bg-emerald-500" : investimentoPerc >= 80 ? "bg-amber-500" : "bg-red-500"
      )} style={{ width: `${Math.min(investimentoPerc, 100)}%` }} />
    </div>
  </CardContent>
</Card>
```

Aplicar padrão idêntico para os 4 cards (Investimento, Leads, Contratos, Faturamento). Sem gradientes de fundo, sem ícones grandes — limpo e direto.

**Step 2: Commit**

```
style(growth): redesign hero cards with minimal professional look
```

---

### Task 5: Redesign visual — Tabelas por segmento

**Files:**
- Modify: `client/src/pages/GrowthOrcadoRealizado.tsx` (area das métricas detalhadas, aprox. linhas 1100-1623)

**Step 1: Substituir layout atual por tabelas densas**

Cada segmento (MQL, Não-MQL, Ads, Total) em uma Card com tabela:

```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="text-base font-semibold">Vendas MQL</CardTitle>
  </CardHeader>
  <CardContent className="p-0">
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead className="w-[40%]">Métrica</TableHead>
          <TableHead className="text-right w-[20%]">Orçado</TableHead>
          <TableHead className="text-right w-[20%]">Realizado</TableHead>
          <TableHead className="text-right w-[20%]">% Atingido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.map(m => (
          <TableRow key={m.id} className="hover:bg-muted/30">
            <TableCell className="font-medium text-sm">{m.name}</TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">
              {renderOrcadoCell(m)}
            </TableCell>
            <TableCell className="text-right text-sm font-medium">
              {formatValue(m.realizado, m.format)}
            </TableCell>
            <TableCell className={cn("text-right text-sm font-semibold", getVarianceColor(m.percentual))}>
              {m.percentual !== null ? `${m.percentual.toFixed(1)}%` : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

**Step 2: Adicionar seletor de funil para metas no header**

No header, ao lado de "Editar Metas", adicionar dropdown de funil para edição:

```tsx
<Select value={selectedFunilMeta} onValueChange={setSelectedFunilMeta}>
  <SelectTrigger className="w-48 h-8 text-xs">
    <SelectValue placeholder="Funil da Meta" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="todos">Todos os funis</SelectItem>
    {funis?.filter(f => f !== '(Vazio)').map(f => (
      <SelectItem key={f} value={f}>{f}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Step 3: Remover seções/tabs antigas que foram substituídas pelas tabelas**

Limpar código dos cards de métricas antigos, mantendo apenas os 4 hero cards + as 4 tabelas (MQL, Não-MQL, Ads, Total).

**Step 4: Commit**

```
style(growth): replace metric cards with dense professional tables per segment
```

---

### Task 6: Testar e validar

**Step 1: Testar cenários**
- Mês único: verificar que metas carregam corretamente (backward compatible)
- Range multi-mês (ex: Jan-Mar): verificar que metas são somadas para absolutas e medianas para percentuais
- Edição de meta por funil: salvar, trocar funil, verificar isolamento
- Copiar metas: verificar que copia para o funil correto
- Dark mode + Light mode
- Loading states

**Step 2: Commit final se necessário**

```
fix(growth): adjustments after testing
```
