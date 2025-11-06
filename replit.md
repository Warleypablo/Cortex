# CRM Dashboard - Marketing Digital

## Overview

This is a Customer Relationship Management (CRM) dashboard designed for a digital marketing agency. The application integrates data from two main systems: Conta Azul (financial ERP) and ClickUp (operational management), providing a unified view of client relationships, contracts, services, and revenue tracking across different marketing squads (Supreme, Forja, Squadra, and Chama). It centralizes client data, contract status, invoicing, team assignments, and financial metrics from both systems.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast hot module replacement
- Wouter for lightweight client-side routing (no React Router dependency)
- Single Page Application (SPA) architecture

**UI Component System**
- shadcn/ui components built on Radix UI primitives for accessible, customizable interface elements
- Tailwind CSS for utility-first styling with custom design tokens
- Design system follows modern SaaS patterns inspired by HubSpot/Salesforce CRM interfaces
- Poppins font family from Google Fonts for consistent typography
- Custom color palette with squad-specific accent colors (Performance: blue, Comunicação: purple, Tech: teal)

**State Management & Data Fetching**
- TanStack Query (React Query) for server state management, caching, and data synchronization
- Custom query client configuration with disabled automatic refetching to reduce unnecessary network calls
- Local component state using React hooks for UI interactions

**Form Handling**
- React Hook Form with Zod resolvers for type-safe form validation
- Drizzle-Zod for generating validation schemas from database models

**Key Features**
- **Client Management**: Integrated client listing with data from both Conta Azul and ClickUp
  - Displays ClickUp client names and squad assignments (Supreme, Forja, Squadra, Chama)
  - Search and filter by name or CNPJ
  - Pagination with configurable items per page
  - Sortable columns (name, squad, LTV, start date)
- **Employee Management**: Complete HR data display and CRUD operations
  - View all 25 employee fields from rh_pessoal table
  - Add new collaborators with form validation
  - Database persistence to Google Cloud SQL
- **Contract Management**: Comprehensive contract tracking with real database data
  - Displays contracts from cup_contratos with client information via JOIN
  - Shows service type, status, squad assignment, and financial values
  - Search and filter by service or client name
  - Sortable columns (service, client, status, squad, start date)
  - Distinguishes between recurring (valorr) and one-time (valorp) contract values
  - Squad mapping from codes (0-3) to names (Supreme, Forja, Squadra, Chama)
  - Status-based color coding for visual status tracking
- **Retention Analysis (Análise de Retenção)**: Comprehensive churn and retention metrics
  - **Churn by Service**: Aggregated churn metrics grouped by service type with monthly breakdown
    - Filter by service types and date range (month start/end)
    - Shows quantity of churned contracts, total value, percentage, and active value per month
    - Secure parameter binding using Drizzle sql`` template literals to prevent SQL injection
  - **Churn by Responsible Person**: Churn analysis grouped by client account responsible
    - Multi-select filters for services, squads, and responsible persons
    - Date range filters (month start/end) for focused analysis
    - Bar chart visualization using Recharts showing total churn value per responsible
    - Custom tooltip displaying: contract count, total churn value, churn percentage, active portfolio value
    - Secure query implementation using sql.join() with individual parameter binding
    - Aggregates data from cup_contratos joined with cup_clientes via id_task/task_id relationship
- **DFC (Demonstração de Fluxo de Caixa)**: Hierarchical cash flow analysis with expandable tree structure
  - Processes semicolon-separated category data from caz_parcelas (categoria_nome, valor_categoria)
  - **Data reference**: Uses `data_quitacao` field from caz_parcelas for date filtering and grouping
  - **Status filter**: Only includes parcelas with status='QUITADO' (settled/paid installments)
  - **Type aggregation**: RECEITA categories (03/04) only sum parcelas with tipo_evento='RECEITA'; DESPESA categories (05-08) only sum tipo_evento='DESPESA'
  - **Code extraction**: Hierarchical codes (e.g., "03", "06.05.01") are extracted from the beginning of categoria_nome field
  - Expected format: "CODE NAME" (e.g., "03.01.01 Receita de Serviços")
  - Hierarchical display: Receitas/Despesas → subcategories → details (based on category code patterns)
  - Code-based hierarchy: Categories starting with "03"/"04" = Receitas, "05"/"06"/"07"/"08" = Despesas
  - Category codes guide the hierarchy structure (e.g., 06.05.01: 06 → 06.05 → 06.05.01)
  - Automatic parent node creation and value aggregation up the hierarchy tree
  - Expandable/collapsible tree rows with ChevronRight/ChevronDown icons
  - Visual indentation (24px per level) to show hierarchy depth
  - Month range filters (mesInicio/mesFim) for flexible date filtering
  - Pivot table displaying hierarchical categories × months with aggregated values
  - KPI cards showing Total Categorias, Meses Analisados, and Valor Total
  - Backend builds complete hierarchy tree with parent/child relationships
  - Currency-formatted cells (R$) with "-" for empty values
