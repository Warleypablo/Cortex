# CRM Dashboard - Marketing Digital

## Overview

This is a Customer Relationship Management (CRM) dashboard designed for a digital marketing agency. The application helps manage client relationships, contracts, services, and revenue tracking across different marketing squads (Performance, Comunicação, and Tech). It provides a centralized interface for viewing client data, contract status, invoicing, team assignments, and financial metrics.

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
- Client listing with filtering by squad and services
- Client detail pages showing contracts, invoices, team members, and revenue history
- Contract management with status tracking (Ativo, Onboard, Triagem, Cancelamento, Cancelado)
- Revenue visualization using Recharts for bar charts
- Responsive sidebar navigation with collapsible states
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
- In-memory storage implementation (`MemStorage`) for development/prototyping
- User CRUD operations with UUID-based identifiers
- Storage interface allows easy swapping to database-backed implementations

### Data Storage Solutions

**Database ORM**
- Drizzle ORM configured for PostgreSQL dialect
- Schema-first approach with TypeScript type inference
- Migration support through Drizzle Kit
- Connection to Neon serverless PostgreSQL (via `@neondatabase/serverless`)

**Schema Design**
- Users table with UUID primary keys, username (unique), and password fields
- Zod schemas generated from Drizzle tables for validation
- Type-safe insert and select operations

**Migration Strategy**
- Migrations stored in `/migrations` directory
- Database schema defined in `shared/schema.ts` for sharing between client and server
- Push-based deployment with `db:push` script for rapid iteration

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

- The application currently uses mock data in the frontend (see `//todo: remove mock functionality` comments in Clients.tsx, ClientDetail.tsx, and Contracts.tsx)
- Session management infrastructure is in place but not actively implemented
- The storage layer uses in-memory implementation; migration to PostgreSQL-backed storage is expected
- Authentication and authorization mechanisms are defined in schema but not yet implemented in routes
- The design system emphasizes light mode as primary with dark mode support through CSS custom properties