# Uso do Sistema — Design Spec

> **Scope:** Add login/logout logging to `auth_logs` table, add page view tracking, and create a dedicated admin page for system usage analytics.
> **Type:** Full-stack — backend logging + new DB table + new API endpoints + new frontend page.
> **Domain:** Admin

---

## Context

The system has Google OAuth, external login, and client portal login — but **none of them write to `auth_logs`**. The table and schema exist (`shared/schema.ts:1594-1607`), the endpoint exists (`GET /api/admin/auth-logs` in `server/routes.ts:518-544`), and `AdminLogs.tsx` already renders an "Acessos" tab — but the table is empty because no inserts happen.

Additionally, there is **no page view tracking**. The user wants to understand system adoption: who uses it, how often, and which pages are most popular.

---

## What We're Building

1. **Populate `auth_logs`** — Insert records at each login/logout success and failure path in `server/auth/routes.ts`
2. **New `page_views` table** — Track every page navigation per user
3. **Page view tracking hook** — Frontend hook that fires on every route change
4. **New API endpoints** — Usage stats aggregation + page views listing
5. **New admin page `AdminUsageLog.tsx`** — Dashboard showing usage analytics

---

## Part 1: Populate auth_logs

### Insert Points in `server/auth/routes.ts`

Each login handler follows the same pattern: `req.logIn()` → `req.session.save()` → success/redirect. Insert `auth_logs` records at each outcome:

| Handler | Lines | Success Insert Point | Failure Insert Points | Action Value |
|---------|-------|---------------------|----------------------|-------------|
| Google OAuth callback | 48-85 | Before `res.redirect("/")` (line 80) | Lines 62, 66, 71, 77 | `"login_google"` |
| External login | 163-209 | Before `res.json()` (line 202) | Lines 192, 198 | `"login_external"` |
| Client login | 227-322 | Before `res.json()` (line 315) | Lines 249 (CNPJ not found), 284 (wrong password), 303, 311 | `"login_client"` |
| Dev login | 105-138 | Before `res.json()` (line 135) | Lines 125, 131 | `"login_dev"` |
| Logout | 87-102 | Before `res.json()` (line 99) | Line 90 | `"logout"` |

### Helper Function

Create a helper in `server/auth/routes.ts` to avoid repeating the insert logic:

```typescript
async function logAuthEvent(params: {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  action: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
}) {
  try {
    await db.insert(authLogs).values({
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      userName: params.userName ?? null,
      action: params.action,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      success: params.success ? "true" : "false",
    });
  } catch (err) {
    console.error("[auth] Failed to write auth log:", err);
  }
}
```

Extract IP: `req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || null`

Extract User-Agent: `req.headers['user-agent'] || null`

### Logging Rules

- **Success logs**: Include userId, email, name from the authenticated user object
- **Failure logs**: Include whatever is available (email from request body, no userId if auth failed)
- **Client login mapping**: For client-portal logins, use `userId = client.id`, `userEmail = client.email || null`, `userName = client.nome`. Client login does NOT use Passport's `req.user` — data lives in `clientPayload`.
- **Logout logs**: Capture user data from `req.user` BEFORE `req.logout()` destroys it (store in local variable first)
- **Never block the response** — the `logAuthEvent` call is fire-and-forget (no `await` in the response path, or wrapped in try/catch)

---

## Part 2: Page Views Table

### Schema Addition (`shared/schema.ts`)

```typescript
export const pageViews = pgTable("page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id", { length: 100 }),
  userEmail: varchar("user_email", { length: 255 }),
  userName: varchar("user_name", { length: 255 }),
  path: varchar("path", { length: 500 }).notNull(),
  pageTitle: varchar("page_title", { length: 255 }),
});

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;
```

Table goes in `cortex_core` schema (same as `auth_logs`).

### Migration

Push schema with `npx drizzle-kit push` (same pattern as other tables).

---

## Part 3: Page View Tracking

### Backend Endpoint

`POST /api/track/page-view` — authenticated, not admin-only (all logged-in users generate page views):

```typescript
app.post("/api/track/page-view", isAuthenticated, async (req, res) => {
  const user = req.user as User;
  const { path, pageTitle } = req.body;
  if (!path) return res.status(400).json({ error: "path required" });

  try {
    await db.insert(pageViews).values({
      userId: user.id,
      userEmail: user.email,
      userName: user.name || null,
      path,
      pageTitle: pageTitle || null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[track] page-view error:", err);
    res.status(500).json({ error: "Failed to track page view" });
  }
});
```

### Frontend Hook

Create `client/src/hooks/use-page-tracking.ts`:

```typescript
import { useEffect } from "react";
import { useLocation } from "wouter";

export function usePageTracking() {
  const [location] = useLocation();

  useEffect(() => {
    // Skip tracking for auth pages and static assets
    if (location.startsWith("/login") || location.startsWith("/auth")) return;

    const pageTitle = document.title?.replace(" | Córtex", "").trim() || "";

    fetch("/api/track/page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ path: location, pageTitle }),
    }).catch(() => {}); // fire-and-forget
  }, [location]);
}
```