- Client detail pages showing contracts, invoices, team members, and revenue history (in development)
- Revenue visualization using Recharts for bar charts (in development)
- No emojis in UI - uses Lucide React icons for all visual indicators
- Dark mode support through CSS variables

### Backend Architecture

**Server Framework**
- Express.js as the HTTP server with TypeScript
- HTTP server created using Node's native `http` module for WebSocket compatibility
- Middleware for JSON parsing, URL encoding, and request/response logging
- Custom error handling middleware for consistent error responses

**Development Environment**
- Vite middleware mode integration for seamless HMR during development
- Separate production build process bundling server code with esbuild
- Custom logging system with timestamps for API request tracking

**API Design**
- RESTful API structure (prefix: `/api`)
- Routes registered through centralized `registerRoutes` function
- Storage abstraction layer for data operations

**Current Implementation**
- `DbStorage` implementation connecting to Google Cloud SQL PostgreSQL
- Client queries with JOIN between caz_clientes and cup_clientes using CNPJ
- Contract queries with JOIN: cup_contratos → cup_clientes (via id_task/task_id) → caz_clientes (via CNPJ)
- Employee CRUD operations with full field support
- DFC queries processing semicolon-separated category fields with aggregation by categoria + mês
- Churn analysis queries using secure parameter binding with Drizzle sql`` template literals
- Storage abstraction layer (`IStorage`) for flexible implementation swapping
- API endpoints: /api/clientes, /api/contratos, /api/colaboradores, /api/dfc, /api/churn-por-servico, /api/churn-por-responsavel

**Security Practices**
- All user-supplied filter parameters use Drizzle sql`` template literals with parameter binding
- Array filters (services, squads, collaborators) expanded using sql.join() with individual sql fragments
- No raw string concatenation in SQL queries to prevent SQL injection vulnerabilities
- Date filters converted to ISO strings and bound as parameters

### Data Storage Solutions

**Database ORM**
- Drizzle ORM configured for PostgreSQL dialect
- Schema-first approach with TypeScript type inference
- Connection to Google Cloud SQL PostgreSQL instance (database: dados_turbo)
- Credentials stored in Replit Secrets (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)

**Schema Design**
- **Conta Azul Tables (caz_*)**: Financial and client data from Conta Azul ERP
  - `caz_clientes`: Client master data with CNPJ as relationship key
  - `caz_receber`: Accounts receivable/invoices
  - `caz_pagar`: Accounts payable
  - `caz_parcelas`: Detailed installment/payment information with category tracking
    - `categoria_id`, `categoria_nome`, `valor_categoria`: Text fields storing semicolon-separated values for multi-category support
    - `categoria_id` contains UUIDs (not used for hierarchy)
    - `categoria_nome` contains hierarchical code + name (e.g., "06.05.01 Salários")
    - Hierarchical codes are extracted from the beginning of `categoria_nome` using regex pattern: `^([\d.]+)\s+(.+)$`
    - Example: categoria_nome="03.01.01 Receita de Serviços;04.02 Outras Receitas", valor_categoria="50000;5000"
- **ClickUp Tables (cup_*)**: Operational client and contract data from ClickUp
  - `cup_clientes`: Client operational data with CNPJ as primary key
  - `cup_contratos`: Contract details with squad assignments
- **Internal Tables (Google Cloud SQL)**:
  - `rh_pessoal`: Employee/collaborator data with full HR information (25 fields)
