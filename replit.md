# Turbo Cortex - Plataforma Interna Turbo Partners

## Overview

Turbo Cortex é a plataforma interna exclusiva da equipe Turbo Partners, oferecendo uma visão unificada de relacionamento com clientes, contratos, serviços e receita. Integra dados financeiros do Conta Azul (ERP) e dados operacionais do ClickUp, centralizando informações de clientes, status de contratos, faturamento, atribuições de equipe e métricas financeiras entre diferentes squads de marketing. O projeto visa melhorar a gestão de clientes, acompanhamento financeiro e análise de retenção para aprimorar a inteligência de negócios e eficiência operacional.

## Branding

- **Nome da Plataforma**: Turbo Cortex
- **Logo**: attached_assets/Logo-Turbo-branca_(1)_1766081013390.png
- **Paleta de Cores**: Baseada na identidade visual da Turbo Partners (turbopartners.com.br)
  - Primary: Laranja vibrante (HSL 24 95% 53%)
  - Background: Tons escuros sofisticados
  - Accent: Variações quentes do laranja

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, Vite, and Wouter for routing.
- **UI/UX**: shadcn/ui, Radix UI, Tailwind CSS, custom color palette, Poppins font, and Lucide React icons, inspired by modern CRM interfaces.
- **State Management**: TanStack Query for server state; React hooks for local state.
- **Form Handling**: React Hook Form with Zod for validation.
- **Key Features**:
    - **Client Management**: Integrated client listing with LTV, LT (active months based on paid revenue), and AOV calculations. Includes service icons with tooltips and contract type filtering (Recorrente/Pontual).
    - **Employee Management**: CRUD operations for employees with bidirectional linking to assets.
    - **Contract Management**: Comprehensive tracking from ClickUp, including status-based color coding, squad assignment, financial values, and AOV Médio calculation.
    - **Retention Analysis**: Churn metrics by service and responsible person with monthly breakdowns and Recharts visualizations.
    - **DFC (Demonstração de Fluxo de Caixa)**: Hierarchical cash flow analysis with expandable tree structure, month range filters, and pivot table display.
    - **Inhire Recruitment Analytics**: Sub-dashboard under HR displaying recruitment KPIs, status/stage/source distribution, conversion funnel, and vacancy tracking.
    - **Recruitment Analytics Dashboard**: Advanced dashboard with funnel analysis, hunting vs. passive sourcing metrics, and per-vacancy conversion tracking across multiple tabs.
    - **Visão Geral Dashboard**: Overview page with MRR metrics (active MRR, acquisitions, churn), rankings, and evolution charts using a hybrid data strategy (snapshots and event-based).
    - **Meta Ads Analytics Dashboard**: Correlates Meta Ads data with CRM conversion tracking, including UTM mapping for attribution at campaign and adset levels. Features KPI cards, conversion funnel, and analysis tabs for campaigns, adsets, ads, and creatives.
    - **Growth Visão Geral Dashboard**: Cross-references Meta Ads and Google Ads investment data with Bitrix CRM deals using utm_content (Meta) and utm_campaign (Google) as relationship keys. Displays KPIs for Negócios Ganhos, Valor Vendas, CAC, ROI, and ROAS with Canal filter support.
    - **Criativos Dashboard (Growth)**: Creative performance analysis with configurable conditional formatting. Users can define threshold ranges (min/max values) with color coding (red, orange, yellow, green, blue, purple) for metrics like CPMQL, CPL, CTR, CPM, Video Hook/Hold, etc. Configuration persists in database tables (metric_rulesets, metric_thresholds) via Sheet component UI.
    - **Performance por Plataforma Dashboard (Growth)**: Hierarchical tree view (Platform → Campaign → AdSet → Ad) with expandable/collapsible rows. Displays all Criativos metrics except Video Hook/Hold. Supports date range and status (Ativo/Pausado/Todos) filters. Uses same conditional formatting rules as Criativos page via metric_rulesets.
    - **Commercial SDR/Closer Detail Pages**: Detailed analytics for individual sales team members, including performance metrics, source/pipeline distribution, and trend analysis (DetailClosers.tsx and DetailSDRs.tsx).
    - **Jurídico (Legal) Dashboard**: Legal department module for tracking clients with "cobrar" (collect) status from inadimplência (delinquency) system. Features client accordion list with full details, overdue parcelas table, and legal procedure management (notificação, protesto, ação judicial, acordo, baixa). Data stored in `juridico_clientes` table with tracking for procedure type, status, agreement details, and protocol numbers.
    - **Patrimônio (Assets)**: Asset management with two tabs - "Patrimônios" for physical assets and "Linhas Telefônicas" for phone lines. Phone lines tab includes: conta, plano/operadora (Pós/Pré/Flex), telefone, responsável, setor, última recarga, and status. Features filters by setor and plano, search, and stats cards. Data stored in `rh_telefones` table with responsável linking to colaboradores.
    - **Meu Perfil (My Profile)**: Personal profile page that redirects authenticated users to their linked colaborador detail page (/colaborador/:id). If user email is not linked to a colaborador record, displays a friendly "Perfil não vinculado" message. Links via /api/colaboradores/by-user/:userId endpoint.
    - **G&G Dashboard (DashboardGeG)**: Comprehensive people management dashboard with:
      - **KPIs**: Headcount, turnover, admissões/demissões, tempo médio, custo folha, benefícios, premiação, salário médio
      - **Alertas e Atenção**: Veteranos sem aumento (36+ meses), fim de experiência, salário abaixo da média
      - **Retenção e Saúde**: Taxa de retenção por período, distribuição de health scores (saudável/atenção/crítico)
      - **Distribuição Geográfica**: Análise por estado, Grande Vitória (Vitória, Vila Velha, Serra, Cariacica), presencial vs remoto
      - **Visualizações**: Evolução headcount, pessoas por setor, custo por setor, tempo de casa, demissões por tipo
      - **Tabelas**: Distribuição por squad/cargo/nível, aniversariantes, más contratações, últimas promoções
    - **OKR 2026 Module**: Strategic objectives and key results tracking for "Bigger & Better — Consolidação, Escala e Padronização" plan. Features:
      - **5 Objectives**: O1 Ecossistema, O2 Eficiência & Sistemas, O3 Saúde da Receita (Hugz), O4 TurboOH, O5 Padronização & Produto
      - **18 KRs** with quarterly targets (Q1-Q4) using KRDef schema: metricKey, aggregation (quarter_end/sum/avg), direction (gte/lte), unit (BRL/PCT/COUNT)
      - **25 Initiatives** with mandatory owner_email field, resolved via /api/okr2026/collaborators from rh_pessoal table
      - **3 Tabs**: Dashboard (6 hero cards + TurboOH block + Hugz block), KRs (Q1-Q4 columns with status colors), Initiatives (owner resolution + filters)
      - **4 API Endpoints**: /summary (with quarterSummary), /quarter-summary, /collaborators, /metric-series
      - **Quarter Aggregation**: getQuarterAgg() with 5 types (quarter_end/sum/avg/max/min), getMetricSeries() for monthly data
      - **Status Colors**: gte direction (Green ≥100%, Yellow 90-99%, Red <90%), lte direction (Green ≤target, Yellow +10%, Red >+10%)
      - **Config-driven registry**: okrRegistry.ts as single source of truth with 18 KRs
      - **5-min cache**: In-memory caching for all /api/okr2026/* endpoints
      - **Read-only**: No DB writes, uses existing tables (cup_data_hist, caz_parcelas, rh_pessoal, etc.)
- **Theming**: Dark mode support; light mode is primary.

### Backend Architecture
- **Server**: Express.js with TypeScript.
- **API**: RESTful API using Drizzle ORM for PostgreSQL.
- **Security**: Drizzle `sql` template literals and `sql.join()` for SQL injection prevention.

### Data Storage Solutions
- **Primary Database**: Google Cloud SQL (PostgreSQL) for all business data (clients, contracts, employees, financial records, recruitment, Meta Ads data).
- **Authentication Database**: Replit Database for user authentication data (users, sessions).
- **ORM**: Drizzle ORM for Google Cloud SQL.

### Authentication & Authorization
- **Authentication**: Google OAuth2.0 via Passport.js, storing user data in Replit Database. Supports dynamic callback URLs for development and production environments.
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `user` roles. `admin` has full access; `user` has limited permissions.
- **Permission System**: Hierarchical permission keys (e.g., 'general.profile', 'fin.dfc', 'ops.clientes_contratos') defined in `shared/nav-config.ts`.
- **Access Profiles**: Four standardized profiles for quick permission assignment:
  - **Base**: Basic access (Geral module only)
  - **Time**: Business operations (without sensitive financial areas)
  - **Líder**: Full access except Financeiro
  - **Control Tower**: Full system access
- **Navigation Structure**: Organized into categories: Acesso Rápido (shortcuts), Geral (general tools), Setores (Financeiro/Operação/Tech/Comercial/Growth), G&G (Pessoas), Governança (Jurídico/Reports), Administração.
- **Backward Compatibility**: Helper functions `routesToPermissions()` and `permissionsToRoutes()` maintain compatibility with legacy route-based allowedRoutes.
- **Protected Routes**: Backend API routes secured with middleware; frontend routes protected by `ProtectedRoute` component.
- **Admin Interface**: `/admin/usuarios` for managing user permissions using the new profile selector or granular permission checkboxes.
- **Conexões (Connections Tab)**: Admin panel tab showing real-time status of system integrations:
  - **Database**: Google Cloud SQL (PostgreSQL) connection status with latency
  - **OpenAI API**: Connection status with latency (uses OPENAI_API_KEY secret)
  - **Google OAuth**: Configuration status (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
  - Refresh button for manual status check, color-coded badges (green/red/yellow)

### Canonical Data Layer (sys schema)
The system includes a canonical data layer in the `sys` PostgreSQL schema for standardized data governance:

- **Schema Structure**: 5 tables in `sys` schema
  - `sys.catalogs`: Master catalog definitions (catalog_key PK)
  - `sys.catalog_items`: Catalog items with slugs (catalog_key + slug composite PK)
  - `sys.catalog_aliases`: Raw value to slug mappings for data normalization (catalog_key + alias composite PK)
  - `sys.system_fields`: Field definitions with types, requirements, and enum references
  - `sys.validation_rules`: Business rule definitions as JSONB

- **Catalogs Defined**:
  - `catalog_contract_status`: Contract lifecycle statuses (ativo, em_cancelamento, cancelado, pausado, em_implantacao)
  - `catalog_products`: Service products (social_media, performance, inbound, etc.)
  - `catalog_squads`: Team squads with emoji alias support for ClickUp data
  - `catalog_clusters`: Client segmentation clusters
  - `catalog_account_health`: Account health statuses
  - `catalog_churn_reason`: Cancellation reason categories

- **Canonical View**: `public.vw_contratos_canon` maps raw cup_contratos data to canonical slugs via LEFT JOIN on sys.catalog_aliases with COALESCE fallback

- **API Endpoints** (Admin only):
  - `GET /api/admin/sys/catalogs` - List catalogs with item counts
  - `GET /api/admin/sys/catalog-items/:catalogKey` - List items with aliases
  - `GET /api/admin/sys/aliases/:catalogKey` - List all aliases for a catalog
  - `GET /api/admin/sys/test-view` - Sample from vw_contratos_canon with stats
  - `GET /api/admin/sys/unmapped` - Find raw values without matching aliases

- **Initialization**: All spec apply functions use `ON CONFLICT DO UPDATE` for idempotent reinitialization

## External Dependencies

### Third-Party UI Libraries
- Radix UI
- cmdk
- Recharts
- Embla Carousel
- Lucide React
- Google Fonts

### Utilities
- class-variance-authority (CVA)
- clsx, tailwind-merge
- date-fns
- nanoid

### Database & Session
- @neondatabase/serverless (PostgreSQL connections)
- @replit/database (authentication data)
- express-session with custom ReplitSessionStore
- Passport.js with passport-google-oauth20
- Drizzle ORM, Drizzle Kit

### Development Tools
- Replit-specific Vite plugins
- TypeScript
- ESM module system