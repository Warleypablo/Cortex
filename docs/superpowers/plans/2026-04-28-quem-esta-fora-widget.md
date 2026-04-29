# Widget "Quem está fora hoje" — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o widget "Próximos Eventos" da Homepage por um widget que lista os colaboradores fora hoje (indisponibilidades aprovadas com janela englobando a data atual).

**Architecture:** Novo endpoint REST `GET /api/unavailability-requests/today` consulta `cortex_core.unavailability_requests` filtrando `status='aprovado'` e `CURRENT_DATE BETWEEN data_inicio AND data_fim`. Novo componente React `QuemEstaForaWidget` consome esse endpoint via React Query, renderiza lista com avatar/nome/data de retorno, e ocupa o slot do `MiniCalendar` no grid 4-colunas da Homepage. O widget reaproveita o mapa `userPhotos` (indexado por email) já carregado no `Homepage.tsx` para os aniversariantes.

**Tech Stack:** Express + Drizzle (server), React + TypeScript + React Query + Tailwind + lucide-react + date-fns (client).

**Spec:** `docs/superpowers/specs/2026-04-28-quem-esta-fora-widget-design.md`

---

## Estrutura de arquivos

**Criar:**
- `client/src/components/QuemEstaForaWidget.tsx` — componente do widget

**Modificar:**
- `server/routes.ts` — adicionar endpoint `/api/unavailability-requests/today`; remover bloco `proximosEventos` do endpoint `/api/home-overview`
- `client/src/pages/Homepage.tsx` — remover componente local `MiniCalendar`, ajustar tipo `HomeOverview`, integrar `QuemEstaForaWidget`

---

## Task 1: Endpoint backend `/api/unavailability-requests/today`

**Files:**
- Modify: `server/routes.ts` (adicionar próximo aos outros endpoints `/api/unavailability-requests/...`, ~linha 11700)

- [ ] **Step 1: Adicionar o endpoint no servidor**

Localizar o bloco de endpoints `/api/unavailability-requests/...` em `server/routes.ts` (próximo da linha 11700, depois do `app.get("/api/unavailability-requests/squads", ...)`). Adicionar **antes** de `app.get("/api/unavailability-requests", ...)`:

```ts
app.get("/api/unavailability-requests/today", isAuthenticated, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        ur.id,
        ur.colaborador_id,
        ur.colaborador_nome,
        ur.colaborador_email,
        ur.data_fim
      FROM cortex_core.unavailability_requests ur
      WHERE ur.status = 'aprovado'
        AND CURRENT_DATE BETWEEN ur.data_inicio AND ur.data_fim
      ORDER BY ur.colaborador_nome ASC
    `);

    const items = result.rows.map((row: any) => ({
      id: row.id,
      colaboradorId: row.colaborador_id,
      nome: row.colaborador_nome,
      email: row.colaborador_email,
      dataFim: row.data_fim,
    }));

    res.json(items);
  } catch (error) {
    console.error("[unavailability-today] Error fetching today list:", error);
    res.status(500).json({ error: "Failed to fetch unavailability today" });
  }
});
```

**IMPORTANTE:** A rota `/today` precisa vir **antes** de qualquer rota com parâmetro `:id` no mesmo prefixo `/api/unavailability-requests` para o Express não interpretar `today` como um id. Como não há rota `/api/unavailability-requests/:id` direta (só `/:id/approve`, `/:id` em PATCH/PUT/DELETE), basta colocar perto das outras rotas GET.

- [ ] **Step 2: Reiniciar dev server e testar com curl**

Reiniciar dev server (matar processo na porta 3000 e rodar `npm run dev`):
```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Em outro terminal, testar o endpoint (usar cookie de sessão do navegador autenticado, ou pelo console do navegador):
```bash
# No console do browser autenticado:
fetch('/api/unavailability-requests/today').then(r => r.json()).then(console.log)
```

Esperado: array JSON (vazio ou com itens). Sem erro 500.

- [ ] **Step 3: Commit**