- **Replit Database**: User authentication data (separate from Google Cloud SQL)
  - User records stored with prefix `user:{id}` containing: id, googleId, email, name, picture, createdAt
  - Google ID index stored with prefix `googleId:{googleId}` for fast lookups
  - Session data stored with prefix `session:{sid}` using custom ReplitSessionStore
  - Sessions persist across server restarts with 7-day expiration

**Data Integration Strategy**
- CNPJ field used as relationship key between Conta Azul and ClickUp systems
- LEFT JOIN queries combine `caz_clientes` with `cup_clientes` on CNPJ
- Client names preferentially displayed from ClickUp (`cup_clientes.nome`) over Conta Azul
- Squad information sourced from ClickUp with mapping: 0=Supreme, 1=Forja, 2=Squadra, 3=Chama
- Storage layer returns `ClienteCompleto` type combining both systems' data

### External Dependencies

**Third-Party UI Libraries**
- Radix UI primitives (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, popover, select, switch, tabs, toast, tooltip, and more) for accessible component foundations
- cmdk for command palette functionality
- Recharts for data visualization and charting
- Embla Carousel for carousel/slider components
- Lucide React for consistent iconography

**Utilities**
- class-variance-authority (CVA) for variant-based component styling
- clsx and tailwind-merge for conditional class name composition
- date-fns for date manipulation and formatting
- nanoid for generating unique identifiers

**Database & Session**
- @neondatabase/serverless for PostgreSQL connections to Google Cloud SQL
- @replit/database for user authentication data and session persistence (separate from business data)
- express-session with custom ReplitSessionStore for persistent session management
- Passport.js with passport-google-oauth20 for Google OAuth authentication
- Drizzle ORM and Drizzle Kit for database operations and migrations on Google Cloud SQL

**Development Tools**
- Replit-specific plugins for vite (cartographer, dev-banner, runtime-error-modal) for enhanced development experience on Replit platform
- TypeScript with strict mode for type safety
- ESM module system throughout the application

**Design Assets**
- Google Fonts (Poppins) for typography
- Generated avatar images stored in `attached_assets/generated_images/`

## Authentication & Authorization

**Dual-Database Architecture**
- **Google Cloud SQL (PostgreSQL)**: Stores all business data (clients, contracts, employees, financials)
- **Replit Database**: Stores only user authentication data (users, sessions)
- This separation ensures authentication data is isolated from business operational data

**Google OAuth Flow**
1. User clicks "Continuar com Google" on `/login` page
2. Redirects to `/auth/google` which initiates Google OAuth flow
3. Google redirects back to `/auth/google/callback` with authorization code
4. Server exchanges code for user profile (email, name, picture)
5. User created/updated in Replit Database with Google profile data
6. Session established and user redirected to dashboard

**Protected Routes**
- All `/api/*` routes require authentication via `isAuthenticated` middleware
- Frontend checks authentication status via `/api/auth/me` endpoint
- Unauthenticated users automatically redirected to `/login` page
- Session persists for 7 days with secure cookies

**User Interface**
- Login page: Clean card design with Google OAuth button
- TopBar: Displays user avatar (from Google profile) and name
- Logout dropdown: Shows user email and logout option
- All user data (name, email, picture) sourced from Google OAuth profile

**Configuration**
- Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Replit Secrets
- Authorized Redirect URI displayed in server logs on startup
- Example: `https://{REPLIT_DEV_DOMAIN}/auth/google/callback`

## Notes

- **Data Sources**: Application integrates two primary systems:
  - Conta Azul: Financial ERP with client master data, invoices, payments
  - ClickUp: Operational CRM with client names, squads, contracts
- **Key Relationships**:
  - Between systems: CNPJ field links caz_clientes ↔ cup_clientes
  - Within Conta Azul: `caz_receber.cliente_id` ↔ `caz_clientes.ids`
  - Within Conta Azul: `caz_parcelas.id_cliente` ↔ `caz_clientes.ids`
  - Within ClickUp: `cup_contratos.id_task` ↔ `cup_clientes.task_id`
- **Squad Mapping**: ClickUp squad codes map to names (0=Supreme, 1=Forja, 2=Squadra, 3=Chama)
- The design system emphasizes light mode as primary with dark mode support through CSS custom properties
- All UI icons use Lucide React - no emojis per design guidelines