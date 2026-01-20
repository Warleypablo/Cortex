# Turbo Cortex - Plataforma Interna Turbo Partners

## Overview

Turbo Cortex is the exclusive internal platform for the Turbo Partners team, centralizing client relationships, contracts, services, and revenue. It integrates financial data from Conta Azul (ERP) and operational data from ClickUp to provide a unified view of client information, contract statuses, billing, team assignments, and financial metrics across marketing squads. The project aims to enhance client management, financial tracking, and retention analysis, thereby improving business intelligence and operational efficiency.

## User Preferences

Preferred communication style: Simple, everyday language.

### Development Rules (MANDATORY)

1.  **External Database Only**: Never use Replit's internal database. All database connections must use the external PostgreSQL via `DB_HOST` environment variable (Google Cloud SQL).
2.  **Schema Organization**: Database tables are organized by source system:
    -   `cortex_core` - Core Cortex platform tables (formerly staging)
    -   `"Clickup"` - ClickUp integration tables (cup_* tables) - requires double quotes
    -   `"Conta Azul"` - Conta Azul ERP tables (caz_* tables) - requires double quotes
    -   `"Bitrix"` - Bitrix CRM tables (crm_* tables) - requires double quotes
    -   `"Inhire"` - Inhire HR tables (rh_* tables) - requires double quotes
    -   `sys` - Canonical data governance layer
3.  **Security First**: Never expose credentials outside of environment variables (`process.env`). All API keys, database passwords, and secrets must be stored in `.env` or Replit Secrets. No hardcoded credentials in code under any circumstances.
4.  **Database Design Standards**:
    -   Create tables with clear purpose and meaningful names
    -   Design for easy relationships with existing tables (use consistent foreign key patterns)
    -   Build for scalability from the start (proper indexing, normalized structure)
    -   Avoid creating redundant or throwaway tables
    -   Follow existing naming conventions (snake_case for columns, tables organized by schema prefix)
5.  **Database Documentation Reference**: Before any database intervention or query, consult the documentation files in `attached_assets/Estrutura_Banco/`:
    -   `funcao_colunas_tabelas_*.pdf` — Column definitions and table functions
    -   `relacionamento_tabelas_*.pdf` — Table relationships and foreign keys

    These files contain the authoritative schema reference for understanding how tables connect and what each column represents.

**⚠️ CRITICAL**: Violating any of the above rules results in immediate replacement by Lovable. No exceptions.

## System Architecture

### Frontend Architecture

-   **Framework**: React 18 with TypeScript, Vite, and Wouter for routing.
-   **UI/UX**: shadcn/ui, Radix UI, Tailwind CSS, custom color palette (vibrant orange, dark backgrounds), Poppins font, and Lucide React icons.
-   **State Management**: TanStack Query for server state; React hooks for local state.
-   **Form Handling**: React Hook Form with Zod for validation.
-   **Theming**: Dark mode support (light mode is primary).
-   **Key Features**:
    -   **Dashboards**: Client Management, Employee Management, Contract Management, Retention Analysis, DFC (Cash Flow), Inhire Recruitment Analytics, Recruitment Analytics, Visão Geral (Overview), Meta Ads Analytics, Growth Visão Geral, Criativos (Creatives), Performance por Plataforma, G&G (People Management), OKR 2026.
    -   **Detail Pages**: Commercial SDR/Closer performance, Meu Perfil (My Profile) linked to employee details.
    -   **Modules**: Jurídico (Legal) for delinquency tracking, Patrimônio (Assets) for physical assets and phone lines.
    -   **Configurable UI**: Criativos and Performance por Plataforma dashboards feature user-configurable conditional formatting rules stored in the database.

### Backend Architecture

-   **Server**: Express.js with TypeScript.
-   **API**: RESTful API using Drizzle ORM for PostgreSQL.
-   **Security**: Drizzle `sql` template literals and `sql.join()` for SQL injection prevention.

### Data Storage Solutions

-   **Primary Database**: Google Cloud SQL (PostgreSQL) for all business data.
-   **Authentication Database**: Replit Database for user authentication data.
-   **ORM**: Drizzle ORM for Google Cloud SQL.

### Authentication & Authorization

-   **Authentication**: Google OAuth2.0 via Passport.js, storing user data in Replit Database.
-   **Authorization**: Role-Based Access Control (RBAC) with `admin` and `user` roles and hierarchical permission keys.
-   **Access Profiles**: Four standardized profiles: Base, Time, Líder, Control Tower.
-   **Protected Routes**: Backend API routes secured with middleware; frontend routes protected by `ProtectedRoute` component.
-   **Admin Interface**: `/admin/usuarios` for user permission management.
-   **Conexões (Connections Tab)**: Admin panel showing real-time status of database, OpenAI API, and Google OAuth integrations.

### Canonical Data Layer (sys schema)

-   **Purpose**: Standardized data governance for mapping raw data to canonical slugs.
-   **Schema Structure**: `sys.catalogs`, `sys.catalog_items`, `sys.catalog_aliases`, `sys.system_fields`, `sys.validation_rules`.
-   **Catalogs Defined**: Contract status, products, squads, clusters, account health, churn reasons.
-   **Canonical View**: `public.vw_contratos_canon` maps raw contract data to canonical slugs.
-   **API Endpoints**: Admin-only endpoints for managing catalogs, items, aliases, and testing the canonical view.

## External Dependencies

### Third-Party UI Libraries

-   Radix UI
-   cmdk
-   Recharts
-   Embla Carousel
-   Lucide React
-   Google Fonts

### Utilities

-   class-variance-authority (CVA)
-   clsx, tailwind-merge
-   date-fns
-   nanoid

### Database & Session

-   @neondatabase/serverless (PostgreSQL connections)
-   @replit/database (authentication data)
-   express-session with custom ReplitSessionStore
-   Passport.js with passport-google-oauth20
-   Drizzle ORM, Drizzle Kit

### Development Tools

-   Replit-specific Vite plugins
-   TypeScript
-   ESM module system