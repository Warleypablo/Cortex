# CRM Dashboard - Marketing Digital

## Overview

This CRM dashboard provides a unified view of client relationships, contracts, services, and revenue for a digital marketing agency. It integrates financial data from Conta Azul (ERP) and operational data from ClickUp, centralizing client information, contract status, invoicing, team assignments, and financial metrics across different marketing squads (Supreme, Forja, Squadra, and Chama). The project aims to enhance client management, financial tracking, and retention analysis to improve business intelligence and operational efficiency.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, Vite, and Wouter for routing.
- **UI/UX**: shadcn/ui components, Radix UI primitives, Tailwind CSS for styling, custom color palette, Poppins font, and Lucide React icons. Design inspired by modern CRM interfaces like HubSpot/Salesforce.
- **State Management**: TanStack Query for server state management; React hooks for local component state.
- **Form Handling**: React Hook Form with Zod for validation, Drizzle-Zod for schema generation.
- **Key Features**:
    - **Client Management**: Integrated client listing from Conta Azul and ClickUp, with search, filter, pagination, and sortable columns. Includes LTV (Lifetime Value), LT (Lifetime), and AOV (Average Order Value) metrics. Services column displays colorful icons with tooltips (max 5 visible, overflow shown with "..." tooltip) using accent-insensitive pattern matching. Contract type filter allows filtering by Recorrente (recurring), Pontual (one-time), or both.
    - **LT (Lifetime) Calculation**: LT represents "meses ativos" (active months) - the count of distinct months with paid revenue (status PAGO or ACQUITTED) from `caz_receber` table. Uses `COALESCE(data_vencimento, data_criacao)` to determine the month. Displayed consistently in both the client list table and individual client detail pages.
    - **AOV (Average Order Value)**: Calculated as LTV ÷ LT, representing the average monthly ticket per client. Displayed in KPI card on Clients page.
    - **Service Icons**: Visual service representation system (`client/src/lib/service-icons.tsx`) maps service names from `cup_contratos.produto` to category-specific Lucide icons with color coding. Uses NFD normalization for accent-insensitive matching. Covers 20+ service categories including Performance, Social Media (including "Redes Sociais"), Creators, CRM, E-mail, E-commerce, SEO, Automação, etc. Displayed in `ServiceIcons` component with shadcn Tooltips showing full service name on hover. Limited to 5 visible icons with overflow indicator.
    - **Contract Type Filtering**: Clients page includes filter for contract type (Recorrente/Pontual/Ambos). Backend aggregates `totalRecorrente` (sum of `valorr`) and `totalPontual` (sum of `valorp`) from active contracts (status: ativo, onboarding, triagem). Filter affects both table display and KPI calculations.
    - **Employee Management**: CRUD operations for 25 employee fields from `rh_pessoal` table. Includes bidirectional linking with patrimônios (assets) - "Patrimônios" column displays clickable badges linking to `/dashboard/patrimonio/:id`. Link is established by normalized name matching between `rh_pessoal.nome` and `rh_patrimonio.responsavel_atual` (trim, lowercase, accent removal via NFD normalization).
    - **Contract Management**: Comprehensive tracking from `cup_contratos`. Service column displays name from `servico` field, while service filter uses `produto` column for categorization. Includes status-based color coding, squad assignment, and financial values (valorr for recurring, valorp for one-time). "Responsável" column shows `cup_contratos.responsavel`, "CS" column shows `cup_contratos.csResponsavel`. Contracts page displays AOV Médio (ticket médio por contrato = soma de valorr + valorp dividido pelo número de contratos filtrados) and includes Recorrente/Pontual/Ambos contract type filter.
    - **Retention Analysis**: Churn metrics by service and responsible person with monthly breakdowns, filtering, and Recharts visualizations. Secure parameter binding prevents SQL injection.
    - **DFC (Demonstração de Fluxo de Caixa)**: Hierarchical cash flow analysis from `caz_parcelas` with expandable tree structure, month range filters, pivot table display, and sticky first column (categoria) for horizontal scrolling. Uses `valor_pago` with proportional distribution for parcelas with multiple categories.
    - **Inhire Recruitment Analytics**: Sub-dashboard under HR (G&G) section displaying recruitment metrics from Google Cloud SQL tables (`rh_candidaturas`, `rh_vagas`, `rh_talentos`). Features include:
        - **KPI Cards**: Total applications, active candidates, open positions, conversion rate, average hiring time
        - **Status Distribution**: Pie chart showing talent_status breakdown with percentages
        - **Stage Distribution**: Bar chart displaying candidates per recruitment stage
        - **Source Analysis**: Horizontal bar chart of top candidate sources
        - **Conversion Funnel**: Dual bar chart showing total candidates and conversion % per stage
        - **Vacancy Tracking**: Table listing top 10 vacancies by application count with status distribution badges
        - **Route**: `/dashboard/inhire` with proper RBAC controls
    - **Visão Geral Dashboard**: Overview page (`/dashboard/visao-geral`) with MRR metrics, rankings, and evolution charts:
        - **Data Strategy**: Hybrid approach combining snapshot state and event-based metrics
            - **MRR Ativo**: Uses last snapshot of filtered month from `cup_data_hist` (state at point in time)
            - **Aquisições/Churn/Pausados**: Uses `cup_contratos` table (event-based transitions with timestamps)
            - **Rankings**: Top responsáveis and squads calculated from snapshot data, grouped by `responsavel` and `squad` from `cup_data_hist`
        - **Month Filter**: Controls all metrics, passed as `mesAno` parameter (YYYY-MM format) with validation
        - **React Query**: Proper cache invalidation using `mesVisaoGeral` in query keys for automatic refetch
        - **API Endpoints**: `/api/visao-geral/metricas`, `/api/visao-geral/mrr-evolucao`, `/api/top-responsaveis`, `/api/top-squads`
    - **Meta Ads Analytics Dashboard**: Comprehensive Meta advertising performance dashboard (`/dashboard/meta-ads`) correlating Meta Ads data with CRM conversion tracking:
        - **Data Sources**: Integrates `meta_insights_daily`, `meta_campaigns`, `meta_adsets`, `meta_ads`, `meta_creatives` with `crm_deal` table
        - **UTM Mapping Strategy**: 
            - ✅ `utm_campaign` → `campaign_id` (campaign-level conversions)
            - ✅ `utm_term` → `adset_id` (adset-level conversions)
            - ❌ Ad/Creative-level: No tracking (crm_deal lacks `utm_content` field for ad_id)
        - **Conversion Attribution**: Deals marked "Negócio Ganho" in stage_name contribute to won count and revenue (valor_pontual + valor_recorrente)
        - **KPI Cards**: Total spend, impressions, clicks, reach, CTR, CPC, CPM, leads, conversions, revenue, ROAS, cost per lead, CAC, conversion rate
        - **Conversion Funnel**: Recharts visualization showing Impressions → Clicks → Leads → Won with conversion rates
        - **Analysis Tabs**:
            - **Campaigns**: Full CRM attribution (utm_campaign mapping)
            - **AdSets**: Full CRM attribution (utm_term mapping)
            - **Ads**: Meta metrics only (spend, impressions, clicks, CTR, CPC) - no CRM data
            - **Creatives**: Meta metrics + video engagement (P25/P50/P75/P100) - no CRM data
        - **Period Filters**: 7/30/90/365 days with date range selection
        - **Route**: `/dashboard/meta-ads` with RBAC protection
        - **API Endpoints**: `/api/meta-ads/overview`, `/api/meta-ads/campaigns`, `/api/meta-ads/adsets`, `/api/meta-ads/ads`, `/api/meta-ads/creatives`, `/api/meta-ads/funnel`
