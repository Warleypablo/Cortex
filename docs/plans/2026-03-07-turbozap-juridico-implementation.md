# TurboZap Jurídico Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend TurboZap with 5 juridico message levels (D+30–D+55), dual WhatsApp instance routing, pipeline control for conditional stages, and a Pipeline Jurídico UI tab.

**Architecture:** Extend the existing `turbozap.ts` service inline — add juridico levels to `NIVEIS_COBRANCA`, route messages to the correct WhatsApp instance based on level type, create a `turbozap_pipeline_juridico` table for protesto/negativação stage tracking, and add conditional send logic that checks pipeline flags before firing D+45/D+55.

**Tech Stack:** TypeScript, Express, Drizzle ORM (raw SQL), PostgreSQL, React, Tailwind CSS, React Query, Lucide icons, shadcn/ui components.

---

### Task 1: Extend Backend — Níveis, Templates, Instance Routing

**Files:**
- Modify: `server/services/turbozap.ts`

**Context:** This file contains `NIVEIS_COBRANCA` (line 66–74), `DEFAULT_TEMPLATES` (line 80–145), `initTurboZapTables` seed configs (line 208–220), `enviarMensagemWhatsApp` (line 390–433), and `previewCobrancas` / `executarCobrancas`.

**Step 1: Add `instancia` and `condicional` to NIVEIS_COBRANCA type and extend the array**

Replace lines 66–74 with:

```typescript
interface NivelCobranca {
  tipo: string;
  label: string;
  dias: number;
  instancia: "financeiro" | "juridico";
  condicional?: string; // key in pipeline to check before sending
}

const NIVEIS_COBRANCA: NivelCobranca[] = [
  { tipo: "D-3", label: "D-3 (Lembrete)", dias: -3, instancia: "financeiro" },
  { tipo: "D+0", label: "D+0 (Vencimento)", dias: 0, instancia: "financeiro" },
  { tipo: "D+3", label: "D+3 (3 dias)", dias: 3, instancia: "financeiro" },
  { tipo: "D+7", label: "D+7 (Suspensão)", dias: 7, instancia: "financeiro" },
  { tipo: "D+10", label: "D+10 (Rescisão)", dias: 10, instancia: "financeiro" },
  { tipo: "D+15", label: "D+15 (Encerramento)", dias: 15, instancia: "financeiro" },
  { tipo: "D+20", label: "D+20 (Cancelado)", dias: 20, instancia: "financeiro" },
  { tipo: "D+30", label: "D+30 (Formalização Jurídica)", dias: 30, instancia: "juridico" },
  { tipo: "D+40", label: "D+40 (Comunicação Protesto)", dias: 40, instancia: "juridico" },
  { tipo: "D+45", label: "D+45 (Protesto Efetivado)", dias: 45, instancia: "juridico", condicional: "protesto_efetivado" },
  { tipo: "D+50", label: "D+50 (Aviso Negativação)", dias: 50, instancia: "juridico" },
  { tipo: "D+55", label: "D+55 (Negativação Efetivada)", dias: 55, instancia: "juridico", condicional: "negativacao_efetivada" },
];
```

**Step 2: Add 5 juridico DEFAULT_TEMPLATES**

After the existing `"D+20"` template (line 144), add:

```typescript
  "D+30": `Prezado(a), {nome}\n
Informamos que, em razão da inadimplência referente à fatura vencida em {vencimento}, no valor de R$ {valor}, o caso foi formalmente encaminhado ao departamento jurídico da empresa.\n
A partir desta data, todas as tratativas relacionadas ao débito serão conduzidas exclusivamente pela área jurídica.\n
Caso haja interesse na regularização imediata do débito, segue abaixo o boleto atualizado:\n
{link_pagamento}\n
Orientamos que o pagamento seja realizado com a maior brevidade possível, a fim de evitar a adoção de medidas legais cabíveis.\n
— Departamento Jurídico | Turbo Partners`,

  "D+40": `Prezado(a), {nome}\n
