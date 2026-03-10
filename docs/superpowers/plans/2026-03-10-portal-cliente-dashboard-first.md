# Portal do Cliente — Dashboard-First Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o Portal do Cliente de um monolito de 1600 linhas em componentes modulares com um Dashboard como tela principal, otimizado para PMEs.

**Architecture:** Extrair componentes do monolito `PortalCliente.tsx` para `client/src/components/portal/`. Criar endpoint backend `/api/portal-cliente/dashboard` que consolida KPIs. O orquestrador `PortalCliente.tsx` fica com ~200 linhas gerenciando auth, header e navegação entre módulos.

**Tech Stack:** React + TypeScript, Tailwind CSS (dark/light), React Query, Lucide icons, Recharts (Performance existente)

**Spec:** `docs/superpowers/specs/2026-03-10-portal-cliente-dashboard-first-design.md`

---

## File Structure

### Files to Create
| File | Responsibility |
|------|---------------|
| `client/src/components/portal/StatusBadge.tsx` | Badge de status reutilizável (Pago/Pendente/Atrasado) com dark/light |
| `client/src/components/portal/CancelamentoModal.tsx` | Modal de cancelamento self-service extraído |
| `client/src/components/portal/PortalChat.tsx` | Chat unificado (variant: page/floating), elimina duplicação |
| `client/src/components/portal/PortalFinanceiro.tsx` | Módulo financeiro: faturas com filtro, sem dados cadastrais |
| `client/src/components/portal/PortalServicos.tsx` | Módulo serviços: lista + botão cancelar |
| `client/src/components/portal/PortalPerfil.tsx` | Módulo perfil: dados cadastrais, email/tel, senha, tema |
| `client/src/components/portal/PortalDashboard.tsx` | Dashboard home: KPIs, alertas, ações rápidas, últimas faturas |

### Files to Modify
| File | Changes |
|------|---------|
| `client/src/pages/PortalCliente.tsx` | Reescrever como orquestrador (~200 linhas): auth, header, nav, lazy load |
| `server/auth/routes.ts` | Adicionar endpoint `GET /api/portal-cliente/dashboard` |

### Files Unchanged
| File | Notes |
|------|-------|
| `client/src/pages/PortalPerformance.tsx` | Mantém como está, já usa lazy loading |
| `client/src/pages/LoginCliente.tsx` | Sem alterações |
| `client/src/contexts/ClientAuthContext.tsx` | Sem alterações |

---

## Chunk 1: Componentes Base (StatusBadge + CancelamentoModal)

### Task 1: Criar StatusBadge com suporte dark/light

**Files:**
- Create: `client/src/components/portal/StatusBadge.tsx`

- [ ] **Step 1: Criar diretório portal**

```bash
mkdir -p client/src/components/portal
```

- [ ] **Step 2: Criar StatusBadge.tsx**

Extrair o componente `StatusBadge` de `PortalCliente.tsx:69-93` e refatorar para suportar dark/light mode usando `useTheme`.

```tsx
// client/src/components/portal/StatusBadge.tsx
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function StatusBadge({ status }: { status: string | null }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const s = (status ?? '').toUpperCase();

  if (s === 'RECEBIDO' || s === 'PAGO' || s === 'QUITADO') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
        isDark
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
      }`}>
        <CheckCircle2 className="w-3 h-3" />
        Pago
      </span>
    );
  }

  if (s === 'ATRASADO' || s === 'VENCIDO') {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
        isDark
          ? 'bg-red-500/10 text-red-400 border-red-500/20'
          : 'bg-red-50 text-red-600 border-red-200'
      }`}>
        <AlertCircle className="w-3 h-3" />
        Atrasado
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      isDark
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        : 'bg-amber-50 text-amber-600 border-amber-200'
    }`}>
      <Clock className="w-3 h-3" />
      {status ?? 'Pendente'}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/portal/StatusBadge.tsx
