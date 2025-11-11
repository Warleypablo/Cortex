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
    - **Client Management**: Integrated client listing from Conta Azul and ClickUp, with search, filter, pagination, and sortable columns. Includes LTV (Lifetime Value) and LT (Lifetime) metrics.
    - **LT (Lifetime) Calculation**: LT represents "meses ativos" (active months) - the count of distinct months with paid revenue (status PAGO or ACQUITTED) from `caz_receber` table. Uses `COALESCE(data_vencimento, data_criacao)` to determine the month. Displayed consistently in both the client list table and individual client detail pages.
    - **Employee Management**: CRUD operations for 25 employee fields from `rh_pessoal` table.
    - **Contract Management**: Comprehensive tracking from `cup_contratos`, displaying service type, status, squad, and financial values. Includes status-based color coding.
    - **Retention Analysis**: Churn metrics by service and responsible person with monthly breakdowns, filtering, and Recharts visualizations. Secure parameter binding prevents SQL injection.
    - **DFC (Demonstração de Fluxo de Caixa)**: Hierarchical cash flow analysis from `caz_parcelas` with expandable tree structure, month range filters, pivot table display, and sticky first column (categoria) for horizontal scrolling. Uses `valor_pago` with proportional distribution for parcelas with multiple categories.
- **Theming**: Dark mode support via CSS variables; light mode is primary.

### Backend Architecture
- **Server**: Express.js with TypeScript, using Node's native `http` module.
- **API**: RESTful API (`/api` prefix) with middleware for JSON parsing, URL encoding, and logging.
- **Data Access**: Drizzle ORM for PostgreSQL, with an `IStorage` abstraction layer.
- **Security**: Drizzle `sql`` template literals and `sql.join()` for all user-supplied parameters to prevent SQL injection.
- **API Endpoints**: `/api/clientes`, `/api/contratos`, `/api/colaboradores`, `/api/dfc`, `/api/churn-por-servico`, `/api/churn-por-responsavel`.

### Data Storage Solutions
- **Primary Database**: Google Cloud SQL (PostgreSQL) for all business data (clients, contracts, employees, financial records).
    - **Schema**: `caz_` tables for Conta Azul data (`caz_clientes`, `caz_parcelas`, `caz_categorias`), `cup_` tables for ClickUp data (`cup_clientes`, `cup_contratos`), and `rh_pessoal` for employee data.
    - **Key Relationships**: CNPJ links Conta Azul and ClickUp client data. `caz_parcelas` stores hierarchical category data in `categoria_nome`.
    - **Category Names**: `caz_categorias` table contains official category names in format "CODE DESCRIPTION" (e.g., "06.10 Despesas Administrativas"). The `nome` field is parsed to extract code and description separately.
- **Authentication Database**: Replit Database for user authentication data (users, sessions).
- **ORM**: Drizzle ORM for Google Cloud SQL.

### Authentication & Authorization
- **Authentication**: Google OAuth2.0 via Passport.js, storing user data in Replit Database.
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `user` roles.
    - `admin` (hardcoded for `caio.massaroni@turbopartners.com.br` and `warley.silva@turbopartners.com.br`) has full access.
    - `user` has limited `allowedRoutes`.
- **Protected Routes**: Backend API routes secured with `isAuthenticated` and `isAdmin` middleware. Frontend routes protected by `ProtectedRoute` component.
- **Admin Interface**: `/admin/usuarios` allows managing user permissions.

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