Na qualidade de representante legal, informamos que foi iniciado o procedimento de protesto extrajudicial referente ao débito vencido em {vencimento}, no valor de R$ {valor}.\n
O protesto será formalizado junto ao cartório competente no prazo de até 5 (cinco) dias úteis, caso a pendência não seja regularizada.\n
Para evitar o registro do protesto, providencie o pagamento através do link abaixo:\n
{link_pagamento}\n
Alertamos que o protesto implica em restrições de crédito e pode impactar diretamente a capacidade de obtenção de financiamentos e participação em licitações.\n
— Departamento Jurídico | Turbo Partners`,

  "D+45": `Prezado(a), {nome}\n
Informamos que o protesto referente ao débito vencido em {vencimento}, no valor de R$ {valor}, foi efetivado junto ao cartório competente.\n
O registro do protesto gera implicações legais e financeiras imediatas, incluindo restrição cadastral e impacto na obtenção de crédito.\n
Ainda é possível regularizar a situação mediante pagamento integral do débito. Após a confirmação do pagamento, providenciaremos a baixa do protesto.\n
{link_pagamento}\n
— Departamento Jurídico | Turbo Partners`,

  "D+50": `Prezado(a), {nome}\n
Na qualidade de representante legal, informamos que, diante da manutenção da inadimplência e do protesto já efetivado, será realizada a negativação do débito junto aos órgãos de proteção ao crédito (SPC/Serasa).\n
O débito de R$ {valor}, vencido em {vencimento}, será registrado no prazo de 5 (cinco) dias úteis, caso não haja regularização.\n
Para evitar a negativação, providencie o pagamento:\n
{link_pagamento}\n
Alertamos que a negativação impacta diretamente o score de crédito e pode restringir operações financeiras da empresa.\n
— Departamento Jurídico | Turbo Partners`,

  "D+55": `Prezado(a), {nome}\n
Informamos que a negativação referente ao débito de R$ {valor}, vencido em {vencimento}, foi efetivada junto aos órgãos de proteção ao crédito (SPC/Serasa).\n
O registro permanecerá ativo até a quitação integral do débito ou pelo prazo legal de 5 anos.\n
Após a confirmação do pagamento, providenciaremos a exclusão da negativação no prazo de até 5 (cinco) dias úteis.\n
{link_pagamento}\n
— Departamento Jurídico | Turbo Partners`,
```

**Step 3: Add juridico template seeds + dry_run_juridico in `initTurboZapTables`**

In the `seedConfigs` array (around line 208–220), add after the `"dry_run"` entry:

```typescript
      { chave: "template_D+30", valor: DEFAULT_TEMPLATES["D+30"] },
      { chave: "template_D+40", valor: DEFAULT_TEMPLATES["D+40"] },
      { chave: "template_D+45", valor: DEFAULT_TEMPLATES["D+45"] },
      { chave: "template_D+50", valor: DEFAULT_TEMPLATES["D+50"] },
      { chave: "template_D+55", valor: DEFAULT_TEMPLATES["D+55"] },
      { chave: "dry_run_juridico", valor: "true" },
```

**Step 4: Modify `enviarMensagemWhatsApp` to accept `instancia` parameter**

Replace the function signature (line 390–393) and instance logic:

```typescript
async function enviarMensagemWhatsApp(
  numero: string,
  texto: string,
  instancia: "financeiro" | "juridico" = "financeiro",
): Promise<{ success: boolean; error?: string }> {
  const serverUrl = process.env.EVOLUTION_SERVER_URL;
  const instanceId = instancia === "juridico"
    ? process.env.EVOLUTION_JURIDICO_INSTANCE_ID
    : process.env.EVOLUTION_INSTANCE_ID;
  const token = process.env.EVOLUTION_TOKEN;

  if (!serverUrl || !instanceId || !token) {
    return { success: false, error: `Evolution API não configurada para instância '${instancia}'` };
  }

  const dryRunKey = instancia === "juridico" ? "dry_run_juridico" : "dry_run";
  const dryRun = await getConfiguracao(dryRunKey);
  if (dryRun === "true") {
    console.log(`[turbozap][DRY_RUN][${instancia}] Não enviando para ${numero}`);
    return { success: true };
  }
```

The rest of the function (fetch call) stays the same — it already uses `instanceId`.

**Step 5: Add `instancia` field to PreviewNivel interface**

