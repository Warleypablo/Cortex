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
- **DFC (Demonstração de Fluxo de Caixa)**: Hierarchical cash flow analysis with expandable tree structure
  - Processes semicolon-separated category data from caz_parcelas (categoria_nome, valor_categoria)
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
- Storage abstraction layer (`IStorage`) for flexible implementation swapping
- API endpoints: /api/clientes, /api/contratos, /api/colaboradores, /api/dfc

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
- **Internal Tables**:
  - `rh_pessoal`: Employee/collaborator data with full HR information (25 fields)
  - `users`: Authentication data (not actively used)

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
- @neondatabase/serverless for PostgreSQL connections
- connect-pg-simple for PostgreSQL-backed session storage (configured but not actively used yet)
- Drizzle ORM and Drizzle Kit for database operations and migrations

**Development Tools**
- Replit-specific plugins for vite (cartographer, dev-banner, runtime-error-modal) for enhanced development experience on Replit platform
- TypeScript with strict mode for type safety
- ESM module system throughout the application

**Design Assets**
- Google Fonts (Poppins) for typography
- Generated avatar images stored in `attached_assets/generated_images/`

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
- Session management infrastructure is in place but not actively implemented
- Authentication and authorization mechanisms are defined in schema but not yet implemented in routes
- The design system emphasizes light mode as primary with dark mode support through CSS custom properties
- All UI icons use Lucide React - no emojis per design guidelines