```bash
git add server/routes.ts
git commit -m "feat(api): endpoint GET /api/unavailability-requests/today

Lista colaboradores com indisponibilidade aprovada cuja janela
engloba a data atual. Usado pelo widget 'Quem está fora hoje'
da Homepage.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Componente `QuemEstaForaWidget`

**Files:**
- Create: `client/src/components/QuemEstaForaWidget.tsx`

- [ ] **Step 1: Criar o componente**

Criar `client/src/components/QuemEstaForaWidget.tsx` com o conteúdo:

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plane, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface QuemEstaForaItem {
  id: number;
  colaboradorId: number;
  nome: string;
  email: string | null;
  dataFim: string;
}

interface QuemEstaForaWidgetProps {
  userPhotos: Record<string, string>;
}

function getInitials(nome: string) {
  const parts = nome.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || "??";
}

export function QuemEstaForaWidget({ userPhotos }: QuemEstaForaWidgetProps) {
  const { data: items, isLoading } = useQuery<QuemEstaForaItem[]>({
    queryKey: ["/api/unavailability-requests/today"],
    staleTime: 5 * 60 * 1000,
  });

  const lista = items ?? [];

  return (
    <Card data-testid="card-quem-esta-fora" className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Plane className="w-4 h-4" />
            Quem está fora hoje
            {lista.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {lista.length}
              </Badge>
            )}
          </CardTitle>
          <Link href="/calendario-ferias">
            <Button variant="ghost" size="sm" data-testid="button-ver-calendario-ferias">
              Ver todos
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto pr-2">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground text-center py-8">
              Ninguém está fora hoje 🎉
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((item) => {
              const email = item.email?.toLowerCase().trim();
              const photo = email ? userPhotos[email] : undefined;
              const dataRetorno = format(parseISO(item.dataFim), "dd/MM", { locale: ptBR });

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`fora-item-${item.id}`}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={photo || undefined} alt={item.nome} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {getInitials(item.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      volta em {dataRetorno}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/QuemEstaForaWidget.tsx
git commit -m "feat(home): componente QuemEstaForaWidget

Lista colaboradores com indisponibilidade ativa hoje. Reaproveita
o mapa userPhotos (indexado por email) para mostrar a foto de
cada pessoa, caindo em iniciais quando não há foto.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Integrar na Homepage e remover MiniCalendar

**Files:**
- Modify: `client/src/pages/Homepage.tsx`

- [ ] **Step 1: Importar o novo componente**

Em `client/src/pages/Homepage.tsx`, adicionar o import junto aos outros imports de components no topo do arquivo:

```tsx
import { QuemEstaForaWidget } from "@/components/QuemEstaForaWidget";
```

- [ ] **Step 2: Remover o campo `proximosEventos` do tipo `HomeOverview`**

Localizar (~linha 96) o trecho:

```ts
proximosEventos: Array<{
  id: string;
  titulo: string;
  // ... demais campos
}>;
```

Remover esse campo inteiro do tipo `HomeOverview`.

- [ ] **Step 3: Remover o componente local `MiniCalendar`**

Remover toda a função `MiniCalendar` (linhas ~239-311 — começa em `function MiniCalendar({ eventos }...` e termina no `}` que fecha a função, antes de `function MeusClientes`).

- [ ] **Step 4: Substituir o uso na linha do grid**

Localizar (~linha 904):

```tsx
<MiniCalendar eventos={homeOverview?.proximosEventos || []} />
```

Substituir por:

```tsx
<QuemEstaForaWidget userPhotos={userPhotos} />
```

- [ ] **Step 5: Limpar imports não usados**

Verificar se `Clock`, `MapPin` e `Calendar` (de `lucide-react`) ainda são usados em outro lugar do arquivo. Buscar com:

```bash
grep -n "Clock\|MapPin" client/src/pages/Homepage.tsx
grep -n "<Calendar " client/src/pages/Homepage.tsx
```

Se algum não tiver mais ocorrência, remover do import de `lucide-react` no topo do arquivo. **Cuidado:** `Calendar` pode ser usado por outros widgets — só remover se realmente não tiver mais nenhuma ocorrência.

- [ ] **Step 6: Validar TypeScript**

Rodar:

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados a `Homepage.tsx` ou `QuemEstaForaWidget.tsx`. Se aparecer erro de campo `proximosEventos` em outro arquivo, buscar com `grep -rn "proximosEventos" client/src` e remover ou ajustar.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Homepage.tsx
git commit -m "feat(home): substitui MiniCalendar por QuemEstaForaWidget

Remove o widget 'Próximos Eventos' (turbo_eventos) da Homepage e
coloca no lugar o widget 'Quem está fora hoje' baseado em
unavailability_requests.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Limpeza do servidor — remover `proximosEventos` do home-overview

**Files:**
- Modify: `server/routes.ts` (~linhas 9786-9805 e 9921)

- [ ] **Step 1: Remover o bloco que busca eventos**

Localizar (~linha 9786) o bloco de comentário e código:

```ts
// Buscar próximos eventos (próximos 30 dias)
const hoje = new Date();
const em30Dias = new Date();
em30Dias.setDate(em30Dias.getDate() + 30);