At line 20–27, add `instancia` and `condicional`:

```typescript
export interface PreviewNivel {
  tipo: string;
  label: string;
  dias: number;
  data_vencimento: string;
  clientes: ClienteCobranca[];
  total_valor: number;
  instancia: "financeiro" | "juridico";
  condicional?: string;
}
```

Update `previewCobrancas` (around line 373) to include `instancia` and `condicional`:

```typescript
    niveis.push({
      tipo: nivel.tipo,
      label: nivel.label,
      dias: nivel.dias,
      data_vencimento: dataVencimento,
      clientes: unicos,
      total_valor: totalValor,
      instancia: nivel.instancia,
      condicional: nivel.condicional,
    });
```

**Step 6: Update `executarCobrancas` to pass instancia and check conditionals**

In the `executarCobrancas` function, after the template check (around line 460), add conditional pipeline check:

```typescript
    for (const cliente of nivel.clientes) {
      // Check conditional pipeline flag (D+45, D+55)
      if (nivel.condicional) {
        const pipeline = await checkPipelineJuridico(cliente.cnpj, cliente.data_vencimento);
        if (!pipeline || !(pipeline as any)[nivel.condicional]) {
          pulados++;
          await db.execute(sql`
            INSERT INTO cortex_core.turbozap_envios (
              id_cliente, cliente_nome, cnpj, telefone,
              data_vencimento, valor, link_pagamento,
              tipo_cobranca, mensagem_enviada, status, erro_detalhe,
              executado_por, execucao_id
            ) VALUES (
              ${cliente.id_cliente}, ${cliente.cliente_nome}, ${cliente.cnpj || ""},
              ${cliente.telefone}, ${cliente.data_vencimento}, ${Number(cliente.total)},
              ${cliente.link_pagamento || ""}, ${nivel.tipo}, ${""},
              'pulado', ${"Condicional não atendido: " + nivel.condicional},
              ${executadoPor}, ${execucaoId}
            )
          `);
          continue;
        }
      }
```

And update the `enviarMensagemWhatsApp` call (line 496) to pass instancia:

```typescript
      const resultado = await enviarMensagemWhatsApp(numero, mensagem, nivel.instancia);
```

Also, when D+30 is sent successfully, auto-create a pipeline record:

```typescript
      if (resultado.success) {
        enviados++;
        // Auto-create pipeline record when D+30 is sent
        if (nivel.tipo === "D+30") {
          await db.execute(sql`
            INSERT INTO cortex_core.turbozap_pipeline_juridico (cnpj, cliente_nome, data_vencimento, valor, etapa)
            VALUES (${cliente.cnpj || ""}, ${cliente.cliente_nome}, ${cliente.data_vencimento}, ${Number(cliente.total)}, 'formalizado')
            ON CONFLICT (cnpj, data_vencimento) DO NOTHING
          `);
        }
        // ... rest of envios insert
```

**Step 7: Add `checkPipelineJuridico` helper function**

Add before `executarCobrancas`:

```typescript
async function checkPipelineJuridico(cnpj: string, dataVencimento: string): Promise<Record<string, any> | null> {
  const result = await db.execute(sql`
    SELECT * FROM cortex_core.turbozap_pipeline_juridico
    WHERE cnpj = ${cnpj} AND data_vencimento = ${dataVencimento}
    LIMIT 1
  `);
  return result.rows.length > 0 ? (result.rows[0] as Record<string, any>) : null;
}
```

**Step 8: Commit**

```bash
git add server/services/turbozap.ts
git commit -m "feat(turbozap): add juridico levels D+30-D+55 with instance routing and conditional logic"
git push
```

---

### Task 2: Create Pipeline Table + Backend CRUD Endpoints

**Files:**
- Modify: `server/services/turbozap.ts` (add pipeline table init + CRUD functions)
- Modify: `server/routes/turbozap.ts` (add pipeline endpoints)

**Step 1: Add pipeline table creation in `initTurboZapTables`**

After the `turbozap_configuracoes` seed block (around line 228), add:

