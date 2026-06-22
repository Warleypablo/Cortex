# Instagram Analytics Dashboard - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dashboard page at `/growth/instagram` showing Instagram metrics (followers, reach, impressions, engagement) and top posts for the Turbo account.

**Architecture:** Frontend-only dashboard consuming existing API endpoints (`/api/instagram/connections/:id/metrics` and `/api/instagram/connections/:id/posts`). Add date range filtering to the metrics endpoint. Single Turbo account — auto-detect the active connection.

**Tech Stack:** React, TanStack Query, Recharts, Tailwind CSS, shadcn/ui components, date-fns

---

### Task 1: Add date range support to metrics endpoint

**Files:**
- Modify: `server/routes/instagram.ts` (metrics endpoint ~line 524)

**Step 1: Update the metrics endpoint to accept startDate/endDate params**

Replace the `?days=N` logic with optional `startDate` and `endDate` query params (keep `days` as fallback):

```typescript
app.get("/api/instagram/connections/:id/metrics", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid connection ID" });

    const { startDate, endDate, days } = req.query;

    let sinceDateStr: string;
    let untilDateStr: string | null = null;

    if (startDate) {
      sinceDateStr = startDate as string;
      untilDateStr = (endDate as string) || null;
    } else {
      const numDays = parseInt(days as string, 10) || 90;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - numDays);
      sinceDateStr = sinceDate.toISOString().split("T")[0];
    }

    const conditions = [
      eq(instagramMetricsSnapshots.connectionId, id),
      gte(instagramMetricsSnapshots.metricDate, sinceDateStr),
    ];

    if (untilDateStr) {
      conditions.push(sql`${instagramMetricsSnapshots.metricDate} <= ${untilDateStr}`);
    }

    const rows = await db
      .select()
      .from(instagramMetricsSnapshots)
      .where(and(...conditions))
      .orderBy(instagramMetricsSnapshots.metricDate);

    return res.json(rows);
  } catch (err: any) {
    console.error("[Instagram] Error fetching metrics:", err);
    return res.status(500).json({ error: "Failed to fetch metrics" });
  }
});
```

**Step 2: Add date range and connection filter to posts endpoint**

Add `startDate`/`endDate` query params to filter posts by `posted_at`:

```typescript
// In the posts endpoint, add date filtering:
const { startDate, endDate, limit: limitParam } = req.query;
const limit = Math.min(parseInt(limitParam as string, 10) || 50, 200);

const conditions = [eq(instagramPostMetrics.connectionId, id)];
if (startDate) conditions.push(gte(instagramPostMetrics.postedAt, startDate as string));
if (endDate) conditions.push(sql`${instagramPostMetrics.postedAt} <= ${endDate}::timestamp`);
```

**Step 3: Commit**
```bash
git add server/routes/instagram.ts
git commit -m "feat(instagram): add date range filtering to metrics and posts endpoints"
```

---

### Task 2: Add Instagram to Growth sidebar menu

**Files:**
- Modify: `shared/nav-config.ts`

**Step 1: Add Instagram menu item to Growth section**

In the Growth items array (around line 458), add:
```typescript
{ title: 'Instagram', url: '/growth/instagram', icon: 'Instagram', permissionKey: PERMISSION_KEYS.GROWTH.INSTAGRAM },
```

**Step 2: Commit**
```bash
git add shared/nav-config.ts
git commit -m "feat(nav): add Instagram to Growth sidebar menu"
```

---

### Task 3: Create the Instagram Dashboard page

**Files:**
- Create: `client/src/pages/InstagramDashboard.tsx`
- Modify: `client/src/App.tsx` (change route to new component)

**Step 1: Create the dashboard page**

The page should:
1. Auto-detect the Turbo connection via `GET /api/instagram/connections` (first active one)
2. Show date picker (start/end) with preset buttons (7d, 30d, 90d)
3. Fetch metrics via `GET /api/instagram/connections/:id/metrics?startDate=X&endDate=Y`
4. Fetch posts via `GET /api/instagram/connections/:id/posts?startDate=X&endDate=Y&limit=100`

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ [7d] [30d] [90d]  [startDate] → [endDate]       │
├────────┬────────┬────────┬──────────────────────┤
│Seguid. │ Reach  │Impress.│ Engajamento Médio    │
│+120    │ 45.2k  │ 89.1k  │ 4.2%                 │
├────────┴────────┴────────┴──────────────────────┤
│ Evolução (ComposedChart)                         │
│ Area: seguidores | Lines: reach, impressões      │
├─────────────────────────────────────────────────┤
│ Performance por Tipo (BarChart)                  │
│ Foto vs Reel vs Vídeo — média de engajamento    │
├─────────────────────────────────────────────────┤
│ Top Posts (table/grid)                           │
│ thumbnail | caption | tipo | likes | comments   │
│           | saves | shares | reach | impressões │
└─────────────────────────────────────────────────┘
```

**Key implementation details:**
- Use `useQuery` with queryKey including date range
- Date state: `useState` with `startDate`/`endDate` as ISO strings
- Presets: buttons that set dates relative to today
- Hero metrics: compute from metrics array (sum reach/impressions, first/last followers delta)
- Chart: Recharts ComposedChart with dual Y-axis (followers left, reach/impressions right)
- Posts table: sortable columns, thumbnail preview, media type badge
- Dark/light mode with `dark:` Tailwind variants
- Empty state when no connection found (with link to connect)
- Loading skeletons

**Step 2: Update App.tsx route**

Change the lazy import and route to use the new dashboard as the main page, keeping connections management accessible:

```typescript
const InstagramDashboard = lazyWithRetry(() => import("@/pages/InstagramDashboard"));
// Route: /growth/instagram → InstagramDashboard
```

**Step 3: Commit**
```bash
git add client/src/pages/InstagramDashboard.tsx client/src/App.tsx
git commit -m "feat(instagram): add analytics dashboard page with metrics and posts"
```

---

### Task 4: Add `/growth/instagram` to default user routes

**Files:**
- Modify: `server/auth/userDb.ts`

**Step 1: Add route to DEFAULT_USER_ROUTES**
```typescript
'/growth/instagram',
```

**Step 2: Update existing users in production DB**
```sql
UPDATE cortex_core.auth_users
SET allowed_routes = array_append(allowed_routes, '/growth/instagram')
WHERE NOT ('/growth/instagram' = ANY(allowed_routes));
```

**Step 3: Commit**
```bash
git add server/auth/userDb.ts
git commit -m "feat(auth): add /growth/instagram to default user routes"
```

---

### Task 5: PR and merge

**Step 1: Push and create PR**
```bash
git push origin feature/instagram-dashboard
gh pr create --base main --title "feat(instagram): analytics dashboard"
```

**Step 2: Merge**
```bash
gh pr merge --merge --admin
```