git commit -m "feat(portal): extract StatusBadge with dark/light support"
```

---

### Task 2: Extrair CancelamentoModal

**Files:**
- Create: `client/src/components/portal/CancelamentoModal.tsx`

- [ ] **Step 1: Criar CancelamentoModal.tsx**

Extrair de `PortalCliente.tsx:543-829` — contém as constantes `MOTIVOS_CANCELAMENTO`, `PONTOS_MELHORIA`, `PROXIMO_PASSO_OPCOES`, `RETORNO_OPCOES`, `URGENCIAS_CANCELAMENTO`, `NOTAS_CONFIG`, os sub-componentes `CheckRow` e `RadioRow`, e o componente `CancelamentoModal`.

Mover o conteúdo inteiro (linhas 543-829) para o novo arquivo. Adicionar os imports necessários:

```tsx
// Top of file
import { useState } from "react";
import type React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, AlertCircle, CheckCircle2, X } from "lucide-react";
```

Exportar: `export function CancelamentoModal(...)` e o type `Servico`:

```tsx
export interface Servico {
  produto: string | null;
  status: string | null;
  responsavel: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/portal/CancelamentoModal.tsx
git commit -m "feat(portal): extract CancelamentoModal to separate component"
```

---

## Chunk 2: Chat Unificado

### Task 3: Criar PortalChat unificado

**Files:**
- Create: `client/src/components/portal/PortalChat.tsx`

- [ ] **Step 1: Criar PortalChat.tsx**

Unificar `ChatModuloCliente` (linhas 230-391) e `ChatFlutuante` (linhas 393-541) num único componente com prop `variant`.

Também incluir: `EncerramentoBanner`, `AvaliacaoWidget`, `AvaliacaoRespondida`, `parseSystemMsg`, `formatTime`, `formatDayLabel`.

```tsx
// client/src/components/portal/PortalChat.tsx
import { useState, useRef, useEffect } from "react";
import type React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send, User, Check, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

// Interfaces, helpers, sub-components...

interface PortalChatProps {
  clientId: number;
  variant: 'page' | 'floating';
  onClose?: () => void; // required when variant='floating'
  onUnreadCountChange?: (count: number) => void;
}

export function PortalChat({ clientId, variant, onClose, onUnreadCountChange }: PortalChatProps) {
  // ... unified implementation using variant to control layout/sizing
}
```

**Diferenças por variant:**
- `page`: `height: 520px`, bordas `rounded-2xl`, header completo
- `floating`: `fixed bottom-24 right-5 w-80`, `height: 420px`, botão close no header

**Unread count:** Calcular mensagens não lidas (`remetenteTipo === 'colaborador' && !lida`) e chamar `onUnreadCountChange` no effect.

- [ ] **Step 2: Verificar que todos os sub-componentes estão incluídos**

Confirmar presença de: `parseSystemMsg`, `EncerramentoBanner`, `AvaliacaoWidget`, `AvaliacaoRespondida`, `formatTime`, `formatDayLabel`, `ChatData`, `ChatMensagem`, `SystemMsg`.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/portal/PortalChat.tsx
git commit -m "feat(portal): unify chat components into PortalChat with variant prop"
```

---

## Chunk 3: Módulos Extraídos (Financeiro + Serviços + Perfil)

### Task 4: Criar PortalFinanceiro

**Files:**
- Create: `client/src/components/portal/PortalFinanceiro.tsx`

- [ ] **Step 1: Criar PortalFinanceiro.tsx**

Extrair o bloco `{activeModule === 'financeiro' && ...}` de `PortalCliente.tsx:1180-1485`. Recebe `resumo`, `isResumoLoading` como props.

**Melhorias a incluir:**
1. Filtro por status no topo da tabela: `Todas | Pendentes | Pagas | Atrasadas`
2. Mobile responsivo: em `sm:` e abaixo, usar cards empilhados em vez de grid
3. Banner de alerta no topo quando há faturas atrasadas
4. Remover seção de dados cadastrais (vai para Perfil)

```tsx
// client/src/components/portal/PortalFinanceiro.tsx
import { useState } from "react";
import { Receipt, TrendingUp, AlertCircle, ExternalLink } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { StatusBadge } from "./StatusBadge";

interface Fatura {
  id: string | number;
  status: string | null;
  valorBruto: string | null;
  valorPago: string | null;
  descricao: string | null;
  dataVencimento: string | null;
  dataQuitacao: string | null;
  naoPago: string | null;
  categoriaNome: string | null;
  tipoEvento: string | null;
  urlCobranca: string | null;
}

interface ResumoFinanceiro {
  faturas: Fatura[];
  totais: { total: number; pago: number; naoPago: number };
}

interface Props {
  resumo: ResumoFinanceiro | undefined;
  isLoading: boolean;
}

export function PortalFinanceiro({ resumo, isLoading }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'pagas' | 'atrasadas'>('todas');

  // Filter faturas based on selected status
  // ... render KPI cards + filtered table with mobile cards
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/portal/PortalFinanceiro.tsx
git commit -m "feat(portal): extract PortalFinanceiro with status filter and mobile cards"
```

---

### Task 5: Criar PortalServicos

**Files:**
- Create: `client/src/components/portal/PortalServicos.tsx`

- [ ] **Step 1: Criar PortalServicos.tsx**

Extrair `{activeModule === 'servicos' && ...}` de `PortalCliente.tsx:1500-1572`. Recebe `servicos`, `isLoading` como props. Usa `CancelamentoModal` do import local.

```tsx
// client/src/components/portal/PortalServicos.tsx
import { useState } from "react";
import { Loader2, Briefcase, XCircle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { CancelamentoModal } from "./CancelamentoModal";
import type { Servico } from "./CancelamentoModal";

interface Props {
  servicos: Servico[] | undefined;
  isLoading: boolean;
}

export function PortalServicos({ servicos, isLoading }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [cancelServico, setCancelServico] = useState<Servico | null>(null);
  // ... render list + modal
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/portal/PortalServicos.tsx
git commit -m "feat(portal): extract PortalServicos component"
```

---

### Task 6: Criar PortalPerfil

**Files:**
- Create: `client/src/components/portal/PortalPerfil.tsx`

- [ ] **Step 1: Criar PortalPerfil.tsx**

Novo módulo. Mover dados cadastrais (empresa, CNPJ, email, telefone editáveis) do Financeiro, e adicionar seção de senha e tema.

```tsx
// client/src/components/portal/PortalPerfil.tsx
import { useState } from "react";
import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Phone, Pencil, Check, X, Loader2, Lock, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import type { ClientUser } from "@/contexts/ClientAuthContext";

interface Props {
  client: ClientUser;
}

export function PortalPerfil({ client }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  // ... editable email/phone, readonly empresa/CNPJ, password change, theme toggle
}
```

Inclui:
- Seção "Dados da Empresa" (readonly: nome, CNPJ)
- Seção "Contato" (editável: email, telefone) — lógica de `startEdit`/`handleSaveEdit` movida do PortalCliente
- Seção "Segurança" (alterar senha — mesmo flow do `ForcePasswordChange` mas opcional)
- Seção "Preferências" (toggle dark/light)

- [ ] **Step 2: Commit**

```bash
git add client/src/components/portal/PortalPerfil.tsx
git commit -m "feat(portal): create PortalPerfil module with profile, password and theme"
```

---

## Chunk 4: Endpoint Dashboard + PortalDashboard

### Task 7: Criar endpoint GET /api/portal-cliente/dashboard

**Files:**
- Modify: `server/auth/routes.ts`

- [ ] **Step 1: Adicionar endpoint dashboard**

Inserir antes do endpoint `GET /api/portal-cliente/chat` (linha ~700). O endpoint consolida dados de faturas, serviços e chat num único response.

```tsx
// server/auth/routes.ts — novo endpoint

router.get("/api/portal-cliente/dashboard", async (req, res) => {
  const clientData = (req.session as any).clientData;
  if (!clientData) return res.status(401).json({ message: "Não autenticado como cliente" });

  try {
    // 1. Buscar IDs do cliente (mesma lógica de /resumo)
    const clientRows = await db
      .select({ ids: cazClientes.ids })
      .from(cazClientes)
      .where(eq(cazClientes.id, clientData.id))
      .limit(1);

    const ids = clientRows[0]?.ids;
    let faturas: any[] = [];

    if (ids) {
      const trimmed = ids.trim();
      let idList: string[];
      if (trimmed.startsWith('[')) {
        idList = (JSON.parse(trimmed) as (string | number)[]).map(String);
      } else {
        idList = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeIdList = idList.filter(id => UUID_REGEX.test(id));

      if (safeIdList.length > 0) {
        faturas = await db
          .select({
            id: cazParcelas.id,
            status: cazParcelas.status,
            valorBruto: cazParcelas.valorBruto,
            descricao: cazParcelas.descricao,
            dataVencimento: sql<string>`to_char(${cazParcelas.dataVencimento}, 'YYYY-MM-DD')`,
            dataQuitacao: sql<string>`to_char(${cazParcelas.dataQuitacao}, 'YYYY-MM-DD')`,
            categoriaNome: cazParcelas.categoriaNome,
            urlCobranca: cazParcelas.urlCobranca,
          })
          .from(cazParcelas)
          .where(sql`${cazParcelas.idCliente} = ANY(${safeIdList}::uuid[])`)
          .orderBy(desc(cazParcelas.dataVencimento))
          .limit(50);
      }
    }

    // 2. Calcular KPIs de faturas
    const atrasadas = faturas.filter(f => ['ATRASADO', 'VENCIDO'].includes((f.status ?? '').toUpperCase()));
    const pendentes = faturas.filter(f => {
      const s = (f.status ?? '').toUpperCase();
      return !['RECEBIDO', 'PAGO', 'QUITADO', 'ATRASADO', 'VENCIDO'].includes(s);
    });
    const proximaFatura = pendentes.sort((a, b) =>
      (a.dataVencimento ?? '').localeCompare(b.dataVencimento ?? '')
    )[0];

    // 3. Buscar serviços ativos
    // (usar mesma query do endpoint /servicos)
    const servicosResult = await db.execute(sql`
      SELECT produto, status
      FROM "Clickup".cup_contratos
      WHERE id_cliente = ${clientData.id}
    `);
    const servicosAtivos = (servicosResult.rows ?? []).filter((s: any) => {
      const st = (s.status ?? '').toLowerCase();
      return st.includes('ativo') || st.includes('anda') || st.includes('progr');
    }).length;

    // 4. Mensagens não lidas
    const chatResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cortex_core.portal_mensagens
      WHERE client_id = ${clientData.id}
        AND remetente_tipo = 'colaborador'
        AND lida = false
    `);
    const mensagensNaoLidas = parseInt((chatResult.rows?.[0] as any)?.count ?? '0', 10);

    // 5. Alertas automáticos
    const alertas: Array<{ tipo: string; mensagem: string }> = [];
    if (atrasadas.length > 0) {
      const totalAtrasado = atrasadas.reduce((sum, f) => sum + parseFloat(f.valorBruto ?? '0'), 0);
      alertas.push({
        tipo: 'atrasado',
        mensagem: `Você tem ${atrasadas.length} fatura${atrasadas.length > 1 ? 's' : ''} atrasada${atrasadas.length > 1 ? 's' : ''} (R$ ${totalAtrasado.toFixed(2).replace('.', ',')})`,
      });
    }
    if (mensagensNaoLidas > 0) {
      alertas.push({
        tipo: 'mensagem',
        mensagem: `Você tem ${mensagensNaoLidas} mensagen${mensagensNaoLidas > 1 ? 's' : ''} não lida${mensagensNaoLidas > 1 ? 's' : ''}`,
      });
    }

    res.json({
      proximoVencimento: proximaFatura
        ? { valor: parseFloat(proximaFatura.valorBruto ?? '0'), data: proximaFatura.dataVencimento }
        : null,
      faturasAtrasadas: {
        count: atrasadas.length,
        total: atrasadas.reduce((sum, f) => sum + parseFloat(f.valorBruto ?? '0'), 0),
      },
      servicosAtivos,
      mensagensNaoLidas,
      ultimasFaturas: faturas.slice(0, 3),
      alertas,
    });
  } catch (error) {
    console.error("Erro ao buscar dashboard do cliente:", error);
    return res.status(500).json({ message: "Erro ao buscar dados do dashboard" });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add server/auth/routes.ts
git commit -m "feat(portal): add GET /api/portal-cliente/dashboard endpoint"
```

---

### Task 8: Criar PortalDashboard

**Files:**
- Create: `client/src/components/portal/PortalDashboard.tsx`

- [ ] **Step 1: Criar PortalDashboard.tsx**

```tsx
// client/src/components/portal/PortalDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import {
  Loader2, CalendarClock, AlertCircle, Briefcase, MessageSquare,
  BarChart3, CircleDollarSign, Settings, Receipt, ExternalLink
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { StatusBadge } from "./StatusBadge";

type Module = 'dashboard' | 'financeiro' | 'relatorios' | 'servicos' | 'atendimento' | 'perfil';

interface DashboardData {
  proximoVencimento: { valor: number; data: string } | null;
  faturasAtrasadas: { count: number; total: number };
  servicosAtivos: number;
  mensagensNaoLidas: number;
  ultimasFaturas: Array<{
    id: string | number;
    status: string | null;
    valorBruto: string | null;
    descricao: string | null;
    dataVencimento: string | null;
    categoriaNome: string | null;
    urlCobranca: string | null;
  }>;
  alertas: Array<{ tipo: string; mensagem: string }>;
}

interface Props {
  onNavigate: (module: Module) => void;
}

export function PortalDashboard({ onNavigate }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/portal-cliente/dashboard"],
    staleTime: 60_000,
    retry: false,
  });

  // Render: 4 KPI cards, alertas, ações rápidas (grid 2x3), últimas 3 faturas
}
```

**Estrutura do render:**
1. **KPI cards** (grid 2x2 mobile, 4 cols desktop) — cada card clicável navegando ao módulo
2. **Alertas** (se houver) — banners vermelho/azul/amarelo
3. **Ações rápidas** (grid 2x3) — botões grandes com ícone + label
4. **Últimas faturas** (lista compacta de 3 + link "Ver todas")

- [ ] **Step 2: Commit**

```bash
git add client/src/components/portal/PortalDashboard.tsx
git commit -m "feat(portal): create PortalDashboard with KPIs, alerts and quick actions"
```

---

## Chunk 5: Reescrever Orquestrador + Integração Final

### Task 9: Reescrever PortalCliente.tsx como orquestrador

**Files:**
- Modify: `client/src/pages/PortalCliente.tsx`

- [ ] **Step 1: Reescrever PortalCliente.tsx**

Substituir o conteúdo inteiro por um orquestrador enxuto (~200 linhas):

```tsx
// client/src/pages/PortalCliente.tsx
import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useClientAuth, ClientAuthProvider } from "@/contexts/ClientAuthContext";
import { useTheme } from "@/components/ThemeProvider";
import {
  Loader2, LogOut, Sun, Moon, AlertCircle, Lock,
  BarChart3, CircleDollarSign, Briefcase, MessageSquare, Settings, LayoutDashboard
} from "lucide-react";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

