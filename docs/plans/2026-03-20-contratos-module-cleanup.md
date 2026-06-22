# ContratosModule — Limpeza Visual + Templates + Duplicar

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplificar visualmente o ContratosModule, adicionar templates de contrato e funcionalidade de duplicar contrato existente.

**Architecture:** Limpeza cirúrgica no arquivo existente (`ContratosModule.tsx`, 3422 linhas) sem reescrita. Novo endpoint e tabela para templates. Refactor do `NovoContratoTab` para aceitar dados iniciais (usado por templates e duplicação).

**Tech Stack:** React, TypeScript, TanStack Query, shadcn/ui, Tailwind CSS, PostgreSQL (staging schema)

---

### Task 1: Criar tabela contrato_templates no banco

**Files:**
- Create: `server/migrations/add-contrato-templates.sql` (referência — executar via SQL direto)

**Step 1: Criar a tabela no banco**

Executar no banco PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS staging.contrato_templates (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  itens_template JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

O campo `itens_template` armazena array de objetos com a mesma estrutura de `ContratoItem` (servico_id, plano_servico_id, valor_negociado, modalidade, escopo, quantidade, etc.).

**Step 2: Verificar que a tabela foi criada**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'staging' AND table_name = 'contrato_templates'
ORDER BY ordinal_position;
```

**Step 3: Commit**

```bash
git add server/migrations/add-contrato-templates.sql
git commit -m "feat(contratos): add contrato_templates table migration"
```

---

### Task 2: Backend — CRUD de templates

**Files:**
- Modify: `server/routes/contratos.ts` (adicionar após linha ~1129, bloco de planos-servicos)

**Step 1: Adicionar endpoints de templates**

Inserir em `server/routes/contratos.ts`, após o bloco de `DELETE /api/contratos/planos-servicos/:id` (linha ~1129):

```typescript
  // ── Templates de Contrato ──────────────────────────────────────

  app.get("/api/contratos/templates", async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM staging.contrato_templates WHERE ativo = true ORDER BY nome`
      );
      res.json({ templates: result.rows });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contratos/templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT * FROM staging.contrato_templates WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      res.json({ template: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contratos/templates", async (req, res) => {
    try {
      const { nome, descricao, itens_template } = req.body;
      const result = await pool.query(
        `INSERT INTO staging.contrato_templates (nome, descricao, itens_template)
         VALUES ($1, $2, $3) RETURNING *`,
        [nome, descricao || null, JSON.stringify(itens_template || [])]
      );
      res.json({ template: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/contratos/templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nome, descricao, itens_template } = req.body;
      const result = await pool.query(
        `UPDATE staging.contrato_templates
         SET nome = $1, descricao = $2, itens_template = $3, updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [nome, descricao || null, JSON.stringify(itens_template || []), id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Template não encontrado" });
      }
      res.json({ template: result.rows[0] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/contratos/templates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query(
        `UPDATE staging.contrato_templates SET ativo = false, updated_at = NOW() WHERE id = $1`,
        [id]
      );
      res.json({ message: "Template desativado" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
```

**Step 2: Testar endpoints manualmente**

```bash
# Criar template de teste
curl -X POST http://localhost:3000/api/contratos/templates \
  -H "Content-Type: application/json" \
  -d '{"nome":"Social Media Básico","descricao":"Pacote básico de social media","itens_template":[{"servico_id":1,"quantidade":1,"valor_negociado":2000,"modalidade":"recorrente"}]}'

# Listar
curl http://localhost:3000/api/contratos/templates
```

**Step 3: Commit**

```bash
git add server/routes/contratos.ts
git commit -m "feat(contratos): add template CRUD endpoints"
```

---

### Task 3: Limpeza Visual — Remover gradientes e simplificar tab bar

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx`

**Step 1: Remover todos os gradientes**

Substituir TODAS as ocorrências de classes `bg-gradient-to-*` no arquivo por backgrounds sólidos simples. Localizações exatas:

- Linhas 302, 328, 355, 374: `bg-gradient-to-bl from-{color}-500/20 to-transparent` → remover a div inteira do accent (é apenas decorativa)
- Linhas 493, 499, 505, 511: `bg-gradient-to-br from-{color}-500/10 to-{color}-500/5` → `bg-muted/50`
- Linhas 839, 850, 861: `bg-gradient-to-br from-{color}-500/10 to-{color}-500/5` → `bg-muted/50`
- Linhas 1760, 1771, 1782, 1793: `bg-gradient-to-br from-{color}-500/10 to-{color}-500/5` → `bg-muted/50`
- Linha 1989: `bg-gradient-to-r from-primary/10 via-primary/5 to-transparent` → `bg-muted/30`
- Linha 2605: `border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-transparent` → remover classes de gradiente
- Linha 3343: `bg-gradient-to-r from-background via-muted/30 to-background` → `bg-muted/30`

**Step 2: Simplificar tab bar (linhas 3345-3396)**

Substituir o TabsList colorido por versão monocromática com underline:

```tsx
<TabsList className="grid w-full grid-cols-5 bg-transparent p-0 h-auto border-b">
  <TabsTrigger value="dashboard" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground">
    <LayoutDashboard className="mr-2 h-4 w-4" />
    Dashboard
  </TabsTrigger>
  <TabsTrigger value="entidades" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground">
    <Building2 className="mr-2 h-4 w-4" />
    Entidades
  </TabsTrigger>
  <TabsTrigger value="contratos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground">
    <FileText className="mr-2 h-4 w-4" />
    Contratos
  </TabsTrigger>
  <TabsTrigger value="novo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground">
    <Plus className="mr-2 h-4 w-4" />
    Novo Contrato
  </TabsTrigger>
  <TabsTrigger value="servicos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3 text-muted-foreground data-[state=active]:text-foreground">
    <Package className="mr-2 h-4 w-4" />
    Serviços
  </TabsTrigger>
</TabsList>
```

**Step 3: Verificar visual no browser**

Abrir `/contratos-module`, navegar entre todas as abas, confirmar que gradientes sumiram e tabs estão limpas em dark e light mode.

**Step 4: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "style(contratos): remove gradients, simplify tab bar to monochrome underline"
```

---

### Task 4: Limpeza Visual — Remover stat cards redundantes das abas

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx`

**Step 1: Simplificar DashboardTab (linha 256)**

Reduzir de 13+ cards para 4 KPIs simples. Substituir o bloco de cards (linhas ~299-520) por:

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">Total Contratos</p>
      <p className="text-2xl font-bold">{stats?.contratos.total ?? 0}</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">Ativos</p>
      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.contratos.ativos ?? 0}</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">Receita Ativa</p>
      <p className="text-2xl font-bold">{formatCurrency(stats?.valorTotalAtivos ?? 0)}</p>
    </CardContent>
  </Card>
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">Rascunhos</p>
      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.contratos.rascunhos ?? 0}</p>
    </CardContent>
  </Card>
</div>
```

Remover todo o restante do DashboardTab (cards de entidades, status chart, tipos, quick stats).

**Step 2: Remover stat cards da EntidadesTab (linhas ~838-868)**

Remover o grid de 4 cards (Total, Clientes, Fornecedores, botão). Manter apenas a barra de busca + filtro + botão "Nova Entidade".

**Step 3: Remover stat cards da ContratosTab (linhas ~1759-1804)**

Remover o grid de 4 cards. Manter apenas a barra de busca + filtro + botão "Novo Contrato".

**Step 4: Remover botões duplicados**

- EntidadesTab: remover o card com borda dashed que age como botão (manter apenas o botão na barra de filtro)
- ContratosTab: garantir um único botão "Novo Contrato" na barra de ações

**Step 5: Verificar visual**

Navegar por Dashboard, Entidades e Contratos. Confirmar que a interface está limpa sem cards redundantes.

**Step 6: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "style(contratos): remove redundant stat cards, simplify dashboard to 4 KPIs"
```

---

### Task 5: Limpeza Visual — Simplificar detalhe do contrato

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx`

**Step 1: Simplificar o dialog de visualização do contrato (linhas ~1984-2060)**

Substituir os 3 cards de valor (Original, Negociado, Economia) por uma linha resumo simples:

```tsx
<div className="flex items-center gap-6 py-3 px-4 bg-muted/30 rounded-lg">
  <div>
    <span className="text-sm text-muted-foreground">Original</span>
    <p className="font-semibold">{formatCurrency(contrato.valor_original)}</p>
  </div>
  <div>
    <span className="text-sm text-muted-foreground">Negociado</span>
    <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(contrato.valor_negociado)}</p>
  </div>
  {contrato.economia > 0 && (
    <div>
      <span className="text-sm text-muted-foreground">Economia</span>
      <p className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(contrato.economia)}</p>
    </div>
  )}
</div>
```

**Step 2: Remover header com gradiente do dialog (linha ~1989)**

Substituir por header simples:

```tsx
<DialogHeader className="pb-4 border-b">
  <div className="flex items-center justify-between">
    <div>
      <DialogTitle className="text-xl">Contrato {contrato.numero_contrato}</DialogTitle>
      {contrato.id_crm && <p className="text-sm text-muted-foreground">CRM: {contrato.id_crm}</p>}
    </div>
    <Badge variant={...}>{contrato.status}</Badge>
  </div>
</DialogHeader>
```

**Step 3: Remover ícones decorativos redundantes**

No dialog de visualização, remover ícones que aparecem antes de cada seção (DollarSign antes de valores, User antes de comercial, etc.) — manter apenas texto com labels claros.

**Step 4: Verificar visual**

Abrir detalhe de um contrato, confirmar layout limpo em dark/light mode.

**Step 5: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "style(contratos): simplify contract detail dialog, remove visual noise"
```

---

### Task 6: Refatorar NovoContratoTab para aceitar dados iniciais

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (NovoContratoTab, linha 2249)

**Step 1: Alterar a assinatura da função**

Mudar de:

```typescript
function NovoContratoTab({ onSuccess }: { onSuccess: () => void })
```

Para:

```typescript
interface NovoContratoTabProps {
  onSuccess: () => void;
  initialData?: {
    formData?: Partial<typeof defaultFormData>;
    itens?: ContratoItem[];
    source?: 'template' | 'duplicate';
  };
  onConsumeInitialData?: () => void;
}

const defaultFormData = {
  numero_contrato: '',
  cliente_id: null as number | null,
  comercial_nome: '',
  comercial_email: '',
  id_crm: '',
  status: 'rascunho',
  observacoes: '',
};

function NovoContratoTab({ onSuccess, initialData, onConsumeInitialData }: NovoContratoTabProps)
```

**Step 2: Usar initialData na inicialização do estado**

Substituir o useState atual (linha ~2251) por:

```typescript
const [formData, setFormData] = useState(() => ({
  ...defaultFormData,
  ...(initialData?.formData || {}),
}));

const [itens, setItens] = useState<ContratoItem[]>(initialData?.itens || []);
```

Adicionar useEffect para consumir dados iniciais quando recebidos:

```typescript
useEffect(() => {
  if (initialData) {
    setFormData(prev => ({ ...defaultFormData, ...initialData.formData }));
    setItens(initialData.itens || []);
    // Para duplicação, sempre limpar número e datas
    if (initialData.source === 'duplicate') {
      setFormData(prev => ({
        ...prev,
        numero_contrato: '',
        status: 'rascunho',
      }));
      setItens(prev => prev.map(item => ({
        ...item,
        id: undefined,
        contrato_id: undefined,
        data_inicio: null,
        data_fim: null,
      })));
    }
    onConsumeInitialData?.();
  }
}, [initialData]);
```

**Step 3: Atualizar a chamada no ContratosModule (linha ~3334)**

No componente principal, adicionar estado para dados iniciais:

```typescript
const [novoContratoInitialData, setNovoContratoInitialData] = useState<NovoContratoTabProps['initialData']>();
```

E passar para NovoContratoTab:

```tsx
<TabsContent value="novo">
  <NovoContratoTab
    onSuccess={() => setActiveTab("contratos")}
    initialData={novoContratoInitialData}
    onConsumeInitialData={() => setNovoContratoInitialData(undefined)}
  />
</TabsContent>
```

**Step 4: Verificar que criação normal (sem initialData) continua funcionando**

Abrir aba "Novo Contrato", preencher e criar um contrato normalmente.

**Step 5: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "refactor(contratos): NovoContratoTab accepts initialData for templates and duplication"
```

---

### Task 7: Frontend — Seletor de templates na aba Novo Contrato

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (NovoContratoTab, linha ~2249)

**Step 1: Adicionar query de templates**

Dentro de NovoContratoTab, adicionar:

```typescript
const { data: templatesData } = useQuery<{ templates: Array<{ id: number; nome: string; descricao: string | null; itens_template: ContratoItem[] }> }>({
  queryKey: ['/api/contratos/templates'],
});
```

**Step 2: Adicionar estado de seleção de template**

```typescript
const [templateSelected, setTemplateSelected] = useState(!!initialData);
```

**Step 3: Renderizar seletor antes do formulário**

Se `!templateSelected`, mostrar grid de templates em vez do formulário:

```tsx
{!templateSelected ? (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Como deseja começar?</h2>
      <p className="text-sm text-muted-foreground">Escolha um template ou comece do zero</p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {/* Card "Em branco" */}
      <Card
        className="cursor-pointer hover:border-primary transition-colors"
        onClick={() => setTemplateSelected(true)}
      >
        <CardContent className="pt-6 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium">Em branco</p>
          <p className="text-xs text-muted-foreground">Começar do zero</p>
        </CardContent>
      </Card>

      {/* Templates */}
      {templatesData?.templates.map(template => (
        <Card
          key={template.id}
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={() => {
            setFormData(prev => ({ ...prev }));
            setItens(template.itens_template.map(item => ({
              ...item,
              id: undefined,
              contrato_id: undefined,
            })));
            setTemplateSelected(true);
          }}
        >
          <CardContent className="pt-6 text-center">
            <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">{template.nome}</p>
            <p className="text-xs text-muted-foreground">
              {template.descricao || `${template.itens_template.length} serviço(s)`}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
) : (
  /* Formulário existente de criação */
  <>
    {/* ... todo o form atual ... */}
  </>
)}
```

**Step 4: Verificar fluxo**

1. Abrir "Novo Contrato" → deve mostrar seletor de templates
2. Clicar "Em branco" → formulário vazio
3. Clicar template → formulário pré-preenchido com itens

**Step 5: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "feat(contratos): add template selector on new contract tab"
```

---

### Task 8: Frontend — Gestão de templates na aba Serviços

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (ServicosTab, linha ~2958)

**Step 1: Adicionar seção "Templates" abaixo da lista de serviços**

No final de ServicosTab, após a lista de serviços e seus planos, adicionar:

```tsx
{/* Seção de Templates */}
<div className="mt-8">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold">Templates de Contrato</h3>
    <Button size="sm" onClick={() => setTemplateDialog({ open: true, mode: 'create' })}>
      <Plus className="mr-2 h-4 w-4" />
      Novo Template
    </Button>
  </div>

  <Card>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Serviços</TableHead>
          <TableHead className="w-24">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates?.map(t => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.nome}</TableCell>
            <TableCell className="text-muted-foreground">{t.descricao || '-'}</TableCell>
            <TableCell>{t.itens_template?.length || 0} item(ns)</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setTemplateDialog({ open: true, mode: 'edit', data: t })}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteTemplateMutation.mutate(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Card>
</div>
```

**Step 2: Adicionar dialog de criação/edição de template**

Dialog simples com:
- Nome (input)
- Descrição (textarea)
- Lista de itens (mesma lógica de addItem do NovoContratoTab — selecionar serviço + plano + valores)

**Step 3: Adicionar mutations**

```typescript
const { data: templatesResp } = useQuery<{ templates: any[] }>({
  queryKey: ['/api/contratos/templates'],
});
const templates = templatesResp?.templates || [];

const createTemplateMutation = useMutation({
  mutationFn: async (data: any) => {
    const res = await apiRequest('POST', '/api/contratos/templates', data);
    return res;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/contratos/templates'] });
    toast({ title: "Template criado!" });
    setTemplateDialog({ open: false, mode: 'create' });
  },
});

const deleteTemplateMutation = useMutation({
  mutationFn: async (id: number) => {
    await apiRequest('DELETE', `/api/contratos/templates/${id}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/contratos/templates'] });
    toast({ title: "Template removido" });
  },
});
```

**Step 4: Verificar CRUD de templates**

1. Criar template com 2 serviços
2. Verificar que aparece na lista
3. Editar nome/descrição
4. Deletar template

**Step 5: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "feat(contratos): add template management to Serviços tab"
```

---

### Task 9: Frontend — Botão "Salvar como template" no Novo Contrato

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (NovoContratoTab)

**Step 1: Adicionar botão ao lado de "Criar"**

No footer do formulário de NovoContratoTab (próximo ao botão "Criar"), adicionar:

```tsx
<Button
  variant="outline"
  onClick={() => setSaveAsTemplateOpen(true)}
  disabled={itens.length === 0}
>
  <Bookmark className="mr-2 h-4 w-4" />
  Salvar como Template
</Button>
```

**Step 2: Adicionar dialog simples**

```tsx
<Dialog open={saveAsTemplateOpen} onOpenChange={setSaveAsTemplateOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Salvar como Template</DialogTitle>
      <DialogDescription>Os serviços atuais serão salvos como template reutilizável.</DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <div>
        <Label>Nome do Template</Label>
        <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Ex: Social Media Básico" />
      </div>
      <div>
        <Label>Descrição (opcional)</Label>
        <Input value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} placeholder="Breve descrição" />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setSaveAsTemplateOpen(false)}>Cancelar</Button>
      <Button
        onClick={() => {
          saveTemplateMutation.mutate({
            nome: templateName,
            descricao: templateDesc,
            itens_template: itens.map(({ id, contrato_id, ...rest }) => rest),
          });
        }}
        disabled={!templateName.trim() || saveTemplateMutation.isPending}
      >
        Salvar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 3: Adicionar mutation e estado**

```typescript
const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
const [templateName, setTemplateName] = useState('');
const [templateDesc, setTemplateDesc] = useState('');

const saveTemplateMutation = useMutation({
  mutationFn: async (data: any) => {
    await apiRequest('POST', '/api/contratos/templates', data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/contratos/templates'] });
    toast({ title: "Template salvo!" });
    setSaveAsTemplateOpen(false);
    setTemplateName('');
    setTemplateDesc('');
  },
  onError: () => {
    toast({ title: "Erro ao salvar template", variant: "destructive" });
  },
});
```

**Step 4: Testar fluxo completo**

1. Preencher formulário com 2 itens de serviço
2. Clicar "Salvar como Template"
3. Dar nome e salvar
4. Ir em Serviços → Templates → confirmar que aparece
5. Voltar em Novo Contrato → template deve aparecer no seletor

**Step 5: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "feat(contratos): add 'save as template' from new contract form"
```

---

### Task 10: Frontend — Duplicar contrato

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (ContratosTab + ContratosModule)

**Step 1: Adicionar botão "Duplicar" nas ações da tabela (ContratosTab)**

Na coluna de ações de cada linha (próximo aos botões Ver, Editar, Deletar, ~linha 1940):

```tsx
<Button
  size="icon"
  variant="ghost"
  title="Duplicar contrato"
  onClick={(e) => {
    e.stopPropagation();
    handleDuplicate(contrato);
  }}
>
  <Copy className="h-4 w-4" />
</Button>
```

Adicionar import de `Copy` do lucide-react.

**Step 2: Implementar handleDuplicate**

```typescript
const handleDuplicate = async (contrato: ContratoDoc) => {
  // Buscar contrato completo com itens
  try {
    const res = await fetch(`/api/contratos/contratos/${contrato.id}`);
    const data = await res.json();
    const full = data.contrato as ContratoDoc;
    const fullItens = (data.itens || full.itens || []) as ContratoItem[];

    onDuplicate?.({
      formData: {
        cliente_id: full.cliente_id,
        comercial_nome: full.comercial_nome || '',
        comercial_email: full.comercial_email || '',
        id_crm: full.id_crm || '',
        observacoes: full.observacoes || '',
      },
      itens: fullItens,
      source: 'duplicate' as const,
    });
  } catch {
    toast({ title: "Erro ao duplicar contrato", variant: "destructive" });
  }
};
```

**Step 3: Adicionar prop onDuplicate no ContratosTab**

Alterar assinatura:

```typescript
function ContratosTab({ onDuplicate }: { onDuplicate?: (data: NovoContratoTabProps['initialData']) => void })
```

**Step 4: Conectar no ContratosModule principal**

Passar callback que seta initialData e troca para aba "novo":

```tsx
<TabsContent value="contratos">
  <ContratosTab
    onDuplicate={(data) => {
      setNovoContratoInitialData(data);
      setActiveTab("novo");
    }}
  />
</TabsContent>
```

**Step 5: Adicionar botão "Duplicar" também no dialog de visualização**

No dialog de detalhe do contrato (~linha 2004), junto aos botões "Gerar PDF" e "Enviar para Assinatura":

```tsx
<Button variant="outline" size="sm" onClick={() => { handleDuplicate(selectedContrato!); setViewDialogOpen(false); }}>
  <Copy className="mr-2 h-4 w-4" />
  Duplicar
</Button>
```

**Step 6: Testar fluxo de duplicação**

1. Na lista de contratos, clicar "Duplicar" em um contrato existente
2. Deve abrir aba "Novo Contrato" com dados pré-preenchidos
3. Número deve ser novo (automático), status "rascunho", datas em branco
4. Cliente, serviços, valores, pagamento copiados
5. Criar o contrato duplicado com sucesso

**Step 7: Commit**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "feat(contratos): add duplicate contract from list and detail view"
```

---

### Task 11: Verificação final e limpeza

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (se necessário)

**Step 1: Verificar dark mode**

Navegar por todas as abas em dark mode. Garantir que não há:
- Gradientes residuais
- Cores hardcoded sem variante `dark:`
- Cards com background que some no dark mode

**Step 2: Verificar light mode**

Mesma verificação em light mode.

**Step 3: Testar fluxo completo**

1. Dashboard → 4 KPIs simples, sem excesso visual
2. Entidades → sem stat cards, barra de busca limpa
3. Contratos → sem stat cards, tabela com ação "Duplicar"
4. Novo Contrato → seletor de template → formulário → "Salvar como template"
5. Serviços → lista de serviços + seção de templates no final
6. Duplicar contrato da lista → formulário pré-preenchido
7. Criar contrato via template → formulário pré-preenchido

**Step 4: Commit final**

```bash
git add client/src/pages/ContratosModule.tsx
git commit -m "chore(contratos): final cleanup and dark/light mode verification"
```

**Step 5: Atualizar DATABASE_DOCUMENTATION.md**

Adicionar documentação da nova tabela `staging.contrato_templates`.
