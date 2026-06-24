# Credential Access Approval via WhatsApp - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Block credential passwords for non-admin users, requiring WhatsApp approval before viewing.

**Architecture:** New table `cortex_core.credential_access_requests` tracks requests. Backend sends WhatsApp messages with approve/reject links (token-based, no auth required). Frontend polls for approval status. Approved credentials stay unlocked for the session.

**Tech Stack:** Express routes, PostgreSQL, Evolution API (text messages with links), React Query polling, useAuth context.

---

### Task 1: Create database table and migration

**Files:**
- Create: `migrations/credential-access-requests.sql`
- Modify: `server/routes/acessos.ts` (add auto-create table on startup)

**Step 1: Write migration SQL file**

```sql
-- migrations/credential-access-requests.sql
CREATE TABLE IF NOT EXISTS cortex_core.credential_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  client_id UUID NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  credential_id UUID NOT NULL,
  platform VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  approved_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_car_token ON cortex_core.credential_access_requests(token);
CREATE INDEX IF NOT EXISTS idx_car_user_status ON cortex_core.credential_access_requests(user_email, status);
CREATE INDEX IF NOT EXISTS idx_car_credential ON cortex_core.credential_access_requests(credential_id, status);
```

**Step 2: Add auto-create in `registerAcessosRoutes`**

In `server/routes/acessos.ts`, at the top of `registerAcessosRoutes` (after the existing ALTER TABLE), add:

```typescript
try {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cortex_core.credential_access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token VARCHAR(64) NOT NULL UNIQUE,
      user_email VARCHAR(255) NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      client_id UUID NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      credential_id UUID NOT NULL,
      platform VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      approved_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_car_token ON cortex_core.credential_access_requests(token)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_car_user_status ON cortex_core.credential_access_requests(user_email, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_car_credential ON cortex_core.credential_access_requests(credential_id, status)`);
} catch (e) {}
```

**Step 3: Commit**

```bash
git add migrations/credential-access-requests.sql server/routes/acessos.ts
git commit -m "feat(acessos): add credential_access_requests table"
```

---

### Task 2: Backend - Add approval constants and helper functions

**Files:**
- Modify: `server/routes/acessos.ts`

**Step 1: Add imports and constants at the top of the file**

Add after the existing imports:

```typescript
import { randomBytes } from "crypto";
import { enviarMensagemWhatsApp } from "../services/turbozap";

// Emails that can see passwords without approval
const CREDENTIAL_BYPASS_EMAILS = [
  "caio.massaroni@turbopartners.com.br",
  "warley.silva@turbopartners.com.br",
  "breno.carmo@turbopartners.com.br",
];

// WhatsApp numbers that receive approval requests
const CREDENTIAL_APPROVER_NUMBERS = [
  "557199993135",   // Breno Carmo
  "5527997823958",  // Warley
];
```

**Step 2: Add helper function to check if user can bypass approval**

```typescript
function canBypassCredentialApproval(user: any): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return CREDENTIAL_BYPASS_EMAILS.includes(user.email?.toLowerCase());
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}
```

**Step 3: Commit**

```bash
git add server/routes/acessos.ts
git commit -m "feat(acessos): add credential approval constants and helpers"
```

---

### Task 3: Backend - POST /api/acessos/request-access endpoint

**Files:**
- Modify: `server/routes/acessos.ts`

**Step 1: Add the request-access endpoint inside `registerAcessosRoutes`**

Add this route (after the credentials CRUD routes, before the closing `}`):

```typescript
// === Credential Access Approval ===