// Lazy load modules
const PortalDashboard = lazy(() => import("@/components/portal/PortalDashboard").then(m => ({ default: m.PortalDashboard })));
const PortalPerformance = lazy(() => import("@/pages/PortalPerformance"));
const PortalFinanceiro = lazy(() => import("@/components/portal/PortalFinanceiro").then(m => ({ default: m.PortalFinanceiro })));
const PortalServicos = lazy(() => import("@/components/portal/PortalServicos").then(m => ({ default: m.PortalServicos })));
const PortalPerfil = lazy(() => import("@/components/portal/PortalPerfil").then(m => ({ default: m.PortalPerfil })));

import { PortalChat } from "@/components/portal/PortalChat";

type Module = 'dashboard' | 'relatorios' | 'financeiro' | 'servicos' | 'atendimento' | 'perfil';

// ForcePasswordChange (manter inline — é pequeno e usado apenas aqui)
function ForcePasswordChange({ onSuccess }: { onSuccess: () => void }) {
  // ... copiar das linhas 831-971 do original
}

function PortalClienteContent() {
  const [, setLocation] = useLocation();
  const { client, isLoading, isAuthenticated, mustChangePassword, clearMustChangePassword, logout } = useClientAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [activeModule, setActiveModule] = useState<Module>('dashboard'); // DEFAULT: dashboard
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auth states (loading, not authenticated, force password)
  // ... same as current

  // Initials for avatar
  const initials = (client.nome ?? 'C').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const MODULES: Array<{ id: Module; label: string; Icon: React.ElementType }> = [
    { id: 'dashboard',    label: 'Home',         Icon: LayoutDashboard },
    { id: 'relatorios',   label: 'Performance',  Icon: BarChart3 },
    { id: 'financeiro',   label: 'Financeiro',   Icon: CircleDollarSign },
    { id: 'servicos',     label: 'Serviços',     Icon: Briefcase },
    { id: 'atendimento',  label: 'Atendimento',  Icon: MessageSquare },
    { id: 'perfil',       label: 'Perfil',       Icon: Settings },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-zinc-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Header — same as current but simpler */}
      {/* Hero — same greeting card */}
      {/* Tab navigation — MODULES array with activeModule */}
      {/* Module content — Suspense wrapper per module */}

      <Suspense fallback={<Loader />}>
        {activeModule === 'dashboard' && <PortalDashboard onNavigate={setActiveModule} />}
        {activeModule === 'relatorios' && <PortalPerformance />}
        {activeModule === 'financeiro' && <PortalFinanceiro />}
        {activeModule === 'servicos' && <PortalServicos />}
        {activeModule === 'atendimento' && <PortalChat clientId={client.id} variant="page" />}
        {activeModule === 'perfil' && <PortalPerfil client={client} />}
      </Suspense>

      {/* FAB chat — only when NOT in atendimento module */}
      {activeModule !== 'atendimento' && (
        <>
          {chatOpen && <PortalChat clientId={client.id} variant="floating" onClose={() => setChatOpen(false)} onUnreadCountChange={setUnreadCount} />}
          <button onClick={() => setChatOpen(o => !o)} className="...">
            <MessageSquare />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>
        </>
      )}
    </div>
  );
}