Call `usePageTracking()` once in `App.tsx` inside the authenticated layout.

---

## Part 4: Admin API Endpoints

All admin-only (`isAuthenticated, isAdmin`).

### `GET /api/admin/usage-stats?days=30`

Returns aggregated stats for the given period:

```json
{
  "activeUsersToday": 5,
  "pageViewsToday": 142,
  "loginsToday": 8,
  "topPages": [
    { "path": "/dashboard/churn", "pageTitle": "Churn", "views": 45 },
    { "path": "/dashboard/visao-geral", "pageTitle": "Visão Geral", "views": 38 }
  ],
  "topUsers": [
    { "userEmail": "fulano@empresa.com", "userName": "Fulano", "views": 62 },
    { "userEmail": "ciclano@empresa.com", "userName": "Ciclano", "views": 45 }
  ],
  "dailyActivity": [
    { "date": "2026-03-17", "logins": 8, "pageViews": 142 },
    { "date": "2026-03-16", "logins": 6, "pageViews": 98 }
  ]
}
```

Queries:
- `activeUsersToday`: `SELECT COUNT(DISTINCT user_id) FROM page_views WHERE timestamp >= today`
- `pageViewsToday`: `SELECT COUNT(*) FROM page_views WHERE timestamp >= today`
- `loginsToday`: `SELECT COUNT(*) FROM auth_logs WHERE timestamp >= today AND action LIKE 'login%' AND success = 'true'`
- `topPages`: `SELECT path, page_title, COUNT(*) FROM page_views WHERE timestamp >= now() - interval 'N days' GROUP BY path, page_title ORDER BY count DESC LIMIT 10`
- `topUsers`: `SELECT user_email, user_name, COUNT(*) FROM page_views WHERE timestamp >= now() - interval 'N days' GROUP BY user_email, user_name ORDER BY count DESC LIMIT 10`
- `dailyActivity`: `SELECT date_trunc('day', timestamp)::date, logins from auth_logs, page_views from page_views grouped by day`

### `GET /api/admin/page-views?page=1&pageSize=50&userId=X`

Paginated list of page views with optional user filter. Same pagination pattern as existing `auth-logs` endpoint.

---

## Part 5: Admin Page — `AdminUsageLog.tsx`

### Route

- Path: `/admin/uso`
- Access: admin-only (via `ProtectedRoute`)
- Lazy import in `App.tsx`

### Page Anatomy

```
Título "Uso do Sistema"
──────────────────────────────
Filtro: Período (7d / 14d / 30d)
──────────────────────────────
Hero Metrics (3x HeroMetric, sem card wrapper):
  Usuários Ativos Hoje | Page Views Hoje | Logins Hoje
──────────────────────────────
Gráfico: Atividade Diária (ComposedChart, height 300)
  Bar = Page Views | Line = Logins
──────────────────────────────
Grid 2-col:
  Top 10 Páginas (ranked list) | Top 10 Usuários (ranked list)
──────────────────────────────
Tabela: Auth Logs recentes (paginada, 20 por página)
  Colunas: Data/Hora | Usuário | Ação | IP | Status
```

### Design System Compliance

- Heroes: `HeroMetric` component with `subtitle` prop for tooltips
- Chart: `ComposedChart` with `CartesianGrid vertical={false}`, `<YAxis hide />`, `CustomTooltip`
- Ranked lists: Simple numbered list inside `Card`, no decorative icons
- Auth logs table: `scope="col"` on headers, alternating rows, pagination
- Loading: Per-section `<Skeleton>` (heroes, chart, lists, table)
- Empty: Inline `<p>` text per section if no data

### Data Flow

```
useQuery("/api/admin/usage-stats?days=N") → heroes + chart + ranked lists
useQuery("/api/admin/auth-logs?page=N") → auth logs table (reuses existing endpoint)
```

---

## Import Changes

### `server/auth/routes.ts`
- **Add:** `import { authLogs } from "@shared/schema";`
- **Add:** `import { db } from "../db";` (if not already imported)

### `server/routes.ts`
- **Add:** `import { pageViews } from "@shared/schema";`
- **Add:** New endpoints (`POST /api/track/page-view`, `GET /api/admin/usage-stats`, `GET /api/admin/page-views`)

### `client/src/App.tsx`
- **Add:** `import { usePageTracking } from "@/hooks/use-page-tracking";`
- **Add:** Lazy import for `AdminUsageLog`
- **Add:** Route `/admin/uso`

---

## Out of Scope

- No changes to existing `AdminLogs.tsx` — the "Acessos" tab there will naturally start showing data once auth_logs is populated. The new `AdminUsageLog` page provides a richer analytics view.
- No retention/cleanup policy for old logs (can be added later)
- No real-time updates (polling or websockets) — manual refresh is sufficient
- No tracking of API calls or non-page interactions
- No changes to authentication flow logic itself
- No page view tracking for client-portal sessions (they use a separate session mechanism, not Passport — `isAuthenticated` won't pass them through). Auth logs DO capture client login/logout.