app.post("/api/acessos/request-access", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    // Admins/bypass users don't need approval
    if (canBypassCredentialApproval(user)) {
      return res.json({ status: "approved", bypass: true });
    }

    const { credentialId, clientId, clientName, platform } = req.body;
    if (!credentialId || !clientId || !clientName || !platform) {
      return res.status(400).json({ error: "credentialId, clientId, clientName, and platform are required" });
    }

    // Check if there's already a pending request for this user + credential
    const existing = await db.execute(sql`
      SELECT id, status FROM cortex_core.credential_access_requests
      WHERE user_email = ${user.email}
        AND credential_id::text = ${credentialId}
        AND status = 'pendente'
        AND created_at > NOW() - INTERVAL '1 hour'
      LIMIT 1
    `);

    if (existing.rows.length > 0) {
      return res.json({ status: "pending", requestId: (existing.rows[0] as any).id });
    }

    const token = generateToken();
    const result = await db.execute(sql`
      INSERT INTO cortex_core.credential_access_requests
        (token, user_email, user_name, client_id, client_name, credential_id, platform, status)
      VALUES (${token}, ${user.email}, ${user.name}, ${clientId}::uuid, ${clientName}, ${credentialId}::uuid, ${platform}, 'pendente')
      RETURNING id
    `);

    const requestId = (result.rows[0] as any).id;
    const appUrl = process.env.APP_URL || "https://cortex.turbopartners.com.br";

    const mensagem = [
      `🔐 *Solicitação de Acesso a Credencial*`,
      ``,
      `*Solicitante:* ${user.name} (${user.email})`,
      `*Cliente:* ${clientName}`,
      `*Plataforma:* ${platform}`,
      `*Data:* ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      ``,
      `✅ *Aprovar:* ${appUrl}/api/acessos/approve/${token}`,
      `❌ *Reprovar:* ${appUrl}/api/acessos/reject/${token}`,
    ].join("\n");

    // Send to all approver numbers
    for (const numero of CREDENTIAL_APPROVER_NUMBERS) {
      try {
        await enviarMensagemWhatsApp(numero, mensagem, "financeiro");
      } catch (err) {
        console.error(`[acessos] WhatsApp error for ${numero}:`, err);
      }
    }

    res.json({ status: "pending", requestId });
  } catch (error) {
    console.error("[acessos] Error requesting access:", error);
    res.status(500).json({ error: "Failed to request access" });
  }
});
```

**Step 2: Commit**

```bash
git add server/routes/acessos.ts
git commit -m "feat(acessos): add POST /api/acessos/request-access endpoint"
```

---

### Task 4: Backend - Approve/reject endpoints (public, token-based)

**Files:**
- Modify: `server/routes.ts` (register public routes before auth middleware)
- Modify: `server/routes/acessos.ts` (export a function for public routes)

**Step 1: Add public approval routes function in `acessos.ts`**

Export a new function at the end of the file (outside `registerAcessosRoutes`):

```typescript
export function registerAcessosPublicRoutes(app: Express) {
  // These routes are token-based and don't require authentication

  app.get("/api/acessos/approve/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const result = await pool.query(
        `UPDATE cortex_core.credential_access_requests
         SET status = 'aprovado', approved_by = 'link', updated_at = NOW()
         WHERE token = $1 AND status = 'pendente'
         RETURNING id, user_name, client_name, platform`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
            <h2>⚠️ Solicitação não encontrada ou já processada</h2>
            <p>Esta solicitação já foi aprovada/reprovada ou expirou.</p>
          </body></html>
        `);
      }

      const row = result.rows[0];
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2>✅ Acesso Aprovado!</h2>
          <p><strong>${row.user_name}</strong> agora pode ver as credenciais de <strong>${row.platform}</strong> do cliente <strong>${row.client_name}</strong>.</p>
          <p style="color:#888;margin-top:20px;">Você pode fechar esta página.</p>
        </body></html>
      `);
    } catch (error) {
      console.error("[acessos] Error approving:", error);
      res.status(500).send("Erro ao processar aprovação");
    }
  });

  app.get("/api/acessos/reject/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const result = await pool.query(
        `UPDATE cortex_core.credential_access_requests
         SET status = 'reprovado', approved_by = 'link', updated_at = NOW()
         WHERE token = $1 AND status = 'pendente'
         RETURNING id, user_name, client_name, platform`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.send(`
          <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
            <h2>⚠️ Solicitação não encontrada ou já processada</h2>
            <p>Esta solicitação já foi aprovada/reprovada ou expirou.</p>
          </body></html>
        `);
      }

      const row = result.rows[0];
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2>❌ Acesso Reprovado</h2>
          <p>O acesso de <strong>${row.user_name}</strong> às credenciais de <strong>${row.platform}</strong> do cliente <strong>${row.client_name}</strong> foi negado.</p>
          <p style="color:#888;margin-top:20px;">Você pode fechar esta página.</p>
        </body></html>
      `);
    } catch (error) {
      console.error("[acessos] Error rejecting:", error);
      res.status(500).send("Erro ao processar reprovação");
    }
  });
}
```

**Step 2: Register public routes in `routes.ts` before auth middleware**

In `server/routes.ts`, add import and registration before line 432 (`app.use("/api", isAuthenticated)`):

```typescript
import { registerAcessosPublicRoutes } from "./routes/acessos";