// Wrapper with ClientAuthProvider — same as current
export default function PortalCliente() {
  return (
    <ClientAuthProvider>
      <PortalClienteContent />
    </ClientAuthProvider>
  );
}
```

**Nota:** Os módulos `PortalFinanceiro` e `PortalServicos` precisam fazer suas próprias queries (useQuery) internamente em vez de receber props. Isso permite lazy loading real e independência.

- [ ] **Step 2: Verificar que todos os imports estão corretos**

Conferir que cada componente exporta corretamente e que o lazy loading funciona.

- [ ] **Step 3: Testar navegação entre todos os módulos**

Abrir `/portal-cliente`, verificar:
- Dashboard abre como padrão
- Clicar em cada tab carrega o módulo correspondente
- KPI cards no dashboard navegam corretamente
- FAB de chat aparece em todos os módulos exceto Atendimento
- Badge de unread count funciona
- Dark/light toggle funciona em todos os módulos

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/PortalCliente.tsx
git commit -m "feat(portal): rewrite PortalCliente as orchestrator with dashboard-first navigation"
```

---

### Task 10: Teste final e push

- [ ] **Step 1: Verificar que a aplicação compila sem erros**

```bash
cd /Users/mac0267/Cortex && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 2: Verificar todos os módulos no browser**

Navegar `/portal-cliente` e testar cada módulo. Verificar:
- Dashboard: KPIs carregam, alertas aparecem, ações rápidas funcionam
- Performance: lazy load ok
- Financeiro: filtro por status funciona, mobile layout ok
- Serviços: lista + cancelamento ok
- Atendimento: chat page variant ok
- Perfil: editar email/tel, alterar senha, toggle tema

- [ ] **Step 3: Push final**

```bash
git push
```

- [ ] **Step 4: Atualizar Obsidian**

Atualizar `portal-cliente.md` no vault — marcar subtasks como concluídas.
