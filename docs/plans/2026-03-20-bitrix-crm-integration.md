# Integração Bitrix CRM no ContratosModule

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ao preencher ID CRM, buscar nome do deal no Bitrix para verificação. Ao contrato ficar assinado, mover deal para "Negócio Ganho" via API.

**Architecture:** Lookup local via `"Bitrix".crm_deal` + chamada REST API do Bitrix24 para mover deal. Nova env var `BITRIX_WEBHOOK_URL`.

**Tech Stack:** Express, drizzle-orm, fetch (Bitrix REST API), React (frontend)

---

### Task 1: Configurar variável de ambiente do Bitrix

**Files:**
- Modify: `.env`

**Step 1: Adicionar env var**

Adicionar ao `.env`:
```
BITRIX_WEBHOOK_URL=https://turbopartners.bitrix24.com.br/rest/54/6q90e9yya81ll2qg
```

**Step 2: Commit**

```bash
git add -f .env
```

Nota: NÃO commitar o .env — apenas configurar localmente.

---

### Task 2: Backend — Endpoint de lookup do deal por ID

**Files:**
- Modify: `server/routes/contratos.ts`

**Step 1: Adicionar endpoint GET /api/contratos/bitrix-deal/:dealId**

Inserir após os endpoints de templates:

```typescript
app.get("/api/contratos/bitrix-deal/:dealId", isAuthenticated, async (req, res) => {
  try {
    const { dealId } = req.params;
    const result = await db.execute(
      sql`SELECT id, title, company_name, contact_name, stage_name, category_name,
                 valor_recorrente, valor_pontual
          FROM "Bitrix".crm_deal
          WHERE id = ${parseInt(dealId)}`
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Deal não encontrado no CRM" });
    }
    res.json({ deal: result.rows[0] });
  } catch (error: any) {
    console.error("Error fetching Bitrix deal:", error);
    res.status(500).json({ message: error.message });
  }
});
```

**Step 2: Commit**

---

### Task 3: Backend — Endpoint para mover deal para Negócio Ganho

**Files:**
- Modify: `server/routes/contratos.ts`

**Step 1: Adicionar endpoint POST /api/contratos/bitrix-deal/:dealId/won**

```typescript
app.post("/api/contratos/bitrix-deal/:dealId/won", isAuthenticated, async (req, res) => {
  try {
    const { dealId } = req.params;
    const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ message: "BITRIX_WEBHOOK_URL não configurada" });
    }

    // Buscar stage_id de "Negócio Ganho" — no Bitrix, o stage WON depende do pipeline
    // Primeiro, buscar o category_id do deal
    const dealResult = await db.execute(
      sql`SELECT id, category_id, stage_name FROM "Bitrix".crm_deal WHERE id = ${parseInt(dealId)}`
    );
    if (dealResult.rows.length === 0) {
      return res.status(404).json({ message: "Deal não encontrado" });
    }

    // Chamar API do Bitrix para mover deal
    const response = await fetch(`${webhookUrl}/crm.deal.update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: parseInt(dealId),
        fields: {
          STAGE_ID: 'WON',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Bitrix API error:", errorText);
      return res.status(502).json({ message: "Erro ao atualizar deal no Bitrix" });
    }

    const bitrixResponse = await response.json();
    if (!bitrixResponse.result) {
      return res.status(502).json({ message: "Bitrix retornou erro", details: bitrixResponse });
    }

    // Atualizar o registro local também
    await db.execute(
      sql`UPDATE "Bitrix".crm_deal
          SET stage_name = 'Negócio Ganho', date_modify = NOW()
          WHERE id = ${parseInt(dealId)}`
    );

    res.json({ success: true, message: "Deal movido para Negócio Ganho" });
  } catch (error: any) {
    console.error("Error updating Bitrix deal:", error);
    res.status(500).json({ message: error.message });
  }
});
```

**Step 2: Commit**

---

### Task 4: Backend — Auto-mover deal ao assinar contrato

**Files:**
- Modify: `server/routes/contratos.ts`

**Step 1: No webhook handler do Assinafy (onde status muda para "assinado"), adicionar chamada automática**

Encontrar o handler que processa assinatura (webhook Assinafy ou endpoint que muda status para "assinado") e adicionar lógica:

```typescript
// Após confirmar que o contrato foi assinado:
// Buscar id_crm do contrato
const contratoResult = await db.execute(
  sql`SELECT id_crm FROM staging.contratos WHERE id = ${contratoId}`
);
const idCrm = contratoResult.rows[0]?.id_crm;

if (idCrm) {
  // Mover deal no Bitrix
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(`${webhookUrl}/crm.deal.update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parseInt(idCrm),
          fields: { STAGE_ID: 'WON' },
        }),
      });
      // Atualizar local
      await db.execute(
        sql`UPDATE "Bitrix".crm_deal SET stage_name = 'Negócio Ganho', date_modify = NOW() WHERE id = ${parseInt(idCrm)}`
      );
      console.log(`[Bitrix] Deal ${idCrm} movido para Negócio Ganho (contrato ${contratoId} assinado)`);
    } catch (err) {
      console.error(`[Bitrix] Erro ao mover deal ${idCrm}:`, err);
    }
  }
}
```

**Step 2: Commit**

---

### Task 5: Frontend — Lookup do deal ao preencher ID CRM

**Files:**
- Modify: `client/src/pages/ContratosModule.tsx` (NovoContratoTab + ContratoFormDialog)

**Step 1: No NovoContratoTab, adicionar debounced lookup quando id_crm muda**

Após o campo id_crm no formulário, mostrar info do deal:

```tsx
// Estado
const [dealInfo, setDealInfo] = useState<{ title: string; company_name: string; contact_name: string } | null>(null);
const [dealLoading, setDealLoading] = useState(false);
const [dealError, setDealError] = useState('');

// Efeito com debounce
useEffect(() => {
  if (!formData.id_crm || formData.id_crm.length < 1) {
    setDealInfo(null);
    setDealError('');
    return;
  }
  const timer = setTimeout(async () => {
    setDealLoading(true);
    setDealError('');
    try {
      const res = await fetch(`/api/contratos/bitrix-deal/${formData.id_crm}`);
      if (!res.ok) {
        setDealInfo(null);
        setDealError('Deal não encontrado no CRM');
        return;
      }
      const data = await res.json();
      setDealInfo(data.deal);
    } catch {
      setDealError('Erro ao buscar deal');
    } finally {
      setDealLoading(false);
    }
  }, 500);
  return () => clearTimeout(timer);
}, [formData.id_crm]);
```

**Step 2: Mostrar card de verificação abaixo do campo ID CRM**

```tsx
{dealLoading && <p className="text-xs text-muted-foreground">Buscando no CRM...</p>}
{dealError && <p className="text-xs text-destructive">{dealError}</p>}
{dealInfo && (
  <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/20 space-y-1">
    <p className="text-sm font-medium">{dealInfo.title}</p>
    {dealInfo.company_name && <p className="text-xs text-muted-foreground">Empresa: {dealInfo.company_name}</p>}
    {dealInfo.contact_name && <p className="text-xs text-muted-foreground">Contato: {dealInfo.contact_name}</p>}
  </div>
)}
```

**Step 3: Aplicar a mesma lógica no ContratoFormDialog (edição)**

**Step 4: Commit**

---

### Task 6: Verificação final

**Step 1:** Testar lookup: preencher ID CRM com um deal existente → deve mostrar nome
**Step 2:** Testar com ID inexistente → deve mostrar erro
**Step 3:** Testar auto-move: simular contrato assinado com id_crm preenchido → verificar no Bitrix
**Step 4:** Commit final
