# CRM Dashboard - Marketing Digital

## Overview

This project is a Customer Relationship Management (CRM) dashboard for a digital marketing agency. Its primary purpose is to provide a unified view of client relationships, contracts, services, and revenue by integrating data from Conta Azul (financial ERP) and ClickUp (operational management). The dashboard centralizes client data, contract status, invoicing, team assignments across different marketing squads (Supreme, Forja, Squadra, Chama), and financial metrics to enhance client management and retention analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript, Vite, and Wouter for routing.
- **UI Component System**: shadcn/ui built on Radix UI, styled with Tailwind CSS, following modern SaaS design patterns. Uses Poppins font and a custom color palette with squad-specific accents.
- **State Management & Data Fetching**: TanStack Query for server state, caching, and synchronization.
- **Form Handling**: React Hook Form with Zod resolvers for type-safe validation.
- **Authentication & Authorization**: Google OAuth with domain restriction (`@turbopartners.com.br`), PostgreSQL-backed session store, and role-based access control (Super Admin, Regular Users) with page-level permissions. Protected routes redirect unauthorized access.
- **Key Features**:
    - **Client Management**: Integrated client listing from Conta Azul and ClickUp, with search, filter, pagination, and sortable columns.
    - **Employee Management**: CRUD operations for employee HR data.
    - **Contract Management**: Tracks contracts from ClickUp, displaying service type, status, squad, and financial values. Includes status-based color coding.
    - **Retention Analysis (Análise de Retenção)**: Comprehensive churn and retention metrics by service and responsible person, with filtering and Recharts visualizations.
    - **DFC (Demonstração de Fluxo de Caixa)**: Hierarchical cash flow analysis with an expandable tree structure, processing semicolon-separated category data from Conta Azul. Features month range filters and a pivot table display.
- **UI/UX**: No emojis, uses Lucide React icons, and supports dark mode.

### Backend Architecture
- **Server Framework**: Express.js with TypeScript, using Node's native `http` module.
- **API Design**: RESTful API structure (`/api` prefix) with centralized route registration.
- **Current Implementation**: `DbStorage` connects to Google Cloud SQL PostgreSQL. Includes API endpoints for clients, contracts, employees, DFC, and churn analysis.
- **Security Practices**: Uses Drizzle ORM's `sql`` template literals and `sql.join()` for secure parameter binding, preventing SQL injection.

### Data Storage Solutions
- **Database ORM**: Drizzle ORM for PostgreSQL, connected to Google Cloud SQL. Credentials managed via Replit Secrets.
- **Schema Design**:
    - **Conta Azul Tables (`caz_*`)**: Financial and client data (`caz_clientes`, `caz_receber`, `caz_pagar`, `caz_parcelas`). `caz_parcelas` stores hierarchical category data in `categoria_nome` (e.g., "06.05.01 Salários").
    - **ClickUp Tables (`cup_*`)**: Operational client and contract data (`cup_clientes`, `cup_contratos`).
    - **Internal Tables**: `rh_pessoal` (employee data), `users` (authentication data including Super Admin flag), `sessions` (session storage), `user_page_permissions` (page-level access control).
- **Data Integration Strategy**: CNPJ is the key for linking `caz_clientes` and `cup_clientes`. Squad information is sourced from ClickUp with a defined mapping (0=Supreme, 1=Forja, etc.).

## External Dependencies

- **Third-Party UI Libraries**: Radix UI (various components), cmdk, Recharts, Embla Carousel, Lucide React.
- **Utilities**: class-variance-authority (CVA), clsx, tailwind-merge, date-fns, nanoid.
- **Database & Session**: @neondatabase/serverless, connect-pg-simple (PostgreSQL session store), Drizzle ORM, Drizzle Kit.
- **Authentication**: Replit Auth integration with Google OAuth, openid-client for OAuth flow.
- **Development Tools**: Replit-specific Vite plugins (cartographer, dev-banner, runtime-error-modal), TypeScript.
- **Design Assets**: Google Fonts (Poppins).

## Authentication Flow

1. **User Access**: User attempts to access the application
2. **Authentication Check**: AuthGuard verifies if user is authenticated via `/api/auth/user` endpoint
3. **OAuth Redirect**: If not authenticated, user is redirected to `/api/login` which initiates Google OAuth
4. **Domain Validation**: OAuth callback validates email domain is `@turbopartners.com.br`
5. **User Creation/Update**: On successful OAuth, user data is upserted in database with `is_super_admin` flag set for caio.massaroni@turbopartners.com.br
6. **Default Permissions**: New users automatically receive access to `/ferramentas` page only
7. **Session Storage**: User session stored in PostgreSQL sessions table
8. **Authorization**: Each protected route checks user permissions via `user_page_permissions` table
9. **Access Control**: Unauthorized attempts redirect to `/acesso-negado` page
10. **Super Admin**: Super Admin has full access to all pages and can manage user permissions via `/usuarios` page