// ... before app.use("/api", isAuthenticated):
registerAcessosPublicRoutes(app);
```

**Step 3: Commit**

```bash
git add server/routes/acessos.ts server/routes.ts
git commit -m "feat(acessos): add public approve/reject endpoints with token auth"
```

---

### Task 5: Backend - GET /api/acessos/check-access endpoint

**Files:**
- Modify: `server/routes/acessos.ts`

**Step 1: Add the check-access endpoint inside `registerAcessosRoutes`**

```typescript
app.get("/api/acessos/check-access", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    if (canBypassCredentialApproval(user)) {
      return res.json({ bypass: true, approved: [] });
    }

    // Return all approved credential IDs for this user (from the last 24h or current session)
    const result = await db.execute(sql`
      SELECT credential_id::text FROM cortex_core.credential_access_requests
      WHERE user_email = ${user.email}
        AND status = 'aprovado'
        AND updated_at > NOW() - INTERVAL '24 hours'
    `);

    const approved = result.rows.map((r: any) => r.credential_id);

    // Also check pending requests
    const pending = await db.execute(sql`
      SELECT credential_id::text FROM cortex_core.credential_access_requests
      WHERE user_email = ${user.email}
        AND status = 'pendente'
        AND created_at > NOW() - INTERVAL '1 hour'
    `);

    const pendingIds = pending.rows.map((r: any) => r.credential_id);

    // Check rejected
    const rejected = await db.execute(sql`
      SELECT credential_id::text FROM cortex_core.credential_access_requests
      WHERE user_email = ${user.email}
        AND status = 'reprovado'
        AND updated_at > NOW() - INTERVAL '5 minutes'
    `);

    const rejectedIds = rejected.rows.map((r: any) => r.credential_id);

    res.json({ bypass: false, approved, pending: pendingIds, rejected: rejectedIds });
  } catch (error) {
    console.error("[acessos] Error checking access:", error);
    res.status(500).json({ error: "Failed to check access" });
  }
});
```

**Step 2: Add the can-bypass check endpoint (for frontend to know user role)**

```typescript
app.get("/api/acessos/can-bypass", async (req, res) => {
  try {
    const user = req.user as any;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json({ canBypass: canBypassCredentialApproval(user) });
  } catch (error) {
    res.status(500).json({ error: "Failed to check bypass" });
  }
});
```

**Step 3: Commit**

```bash
git add server/routes/acessos.ts
git commit -m "feat(acessos): add check-access and can-bypass endpoints"
```

---

### Task 6: Frontend - Add credential approval hooks and state

**Files:**
- Modify: `client/src/pages/Acessos.tsx`

**Step 1: Add imports and hooks for credential access approval**

At the top of Acessos.tsx, add import for useAuth:

```typescript
import { useAuth } from "@/contexts/AuthContext";
```

**Step 2: Add custom hooks for credential access**

After the existing hook definitions in Acessos.tsx, add:

```typescript
function useCanBypass() {
  return useQuery<{ canBypass: boolean }>({
    queryKey: ["/api/acessos/can-bypass"],
    staleTime: 5 * 60 * 1000,
  });
}

