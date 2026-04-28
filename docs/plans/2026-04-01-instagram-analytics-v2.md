# Instagram Analytics v2 — Dashboard Completo

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the Instagram Analytics dashboard with content analysis, growth analysis, best posting times, and industry benchmarks.

**Architecture:** All new sections are frontend-only, using existing data from `/api/instagram/connections/:id/metrics` and `/api/instagram/connections/:id/posts`. No backend changes needed — all calculations done in `useMemo` hooks.

**Tech Stack:** React, TanStack Query, Recharts, Tailwind CSS, date-fns

---

### Task 1: Add new analysis sections to InstagramDashboard.tsx

**Files:**
- Modify: `client/src/pages/InstagramDashboard.tsx`

This is a single large task because all sections are frontend-only calculations on existing data. The file is already 1304 lines.

**What to add (in order, after the existing "Top Posts" table):**

#### Section A: Performance por Tipo de Midia (replace existing basic bar chart)
Replace the existing simple bar chart with a more detailed comparison:
- Grouped bar chart comparing CAROUSEL_ALBUM vs VIDEO vs IMAGE
- Show 4 metrics side by side: avg likes, avg comments, avg saves, avg shares
- Show avg engagement rate per type: (likes+comments+saves+shares) / reach * 100
- Colors: #6C63FF for primary bars, #00D4C8 for secondary, #10B981 for tertiary
- Section title with 2px indigo left accent bar

#### Section B: Melhores Horarios para Postar (NEW)
- Heatmap grid: 7 rows (Mon-Sun) x 24 columns (0h-23h)
- Each cell colored by average engagement rate of posts at that day/hour
- Color scale: transparent (no data) → light indigo → dark indigo (#6C63FF)
- Data source: parse `postedAt` from posts, group by dayOfWeek + hour
- Calculate avg engagement = (likes+comments+saves+shares) for each slot
- Show count of posts in tooltip
- Section title: "Melhores Horarios para Postar"

#### Section C: Frequencia de Publicacao (NEW)
- Bar chart showing posts per week (last N weeks based on date range)
- Overlay line showing avg engagement rate per week
- Helps identify if posting more = more engagement
- X-axis: week labels (e.g., "Sem 1 Mar", "Sem 2 Mar")
- Left Y-axis: post count (bars)
- Right Y-axis: avg engagement rate (line)

#### Section D: Taxa de Engajamento ao Longo do Tempo (NEW)
- Line chart showing engagement rate trend over time
- Calculate per-post engagement rate, then average per day/week
- Overlay a trend line (simple moving average, 7-day window)
- Color: #6C63FF for actual, #00D4C8 dashed for moving average

#### Section E: Crescimento de Seguidores (NEW)
- Bar chart showing daily follower delta (gain/loss per day)
- Green bars for positive days, red for negative
- Uses metrics snapshots: delta = followers[i] - followers[i-1]
- Show cumulative gain as a line overlay

#### Section F: Benchmarks do Setor (NEW)
- Simple card grid (3 cards) comparing Turbo metrics vs industry averages
- Card 1: Engagement Rate — Turbo vs setor (agencias de marketing: ~1.5-3%)
- Card 2: Reach Rate — Turbo reach/followers vs setor (~10-20%)
- Card 3: Comments Rate — comments/likes ratio vs setor (~2-5%)
- Visual: gauge or progress bar showing where Turbo falls
- Green if above average, yellow if at, red if below
- Static benchmark values hardcoded (industry averages)

#### Section G: Improve Hero Metrics
- Fix engagement rate calculation: (likes+comments+saves+shares) / reach * 100
- Add variation vs previous period for Reach and Views (not just followers)
- Use the date range to compute "previous period" (same duration before startDate)

#### Section H: Improve Top Posts Table
- Add engagement rate column per post
- Add media type filter buttons (All / Carousel / Video / Image)
- Keep existing sort functionality

**Implementation approach:**
- All new sections use existing `posts` and `metrics` data from useQuery
- Calculations in useMemo hooks
- Follow the existing dark minimal aesthetic (#0A0A0F bg, #6C63FF accent, etc.)
- Section titles: 0.7rem uppercase with 2px indigo left accent bar
- All charts use Recharts components already imported

**Step 1: Implement all sections**
Add all sections to the existing InstagramDashboard.tsx file, after the current content.

**Step 2: Commit**
```bash
git add client/src/pages/InstagramDashboard.tsx
git commit -m "feat(instagram): add content analysis, growth metrics, heatmap, and benchmarks"
```

---

### Task 2: Push and merge

**Step 1: Push and create PR**
```bash
git push origin main
```
