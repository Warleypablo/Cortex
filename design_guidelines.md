# Design Guidelines - CRM Dashboard de Marketing Digital

## Design Approach

**Selected Approach**: Design System (Tailwind + Modern SaaS Pattern)
**Reference**: HubSpot/Salesforce CRM interfaces - clean, data-focused, professional
**Key Principles**: Clarity, efficiency, data hierarchy, professional aesthetics

## Core Design Elements

### A. Color Palette

**Light Mode (Primary)**
- Primary Brand: `210 79% 47%` (Professional blue for primary actions, links, active states)
- Secondary: `0 0% 77%` (Gray for borders, dividers, disabled states)
- Background: `0 0% 94%` (Light gray page background)
- Surface/Cards: `0 0% 99%` (White cards and elevated surfaces)
- Text Primary: `0 0% 10%` (Almost black for headings and body)
- Text Secondary: `0 0% 45%` (Medium gray for labels and metadata)

**Accent Colors for Squads/Services**
- Performance Squad: `210 79% 47%` (Use primary blue)
- Comunicação Squad: `280 60% 55%` (Purple)
- Tech Squad: `150 50% 45%` (Teal/Green)

**Status & Feedback**
- Success: `142 71% 45%` (Green for active contracts)
- Warning: `38 92% 50%` (Orange for pending items)
- Error: `0 84% 60%` (Red for inactive/alerts)
- Info: `210 79% 47%` (Use primary)

### B. Typography

**Font Family**: Poppins (Google Fonts)
- Headings: Poppins 600 (Semibold)
- Body: Poppins 400 (Regular)
- Labels/UI: Poppins 500 (Medium)

**Type Scale**
- Page Title (h1): text-3xl (30px) font-semibold
- Section Headers (h2): text-2xl (24px) font-semibold
- Card Titles (h3): text-xl (20px) font-semibold
- Big Numbers: text-4xl (36px) font-bold
- Body Text: text-base (16px)
- Small Text/Labels: text-sm (14px)
- Metadata/Captions: text-xs (12px) text-gray-500

### C. Layout System

**Spacing Primitives**: Use Tailwind units of 1, 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card spacing: p-6
- Table cell padding: px-4 py-3
- Grid gaps: gap-4 to gap-6

**Container System**
- Page wrapper: max-w-7xl mx-auto px-4 to px-8
- Card max-width: Full width within container
- Content columns: 12-column grid system

**Responsive Breakpoints**
- Mobile: base (< 768px) - Single column, stacked filters
- Tablet: md (768px+) - 2-column grids where appropriate
- Desktop: lg (1024px+) - Full multi-column layouts
- Wide: xl (1280px+) - Maximum layout expansion

### D. Component Library

**Navigation**
- Sidebar: w-64, fixed, bg-white shadow with navigation links
- Top bar: Sticky header with search, notifications, user profile
- Tabs: Underline style with primary color indicator

**Cards & Surfaces**
- Standard card: bg-white rounded-2xl shadow-sm p-6
- Hover state: hover:shadow-md transition-shadow
- Border radius: rounded-2xl (1rem) for all cards

**Big Numbers Dashboard**
- Container: Grid of 3-4 cards with large metric display
- Number: text-4xl font-bold text-primary
- Label: text-sm text-gray-500 uppercase tracking-wide
- Trend indicator: Small arrow icon with percentage change

**Data Tables**
- Header: bg-gray-50 border-b border-gray-200
- Row hover: hover:bg-gray-50 transition-colors
- Cell padding: px-4 py-3
- Sortable columns: Cursor pointer with arrow indicators
- Striped rows: Alternate bg-gray-25 (very subtle)

**Filters Panel**
- Sticky position on desktop (top-20)
- Checkboxes for squad/services with emoji indicators (📊 💬 💻)
- Clear visual grouping with section headers
- Apply/Reset buttons at bottom

**Search Input**
- Prominent position in header or above table
- Icon prefix (magnifying glass)
- Placeholder: "Buscar clientes..."
- Real-time filtering with highlight

**Client Detail Page**
- Hero section: Client name, squad badge, status indicator
- Tab navigation: Contratos, Serviços, Equipe, Faturamento
- Contract cards: Grid layout showing modalidade, valor, datas
- Team members: Avatar grid with name and role
- Chart component: Bar/line chart for faturamento histórico using Chart.js

**Service Emoji System**
- Performance: 📊 (data/analytics)
- Comunicação: 💬 (messaging/content)
- Tech: 💻 (technology/development)
- Display as pill badges with emoji + label

**Status Badges**
- Recorrente: Green badge with dot indicator
- Pontual: Blue badge with dot indicator
- Inactive: Red badge with dot indicator
- Style: px-3 py-1 rounded-full text-xs font-medium

### E. Interactions & States

**Hover States**
- Table rows: Subtle background change
- Cards: Elevation increase (shadow)
- Buttons: Darken primary color 10%
- Links: Underline decoration

**Loading States**
- Skeleton loaders for tables/cards
- Spinner for actions
- Subtle pulse animation

**Empty States**
- Centered icon + message
- Actionable CTA when applicable
- Friendly, helpful tone

**Animations**: Minimal and purposeful
- Transitions: 150-300ms ease-in-out
- Hover/focus: Scale 1.02 or shadow changes
- Page transitions: Fade in content
- NO complex scroll animations or parallax

## Layout Structure

**Main Dashboard Page**
1. Fixed sidebar navigation (Clientes, Contratos, Relatórios, etc.)
2. Top header with search, filters toggle, user menu
3. Filters panel (collapsible on mobile)
4. Client grid/table with pagination
5. Action buttons for add/export

**Client Detail Page**
1. Breadcrumb navigation
2. Client header with key info
3. Big numbers row (LTV, Ticket Médio, Total Faturas)
4. Tabbed content sections
5. Data tables and visualizations
6. Team sidebar with avatars

## Professional Polish

- Consistent 8px spacing grid throughout
- Subtle shadows for depth hierarchy
- Crisp borders using gray-200
- Professional iconography (Heroicons outline style)
- Data-dense but breathable layouts
- Clear visual hierarchy through size, weight, and color
- Accessibility: WCAG AA contrast ratios, keyboard navigation, ARIA labels