```typescript
    // Create pipeline juridico table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cortex_core.turbozap_pipeline_juridico (
        id SERIAL PRIMARY KEY,
        cnpj TEXT NOT NULL,
        cliente_nome TEXT,
        data_vencimento DATE NOT NULL,
        valor DECIMAL(12,2),
        etapa TEXT DEFAULT 'formalizado',
        protesto_efetivado BOOLEAN DEFAULT false,
        negativacao_efetivada BOOLEAN DEFAULT false,
        observacoes TEXT,
        atualizado_por TEXT,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(cnpj, data_vencimento)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_turbozap_pipeline_cnpj ON cortex_core.turbozap_pipeline_juridico(cnpj)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_turbozap_pipeline_etapa ON cortex_core.turbozap_pipeline_juridico(etapa)
    `);
```

**Step 2: Add pipeline CRUD exports to turbozap.ts**

Add at the end of the file:

```typescript
// ============================================
// Pipeline Jurídico CRUD
// ============================================

export interface PipelineJuridico {
  id: number;
  cnpj: string;
  cliente_nome: string;
  data_vencimento: string;
  valor: number;
  etapa: string;
  protesto_efetivado: boolean;
  negativacao_efetivada: boolean;
  observacoes: string | null;
  atualizado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export async function getPipelineJuridico(): Promise<PipelineJuridico[]> {
  const result = await db.execute(sql`
    SELECT * FROM cortex_core.turbozap_pipeline_juridico
    ORDER BY criado_em DESC
    LIMIT 200
  `);
  return result.rows as PipelineJuridico[];
}

export async function updatePipelineJuridico(
  id: number,
  updates: { etapa?: string; protesto_efetivado?: boolean; negativacao_efetivada?: boolean; observacoes?: string },
  atualizadoPor: string,
): Promise<PipelineJuridico> {
  const setClauses: string[] = ["atualizado_em = NOW()", `atualizado_por = '${atualizadoPor.replace(/'/g, "''")}'`];

  if (updates.etapa !== undefined) {
    setClauses.push(`etapa = '${updates.etapa.replace(/'/g, "''")}'`);
  }
  if (updates.protesto_efetivado !== undefined) {
    setClauses.push(`protesto_efetivado = ${updates.protesto_efetivado}`);
  }
  if (updates.negativacao_efetivada !== undefined) {
    setClauses.push(`negativacao_efetivada = ${updates.negativacao_efetivada}`);
  }
  if (updates.observacoes !== undefined) {
    setClauses.push(`observacoes = '${updates.observacoes.replace(/'/g, "''")}'`);
  }

  const result = await db.execute(
    sql.raw(`
      UPDATE cortex_core.turbozap_pipeline_juridico
      SET ${setClauses.join(", ")}
      WHERE id = ${id}
      RETURNING *
    `),
  );

  if (result.rows.length === 0) {
    throw new Error(`Pipeline record #${id} não encontrado`);
  }
  return result.rows[0] as PipelineJuridico;
}
```

**Step 3: Add pipeline routes to `server/routes/turbozap.ts`**

Add imports at line 2:

```typescript
import {
  initTurboZapTables,
  previewCobrancas,
  executarCobrancas,
  getHistorico,
  getStats,
  getConfiguracoes,
  updateConfiguracao,
  getPipelineJuridico,
  updatePipelineJuridico,
} from "../services/turbozap";
```

Add before the closing `}` of `registerTurboZapRoutes` (before line 118):

```typescript
  // GET /api/turbozap/pipeline-juridico - Lista pipeline jurídico
  app.get("/api/turbozap/pipeline-juridico", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const pipeline = await getPipelineJuridico();
      res.json(pipeline);
    } catch (error) {
      console.error("[turbozap] Error fetching pipeline juridico:", error);
      res.status(500).json({ message: "Erro ao buscar pipeline jurídico" });
    }
  });

  // PUT /api/turbozap/pipeline-juridico/:id - Atualizar registro do pipeline
  app.put("/api/turbozap/pipeline-juridico/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated())
        return res.status(401).json({ message: "Não autenticado" });

      const user = req.user as any;
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const { etapa, protesto_efetivado, negativacao_efetivada, observacoes } = req.body;

      const updated = await updatePipelineJuridico(
        id,
        { etapa, protesto_efetivado, negativacao_efetivada, observacoes },
        user?.email || user?.name || "sistema",
      );
      res.json(updated);
    } catch (error: any) {
      console.error("[turbozap] Error updating pipeline juridico:", error);
      res.status(500).json({ message: error.message || "Erro ao atualizar pipeline" });
    }
  });