const eventosQuery = await db.execute(sql`
  SELECT id, titulo, tipo, data_inicio, data_fim, local, cor
  FROM cortex_core.turbo_eventos
  WHERE data_inicio >= ${hoje.toISOString()}
    AND data_inicio <= ${em30Dias.toISOString()}
  ORDER BY data_inicio ASC
  LIMIT 5
`);

const proximosEventos = eventosQuery.rows.map((row: any) => ({
  id: row.id,
  titulo: row.titulo,
  // ... resto dos campos
}));
```

Remover o bloco inteiro (do comentário `// Buscar próximos eventos` até o fechamento do `.map(...))` que fecha o `proximosEventos`).

- [ ] **Step 2: Remover do payload da resposta**

Localizar (~linha 9921) dentro do `res.json({...})`:

```ts
proximosEventos,
```

Remover essa linha.

- [ ] **Step 3: Validar TypeScript**

Rodar:

```bash
npx tsc --noEmit
```

Esperado: sem novos erros.

- [ ] **Step 4: Reiniciar dev server e testar a Homepage**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; npm run dev
```

Abrir a Homepage no browser. Verificar:
1. Card "Quem está fora hoje" aparece no slot onde antes estava "Próximos Eventos".
2. Se houver dados aprovados na janela, lista renderiza com avatar + nome + "volta em DD/MM".
3. Se não houver, aparece "Ninguém está fora hoje 🎉".
4. Click em "Ver todos" navega para `/calendario-ferias`.
5. Os outros 3 widgets (MeusClientes, Alertas, Aniversariantes) continuam funcionando.
6. Testar dark mode e light mode (toggle do tema).

- [ ] **Step 5: Commit**

```bash
git add server/routes.ts
git commit -m "chore(home): remove proximosEventos do endpoint home-overview

Campo não é mais consumido após substituição do MiniCalendar
pelo QuemEstaForaWidget.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Workflow pós-conclusão (CLAUDE.md)

- [ ] **Step 1: Push final**

```bash
git push
```

- [ ] **Step 2: Verificar se há um chamado/TASK no Cortex DB associado a esta feature**

Se não houver chamado vinculado, pular para Step 3. Se houver, atualizar status:

```sql
UPDATE cortex_core.chamados SET status='review', atualizado_em=NOW() WHERE id=<chamado_id>;
```

- [ ] **Step 3: Atualizar Obsidian Vault (se houver TASK relacionada)**

Verificar se existe arquivo em `/Users/mac0267/Documents/Obsidian Vault/Córtex 2.0/Tasks/` para esta feature. Se sim, marcar subtasks `[x]` com data de conclusão. Se não, pular.

---

## Validação manual final

Checklist a rodar após Task 4 completar:

- [ ] Widget aparece no slot correto (3º card do grid 4-col, posição que era do MiniCalendar)
- [ ] Lista renderiza nomes em ordem alfabética
- [ ] Avatar com foto aparece quando o email do colaborador tem foto cadastrada
- [ ] Avatar com iniciais aparece quando não há foto
- [ ] Estado vazio: "Ninguém está fora hoje 🎉"
- [ ] Loading: 3 skeletons enquanto carrega
- [ ] Click em "Ver todos" → navega para `/calendario-ferias`
- [ ] Dark mode: cores corretas
- [ ] Light mode: cores corretas
- [ ] Endpoint `/api/home-overview` continua funcionando sem `proximosEventos`
- [ ] Outros widgets da home continuam intactos
