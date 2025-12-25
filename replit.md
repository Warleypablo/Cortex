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
    - **OKR 2026 Module**: Strategic objectives and key results tracking for "Bigger & Better — Consolidação, Escala e Padronização" plan. Features:
      - **5 Objectives**: O1 Ecosystem Scale, O2 Efficiency/Cash, O3 Hugz Retention, O4 TurboOH Scale, O5 Systems/Tech
      - **22 KRs** with BP 2026 targets (MRR R$2.1M Q4, Revenue R$20M, EBITDA R$5.3M, etc.)
      - **28 Metrics** across 6 categories (company, turbooh, hugz, sales, tech, people)
      - **18 Initiatives** with standardized model (krIds, successMetricKeys, ownerRole)
      - **3 Tabs**: Dashboard (hero cards, TurboOH block, Vendas block, charts), KRs (status colors, filters), Initiatives (status chips, KR mapping)
      - **Config-driven registry**: okrRegistry.ts as single source of truth
      - **5-min cache**: In-memory caching for /api/okr2026/* endpoints
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
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `user` roles. `admin` has full access; `user` has limited `allowedRoutes`.
- **Protected Routes**: Backend API routes secured with middleware; frontend routes protected by `ProtectedRoute` component.
- **Admin Interface**: `/admin/usuarios` for managing user permissions and roles.

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