function useCheckAccess(enabled: boolean) {
  return useQuery<{
    bypass: boolean;
    approved: string[];
    pending: string[];
    rejected: string[];
  }>({
    queryKey: ["/api/acessos/check-access"],
    refetchInterval: enabled ? 5000 : false, // Poll every 5s when there are pending requests
    staleTime: 2000,
  });
}

function useRequestAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      credentialId: string;
      clientId: string;
      clientName: string;
      platform: string;
    }) => {
      const res = await fetch("/api/acessos/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to request access");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/acessos/check-access"] });
    },
  });
}
```

Also add `useQueryClient` to the react-query import:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```

**Step 3: Commit**

```bash
git add client/src/pages/Acessos.tsx
git commit -m "feat(acessos): add credential access approval hooks"
```

---

### Task 7: Frontend - Modify CredentialRow to enforce approval

**Files:**
- Modify: `client/src/pages/Acessos.tsx`

**Step 1: Update CredentialRow component props**

Add new props to CredentialRow:

```typescript
function CredentialRow({
  credential,
  clientId,
  clientName,
  onEdit,
  onDelete,
  canBypass,
  isApproved,
  isPending,
  onRequestAccess,
}: {
  credential: Credential;
  clientId: string;
  clientName: string;
  onEdit: () => void;
  onDelete: () => void;
  canBypass: boolean;
  isApproved: boolean;
  isPending: boolean;
  onRequestAccess: () => void;
}) {
```

**Step 2: Modify handleTogglePassword**

Replace the existing `handleTogglePassword` with:

```typescript
const handleTogglePassword = () => {
  if (!showPassword) {
    // If user needs approval and doesn't have it
    if (!canBypass && !isApproved) {
      onRequestAccess();
      return;
    }
    createLog.mutate({
      action: "view_password",
      entityType: "credential",
      entityId: credential.id,
      entityName: credential.platform,
      clientId,
      clientName,
    });
  }
  setShowPassword(!showPassword);
};
```

**Step 3: Modify the password display and copy button**

Update the password cell to show lock status:

```typescript
<TableCell>
  <div className="flex items-center gap-2">
    <span className="font-mono text-sm">
      {showPassword && (canBypass || isApproved) ? credential.password : "••••••••"}
    </span>
    {isPending ? (
      <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Aguardando
      </Badge>
    ) : (
      <Button
        size="icon"
        variant="ghost"
        onClick={handleTogglePassword}
        data-testid={`button-toggle-password-${credential.id}`}
      >
        {!canBypass && !isApproved ? (
          <Lock className="w-4 h-4 text-yellow-500" />
        ) : showPassword ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </Button>
    )}
    {credential.password && (canBypass || isApproved) && (
      <Button
        size="icon"
        variant="ghost"
        onClick={() => copyToClipboard(credential.password || "")}
        data-testid={`button-copy-password-${credential.id}`}
      >
        <Copy className="w-4 h-4" />
      </Button>
    )}
  </div>
</TableCell>
```

**Step 4: Commit**

```bash
git add client/src/pages/Acessos.tsx
git commit -m "feat(acessos): enforce approval in CredentialRow component"
```

---

### Task 8: Frontend - Wire up approval state in parent components

**Files:**
- Modify: `client/src/pages/Acessos.tsx`

**Step 1: Find where CredentialRow is rendered and add approval state**

In the parent component that renders CredentialRow (likely the expanded client view), add the hooks and pass props down. The parent needs:

```typescript
const { data: canBypassData } = useCanBypass();
const canBypass = canBypassData?.canBypass ?? false;

const [hasPendingRequests, setHasPendingRequests] = useState(false);
const { data: accessData } = useCheckAccess(hasPendingRequests);

const requestAccess = useRequestAccess();
const { toast } = useToast();

// Track approved credential IDs in session state
const [sessionApproved, setSessionApproved] = useState<Set<string>>(new Set());

// Update session approved when server data changes
useEffect(() => {
  if (accessData?.approved) {
    setSessionApproved(prev => {
      const next = new Set(prev);
      accessData.approved.forEach(id => next.add(id));
      return next;
    });
  }
  if (accessData?.rejected) {
    for (const id of accessData.rejected) {
      toast({ title: "Solicitação reprovada", description: "O acesso à credencial foi negado.", variant: "destructive" });
    }
  }
  setHasPendingRequests((accessData?.pending?.length ?? 0) > 0);
}, [accessData]);
```

