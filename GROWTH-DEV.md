# Growth Module - Guia de Desenvolvimento

## Branch: `feature/growth-dev`

## Arquivos do Módulo Growth

### Frontend (React + TypeScript)
- `client/src/pages/GrowthOrcadoRealizado.tsx` — Orçado x Realizado (metas, comparação, filtros)
- `client/src/pages/GrowthAI.tsx` — Growth AI Chat (assistente inteligente)
- `client/src/pages/GrowthVisaoGeral.tsx` — Visão Geral de Growth
- `client/src/pages/PerformancePlataformas.tsx` — Performance por Plataforma
- `client/src/pages/Criativos.tsx` — Criativos

### Backend (Express + TypeScript)
- `server/routes/growth.ts` — Endpoints de Growth (Ads, MQL, Não-MQL, Budgets, Funis)
- `server/routes/growth-ai.ts` — Endpoints do Growth AI Chat
- `server/services/growthAiTools.ts` — Tools de dados para o AI (Ads metrics, Deals, Budgets, Rankings, Health Check)
- `server/services/metaAdsSync.ts` — Sync de dados do Meta Ads

### Componentes compartilhados
- `client/src/components/ui/date-range-picker.tsx` — DateRangePicker com comparação de período
- `shared/nav-config.ts` — Navegação (seção Growth)

## Regras

1. **Só mexer nos arquivos listados acima** — não alterar componentes de outras áreas
2. **Testar em localhost** antes de commitar
3. **Conventional Commits** — usar `feat(growth):`, `fix(growth):`, `style(growth):`
4. **Dark/light mode** — sempre usar `dark:` variants do Tailwind
5. **Não alterar** `server/routes.ts` principal — usar os route files dedicados

## Como rodar

```bash
npm run dev
# Acessa em http://localhost:3000
# Growth fica em /growth/orcado-realizado, /growth/ai, etc.
```

## Dados

- **Meta Ads**: tabelas em `meta_ads.*` (meta_insights_daily, meta_campaigns, etc.)
- **Bitrix CRM**: `"Bitrix".crm_deal` (leads, deals, vendas)
- **Budgets**: `meta_ads.growth_budgets` (metas por mês, segmento, funil)

## Endpoints principais

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/growth/orcado-realizado/mql` | Métricas MQL (leads, reuniões, vendas) |
| `GET /api/growth/orcado-realizado/nao-mql` | Métricas Não-MQL |
| `GET /api/growth/orcado-realizado/ads` | Métricas de Ads (investimento, impressões, cliques) |
| `GET /api/growth/orcado-realizado/budgets` | Metas orçadas |
| `PUT /api/growth/orcado-realizado/budgets` | Salvar metas |
| `GET /api/growth/orcado-realizado/funis` | Lista de funis disponíveis |
| `POST /api/growth-ai/chat` | Chat do Growth AI |