- **Theming**: Dark mode support via CSS variables; light mode is primary.

### Backend Architecture
- **Server**: Express.js with TypeScript, using Node's native `http` module.
- **API**: RESTful API (`/api` prefix) with middleware for JSON parsing, URL encoding, and logging.
- **Data Access**: Drizzle ORM for PostgreSQL, with an `IStorage` abstraction layer.
- **Security**: Drizzle `sql`` template literals and `sql.join()` for all user-supplied parameters to prevent SQL injection.
- **API Endpoints**: `/api/clientes`, `/api/contratos`, `/api/colaboradores`, `/api/dfc`, `/api/churn-por-servico`, `/api/churn-por-responsavel`, `/api/inhire/*`, `/api/meta-ads/*`.

### Data Storage Solutions
- **Primary Database**: Google Cloud SQL (PostgreSQL) for all business data (clients, contracts, employees, financial records).
    - **Schema**: `caz_` tables for Conta Azul data (`caz_clientes`, `caz_parcelas`, `caz_categorias`), `cup_` tables for ClickUp data (`cup_clientes`, `cup_contratos`, `cup_data_hist`), `rh_pessoal` for employee data, `rh_candidaturas`/`rh_vagas`/`rh_talentos` for Inhire recruitment analytics, and `meta_*` tables for Meta Ads data (`meta_insights_daily`, `meta_campaigns`, `meta_adsets`, `meta_ads`, `meta_creatives`, `crm_deal`).
    - **Key Relationships**: CNPJ links Conta Azul and ClickUp client data. `caz_parcelas` stores hierarchical category data in `categoria_nome`.
    - **Category Names**: `caz_categorias` table contains official category names in format "CODE DESCRIPTION" (e.g., "06.10 Despesas Administrativas"). The `nome` field is parsed to extract code and description separately.
- **Authentication Database**: Replit Database for user authentication data (users, sessions).
- **ORM**: Drizzle ORM for Google Cloud SQL.

### Authentication & Authorization
- **Authentication**: Google OAuth2.0 via Passport.js, storing user data in Replit Database.
    - **Callback URL Strategy**: System automatically detects environment and uses appropriate callback URL:
        1. `CUSTOM_DOMAIN` (if set manually)
        2. `REPLIT_DOMAINS` (published/production domain - e.g., Turbodata.replit.app)
        3. `REPLIT_DEV_DOMAIN` (development domain - e.g., *.worf.replit.dev)
        4. `localhost:5000` (local fallback)
    - **Google Console Configuration**: Both callback URLs must be registered:
        - Development: `https://[REPLIT_DEV_DOMAIN]/auth/google/callback`
        - Production: `https://Turbodata.replit.app/auth/google/callback`
    - **Environment Variables**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` stored in Replit Secrets
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `user` roles.
    - `admin` (hardcoded for `caio.massaroni@turbopartners.com.br` and `warley.silva@turbopartners.com.br`) has full access to all routes.
    - `user` has limited `allowedRoutes` (default: `/ferramentas`).
- **Protected Routes**: Backend API routes secured with `isAuthenticated` and `isAdmin` middleware. Frontend routes protected by `ProtectedRoute` component.
- **Admin Interface**: `/admin/usuarios` allows managing user permissions and roles.
    - Admins can edit allowed routes for regular users
    - Admins can promote users to admin role (grants ALL_ROUTES)
    - Admins can demote admins to user role (resets to DEFAULT_USER_ROUTES)

## External Dependencies

### Third-Party UI Libraries
- Radix UI (various components)
- cmdk
- Recharts
- Embla Carousel
- Lucide React
- Google Fonts (Poppins)

### Utilities
- class-variance-authority (CVA)
- clsx, tailwind-merge
- date-fns
- nanoid

### Database & Session
- @neondatabase/serverless (for PostgreSQL connections to Google Cloud SQL)
- @replit/database (for user authentication data and sessions)
- express-session with custom ReplitSessionStore
- Passport.js with passport-google-oauth20
- Drizzle ORM, Drizzle Kit

### Development Tools
- Replit-specific Vite plugins (cartographer, dev-banner, runtime-error-modal)
- TypeScript
- ESM module system