**Step 2: Update CredentialRow usage**

Where CredentialRow is rendered, pass the new props:

```typescript
<CredentialRow
  key={credential.id}
  credential={credential}
  clientId={clientId}
  clientName={clientName}
  onEdit={() => ...}
  onDelete={() => ...}
  canBypass={canBypass}
  isApproved={sessionApproved.has(credential.id)}
  isPending={accessData?.pending?.includes(credential.id) ?? false}
  onRequestAccess={() => {
    requestAccess.mutate({
      credentialId: credential.id,
      clientId,
      clientName,
      platform: credential.platform,
    }, {
      onSuccess: (data) => {
        if (data.status === "approved" && data.bypass) {
          // User can bypass, refresh
          setSessionApproved(prev => new Set(prev).add(credential.id));
        } else {
          toast({
            title: "Solicitação enviada",
            description: "Aguarde aprovação via WhatsApp. Você será notificado.",
          });
        }
      },
    });
  }}
/>
```

**Step 3: Commit**

```bash
git add client/src/pages/Acessos.tsx
git commit -m "feat(acessos): wire up approval state in credential list"
```

---

### Task 9: Backend - Mask passwords in GET credentials for non-bypass users

**Files:**
- Modify: `server/routes/acessos.ts`

**Step 1: Modify GET /api/acessos/credentials/:clientId**

Update the existing endpoint to mask passwords for non-bypass users:

```typescript
app.get("/api/acessos/credentials/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const user = req.user as any;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return res.status(400).json({ error: "Invalid client ID format" });
    }

    const result = await db.execute(sql`
      SELECT * FROM cortex_core.credentials WHERE client_id::text = ${clientId} ORDER BY platform
    `);

    const bypass = canBypassCredentialApproval(user);

    if (bypass) {
      return res.json(result.rows.map(mapCredential));
    }

    // Get approved credential IDs for this user
    const approved = await db.execute(sql`
      SELECT credential_id::text FROM cortex_core.credential_access_requests
      WHERE user_email = ${user.email}
        AND status = 'aprovado'
        AND updated_at > NOW() - INTERVAL '24 hours'
    `);
    const approvedIds = new Set(approved.rows.map((r: any) => r.credential_id));

    const masked = result.rows.map((row: any) => {
      const cred = mapCredential(row);
      if (!approvedIds.has(cred.id)) {
        return { ...cred, password: "••••••••" };
      }
      return cred;
    });

    res.json(masked);
  } catch (error) {
    console.error("[api] Error fetching credentials:", error);
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});
```

**Step 2: Also mask in GET /api/acessos/clients/:id (which includes credentials)**

Apply the same masking logic to the credentials array in the client detail endpoint.

**Step 3: Commit**

```bash
git add server/routes/acessos.ts
git commit -m "feat(acessos): mask passwords for non-bypass users in API responses"
```

---

### Task 10: Test end-to-end and verify

**Step 1: Restart dev server**

```bash
lsof -ti:3000 | xargs kill -9; npm run dev
```

**Step 2: Test as admin user**
- Navigate to /acessos
- Expand a client with credentials
- Verify passwords are visible normally (eye icon works without approval)

**Step 3: Test as non-admin user (or simulate)**
- Click eye icon on a credential
- Verify toast "Solicitação enviada, aguarde aprovação"
- Verify WhatsApp message received at configured numbers
- Click the approve link in WhatsApp message
- Verify the credential becomes visible after polling detects approval

**Step 4: Test reject flow**
- Request access to another credential
- Click the reject link
- Verify toast "Solicitação reprovada"

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(acessos): credential approval flow adjustments"
```