```

**Step 4: Commit**

```bash
git add server/services/turbozap.ts server/routes/turbozap.ts
git commit -m "feat(turbozap): add pipeline juridico table and CRUD endpoints"
git push
```

---

### Task 3: Frontend — Extend TIPO_COLORS, Types, and Preview Tab for Juridico Levels

**Files:**
- Modify: `client/src/pages/TurboZap.tsx`

**Context:** `TIPO_COLORS` is at lines 87–95. `PreviewNivel` interface is at lines 41–48.

**Step 1: Add juridico colors to TIPO_COLORS**

Add 5 entries after `"D+20"` (line 94):

```typescript
  "D+30": { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  "D+40": { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30", text: "text-fuchsia-700 dark:text-fuchsia-300", border: "border-fuchsia-200 dark:border-fuchsia-800" },
  "D+45": { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  "D+50": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
  "D+55": { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-800 dark:text-red-300", border: "border-red-300 dark:border-red-800" },
```

**Step 2: Add `instancia` and `condicional` to frontend `PreviewNivel` interface**

At lines 41–48, update:

```typescript
interface PreviewNivel {
  tipo: string;
  label: string;
  dias: number;
  data_vencimento: string;
  clientes: ClienteCobranca[];
  total_valor: number;
  instancia: "financeiro" | "juridico";
  condicional?: string;
}
```

**Step 3: In PreviewTab, add a visual separator between financeiro and juridico levels**

Find where the preview `niveis` are mapped in the PreviewTab component. Between the financeiro and juridico sections, add a visual divider. Wrap the existing nivel.map with logic to show a "Jurídico" section header before the first juridico level:

```tsx
{niveis.map((nivel, idx) => {
  const isFirstJuridico = nivel.instancia === "juridico" && (idx === 0 || niveis[idx - 1]?.instancia !== "juridico");
  return (
    <div key={nivel.tipo}>
      {isFirstJuridico && (
        <div className="flex items-center gap-2 mt-6 mb-2">
          <div className="h-px flex-1 bg-violet-200 dark:bg-violet-800" />
          <span className="text-sm font-semibold text-violet-600 dark:text-violet-400 px-2">Jurídico</span>
          <div className="h-px flex-1 bg-violet-200 dark:bg-violet-800" />
        </div>
      )}
      {/* existing nivel card rendering */}
    </div>
  );
})}
```

**Step 4: Commit**

```bash
git add client/src/pages/TurboZap.tsx
git commit -m "feat(turbozap): add juridico level colors and preview separator in frontend"
git push
```

---

### Task 4: Frontend — Pipeline Jurídico Tab

**Files:**
- Modify: `client/src/pages/TurboZap.tsx`

**Step 1: Add Gavel icon import**

At line 11 (lucide-react imports), add `Gavel` (or `Scale`):

```typescript
import {
  Zap, Send, History, Settings, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, SkipForward, Search, Loader2,
  MessageSquare, TrendingUp, AlertTriangle, Phone, X, Scale,
} from "lucide-react";
```

Also add `Switch` from shadcn if not imported:

```typescript
import { Switch } from "@/components/ui/switch";
```

**Step 2: Add 4th tab trigger**

At lines 154–166, add after the Configurações TabsTrigger:

```tsx
          <TabsTrigger value="pipeline" className="gap-2">
            <Scale className="w-4 h-4" /> Pipeline Jurídico
          </TabsTrigger>
```

And add the tab content render at line 170:

```tsx
      {activeTab === "pipeline" && <PipelineJuridicoTab />}
```

**Step 3: Add PipelineJuridico interface**

After the existing interfaces (around line 81):

```typescript
interface PipelineJuridico {
  id: number;
  cnpj: string;
  cliente_nome: string;
  data_vencimento: string;
  valor: number;
  etapa: string;
  protesto_efetivado: boolean;
  negativacao_efetivada: boolean;
  observacoes: string | null;
  atualizado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

const ETAPAS_PIPELINE = [
  { value: "formalizado", label: "Formalizado", color: "text-violet-600 dark:text-violet-400" },
  { value: "protesto_comunicado", label: "Protesto Comunicado", color: "text-fuchsia-600 dark:text-fuchsia-400" },
  { value: "protesto_efetivado", label: "Protesto Efetivado", color: "text-pink-600 dark:text-pink-400" },
  { value: "negativacao_comunicada", label: "Negativação Comunicada", color: "text-rose-600 dark:text-rose-400" },
  { value: "negativacao_efetivada", label: "Negativação Efetivada", color: "text-red-600 dark:text-red-400" },
];
```

**Step 4: Create PipelineJuridicoTab component**

Add before the final closing of the file (after ConfiguracoesTab):

```tsx
// ============================================
// Pipeline Jurídico Tab
// ============================================

function PipelineJuridicoTab() {
  const { toast } = useToast();

  const { data: pipeline = [], isLoading } = useQuery<PipelineJuridico[]>({
    queryKey: ["/api/turbozap/pipeline-juridico"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Record<string, any> }) => {
      const res = await apiRequest("PUT", `/api/turbozap/pipeline-juridico/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turbozap/pipeline-juridico"] });
      toast({ title: "Pipeline atualizado!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (pipeline.length === 0) {
    return (
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardContent className="py-16 text-center">
          <Scale className="w-12 h-12 text-gray-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-zinc-400">Nenhum caso no pipeline jurídico.</p>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">
            Registros são criados automaticamente quando mensagens D+30 são enviadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white text-lg flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Pipeline Jurídico ({pipeline.length} casos)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-700">
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Cliente</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">CNPJ</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Vencimento</th>
                <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Valor</th>
                <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Etapa</th>
                <th className="text-center py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Protesto</th>
                <th className="text-center py-3 px-2 font-medium text-gray-600 dark:text-zinc-400">Negativação</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                  <td className="py-3 px-2 text-gray-900 dark:text-white font-medium">{item.cliente_nome}</td>
                  <td className="py-3 px-2 text-gray-600 dark:text-zinc-400 font-mono text-xs">{item.cnpj}</td>
                  <td className="py-3 px-2 text-gray-600 dark:text-zinc-400">{formatDate(item.data_vencimento)}</td>
                  <td className="py-3 px-2 text-right text-gray-900 dark:text-white">{formatCurrency(item.valor)}</td>
                  <td className="py-3 px-2">
                    <Select
                      value={item.etapa}
                      onValueChange={(v) => updateMutation.mutate({ id: item.id, updates: { etapa: v } })}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs bg-gray-50 dark:bg-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ETAPAS_PIPELINE.map((e) => (
                          <SelectItem key={e.value} value={e.value}>
                            <span className={e.color}>{e.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Switch
                      checked={item.protesto_efetivado}
                      onCheckedChange={(v) => updateMutation.mutate({ id: item.id, updates: { protesto_efetivado: v } })}
                    />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Switch
                      checked={item.negativacao_efetivada}
                      onCheckedChange={(v) => updateMutation.mutate({ id: item.id, updates: { negativacao_efetivada: v } })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Commit**

```bash
git add client/src/pages/TurboZap.tsx
git commit -m "feat(turbozap): add Pipeline Jurídico tab with stage control and toggle switches"
git push
```

---

### Task 5: Frontend — Extend Configurações Tab with Juridico Templates + dry_run_juridico

**Files:**
- Modify: `client/src/pages/TurboZap.tsx`

**Step 1: Extend templateKeys array**

At line 670, replace:

```typescript
  const templateKeys = ["D-3", "D+0", "D+3", "D+7", "D+10", "D+15", "D+20"];
```

With:

```typescript
  const templateKeysFinanceiro = ["D-3", "D+0", "D+3", "D+7", "D+10", "D+15", "D+20"];
  const templateKeysJuridico = ["D+30", "D+40", "D+45", "D+50", "D+55"];
```

**Step 2: Render templates in two sections**

Replace the Templates Card (lines 710–755) to render two sections — first "Templates Financeiro" with `templateKeysFinanceiro`, then a second Card "Templates Jurídico" with `templateKeysJuridico`. Use the same template rendering logic for both, just with different keys.

```tsx
      {/* Templates Financeiro */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-lg">
            Templates — Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {templateKeysFinanceiro.map((tipo) => {
            const chave = `template_${tipo}`;
            const colors = TIPO_COLORS[tipo] || TIPO_COLORS["D-3"];
            const isDirty = dirty.has(chave);
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${colors.bg} ${colors.text} border-0`}>{tipo}</Badge>
                    {isDirty && <span className="text-xs text-yellow-600 dark:text-yellow-400">modificado</span>}
                  </div>
                  {isDirty && (
                    <Button size="sm" variant="outline" onClick={() => saveMutation.mutate(chave)} disabled={saveMutation.isPending}>
                      Salvar
                    </Button>
                  )}
                </div>
                <Textarea
                  value={getVal(chave)}
                  onChange={(e) => setVal(chave, e.target.value)}
                  className="min-h-[120px] bg-gray-50 dark:bg-zinc-800 text-sm font-mono"
                  placeholder={`Template para ${tipo}...`}
                />
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  Variáveis: {"{nome}"}, {"{valor}"}, {"{vencimento}"}, {"{link_pagamento}"}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Templates Jurídico */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white text-lg flex items-center gap-2">
            Templates — Jurídico
            <Badge variant="outline" className="text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700">
              Instância Jurídico
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {templateKeysJuridico.map((tipo) => {
            const chave = `template_${tipo}`;
            const colors = TIPO_COLORS[tipo] || TIPO_COLORS["D+30"];
            const isDirty = dirty.has(chave);
            return (
              <div key={tipo} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${colors.bg} ${colors.text} border-0`}>{tipo}</Badge>
                    {isDirty && <span className="text-xs text-yellow-600 dark:text-yellow-400">modificado</span>}
                  </div>
                  {isDirty && (
                    <Button size="sm" variant="outline" onClick={() => saveMutation.mutate(chave)} disabled={saveMutation.isPending}>
                      Salvar
                    </Button>
                  )}
                </div>
                <Textarea
                  value={getVal(chave)}
                  onChange={(e) => setVal(chave, e.target.value)}
                  className="min-h-[120px] bg-gray-50 dark:bg-zinc-800 text-sm font-mono"
                  placeholder={`Template para ${tipo}...`}
                />
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  Variáveis: {"{nome}"}, {"{valor}"}, {"{vencimento}"}, {"{link_pagamento}"}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
```

**Step 3: Add `dry_run_juridico` toggle**

In the "Configurações Gerais" Card (around line 810–853), add a 4th field in the grid (change `md:grid-cols-3` to `md:grid-cols-4`):

```tsx
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Dry run Jurídico
              </label>
              <Select
                value={getVal("dry_run_juridico")}
                onValueChange={(v) => setVal("dry_run_juridico", v)}
              >
                <SelectTrigger className="bg-gray-50 dark:bg-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativado (não envia)</SelectItem>
                  <SelectItem value="false">Desativado (envia de verdade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
```

**Step 4: Commit**

```bash
git add client/src/pages/TurboZap.tsx
git commit -m "feat(turbozap): add juridico templates and dry_run_juridico to config tab"
git push
```

---

### Task 6: E2E Verification

**Step 1: Restart server and verify no TypeScript errors**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev &
```

Wait ~45 seconds for startup.

**Step 2: Check TypeScript diagnostics**

Use VS Code diagnostics or `npx tsc --noEmit` on modified files.

**Step 3: Verify endpoints respond**

```bash
# Pipeline endpoint (should return 401 without auth, proving route is registered)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/turbozap/pipeline-juridico

# Preview endpoint (should still work — 401 without auth)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/turbozap/preview
```

Expected: `401` for both (auth required).

**Step 4: Verify pipeline table exists in DB**

The `initTurboZapTables` runs on server start. Check server logs for `[turbozap] Tables initialized successfully`.

**Step 5: Verify frontend loads**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/turbozap
```

Expected: `200`.
