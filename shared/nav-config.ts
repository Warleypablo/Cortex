import type { LucideIcon } from "lucide-react";

// Permission keys enum for each page/route
export const PERMISSION_KEYS = {
  // Geral
  GENERAL: {
    PROFILE: 'general.profile',
    CALENDAR: 'general.calendar',
    ACESSOS: 'general.acessos',
    CONHECIMENTO: 'general.conhecimento',
    BENEFICIOS: 'general.beneficios',
    GPTURBO: 'general.gpturbo',
    TURBO_TOOLS: 'general.turbo_tools',
  },
  // Financeiro
  FIN: {
    VISAO_GERAL: 'fin.visao_geral',
    DFC: 'fin.dfc',
    FLUXO_CAIXA: 'fin.fluxo_caixa',
    REVENUE_GOALS: 'fin.revenue_goals',
    INADIMPLENCIA: 'fin.inadimplencia',
    AUDITORIA: 'fin.auditoria',
  },
  // Operação
  OPS: {
    VISAO_GERAL: 'ops.visao_geral',
    RETENCAO: 'ops.retencao',
    COHORT: 'ops.cohort',
    CLIENTES_CONTRATOS: 'ops.clientes_contratos',
  },
  // Tech
  TECH: {
    VISAO_GERAL: 'tech.visao_geral',
    PROJETOS: 'tech.projetos',
  },
  // Comercial
  COM: {
    CLOSERS: 'com.closers',
    SDRS: 'com.sdrs',
    DET_CLOSERS: 'com.det_closers',
    DET_SDRS: 'com.det_sdrs',
    DET_VENDAS: 'com.det_vendas',
    ANALISE_VENDAS: 'com.analise_vendas',
  },
  // Growth
  GROWTH: {
    VISAO_GERAL: 'growth.visao_geral',
    META_ADS: 'growth.meta_ads',
    PLATAFORMA: 'growth.plataforma',
    CRIATIVOS: 'growth.criativos',
    TURBODASH: 'growth.turbodash',
  },
  // G&G (Pessoas)
  GG: {
    VISAO_GERAL: 'gg.visao_geral',
    RECRUTAMENTO: 'gg.recrutamento',
    ONBOARDING: 'gg.onboarding',
    PESQUISAS: 'gg.pesquisas',
    COLABORADORES: 'gg.colaboradores',
    PATRIMONIO: 'gg.patrimonio',
  },
  // Jurídico
  JUR: {
    CLIENTES_INADIMPLENTES: 'jur.clientes_inadimplentes',
  },
  // Reports
  REPORTS: {
    INVESTORS: 'reports.investors',
  },
  // Administração
  ADMIN: {
    USUARIOS: 'admin.usuarios',
    OKR_2026: 'admin.okr_2026',
  },
} as const;

// Flatten all permission keys for easy access
export const ALL_PERMISSION_KEYS = Object.values(PERMISSION_KEYS).flatMap(category => 
  Object.values(category)
);

// Get all keys for a category
export const getCategoryKeys = (category: keyof typeof PERMISSION_KEYS): string[] => {
  return Object.values(PERMISSION_KEYS[category]);
};

// Access profiles (presets)
export const ACCESS_PROFILES = {
  BASE: {
    id: 'base',
    label: 'Base',
    description: 'Acesso básico: apenas módulo Geral',
    permissions: [
      ...getCategoryKeys('GENERAL'),
    ],
  },
  TIME: {
    id: 'time',
    label: 'Time',
    description: 'Operação do negócio (sem áreas sensíveis)',
    permissions: [
      ...getCategoryKeys('GENERAL'),
      ...getCategoryKeys('OPS'),
      ...getCategoryKeys('TECH'),
      ...getCategoryKeys('COM'),
      ...getCategoryKeys('GROWTH'),
    ],
  },
  LIDER: {
    id: 'lider',
    label: 'Líder',
    description: 'Tudo exceto Financeiro',
    permissions: [
      ...getCategoryKeys('GENERAL'),
      ...getCategoryKeys('OPS'),
      ...getCategoryKeys('TECH'),
      ...getCategoryKeys('COM'),
      ...getCategoryKeys('GROWTH'),
      ...getCategoryKeys('GG'),
      ...getCategoryKeys('JUR'),
      ...getCategoryKeys('REPORTS'),
      ...getCategoryKeys('ADMIN'),
    ],
  },
  CONTROL_TOWER: {
    id: 'control_tower',
    label: 'Control Tower',
    description: 'Acesso total a todas as áreas',
    permissions: ALL_PERMISSION_KEYS,
  },
} as const;

export type AccessProfileId = keyof typeof ACCESS_PROFILES;

// Route to permission key mapping
export const ROUTE_TO_PERMISSION: Record<string, string> = {
  // Geral
  '/meu-perfil': PERMISSION_KEYS.GENERAL.PROFILE,
  '/calendario': PERMISSION_KEYS.GENERAL.CALENDAR,
  '/acessos': PERMISSION_KEYS.GENERAL.ACESSOS,
  '/conhecimentos': PERMISSION_KEYS.GENERAL.CONHECIMENTO,
  '/beneficios': PERMISSION_KEYS.GENERAL.BENEFICIOS,
  '/cases/chat': PERMISSION_KEYS.GENERAL.GPTURBO,
  '/ferramentas': PERMISSION_KEYS.GENERAL.TURBO_TOOLS,
  '/okr-2026': PERMISSION_KEYS.ADMIN.OKR_2026,
  // Financeiro
  '/dashboard/financeiro': PERMISSION_KEYS.FIN.VISAO_GERAL,
  '/dashboard/dfc': PERMISSION_KEYS.FIN.DFC,
  '/dashboard/fluxo-caixa': PERMISSION_KEYS.FIN.FLUXO_CAIXA,
  '/dashboard/revenue-goals': PERMISSION_KEYS.FIN.REVENUE_GOALS,
  '/dashboard/inadimplencia': PERMISSION_KEYS.FIN.INADIMPLENCIA,
  '/dashboard/auditoria-sistemas': PERMISSION_KEYS.FIN.AUDITORIA,
  // Operação
  '/visao-geral': PERMISSION_KEYS.OPS.VISAO_GERAL,
  '/dashboard/retencao': PERMISSION_KEYS.OPS.RETENCAO,
  '/dashboard/cohort': PERMISSION_KEYS.OPS.COHORT,
  '/clientes': PERMISSION_KEYS.OPS.CLIENTES_CONTRATOS,
  '/contratos': PERMISSION_KEYS.OPS.CLIENTES_CONTRATOS,
  // Tech
  '/dashboard/tech': PERMISSION_KEYS.TECH.VISAO_GERAL,
  '/tech/projetos': PERMISSION_KEYS.TECH.PROJETOS,
  // Comercial
  '/dashboard/comercial/closers': PERMISSION_KEYS.COM.CLOSERS,
  '/dashboard/comercial/sdrs': PERMISSION_KEYS.COM.SDRS,
  '/dashboard/comercial/detalhamento-closers': PERMISSION_KEYS.COM.DET_CLOSERS,
  '/dashboard/comercial/detalhamento-sdrs': PERMISSION_KEYS.COM.DET_SDRS,
  '/dashboard/comercial/detalhamento-vendas': PERMISSION_KEYS.COM.DET_VENDAS,
  '/dashboard/comercial/analise-vendas': PERMISSION_KEYS.COM.ANALISE_VENDAS,
  // Growth
  '/growth/visao-geral': PERMISSION_KEYS.GROWTH.VISAO_GERAL,
  '/dashboard/meta-ads': PERMISSION_KEYS.GROWTH.META_ADS,
  '/growth/performance-plataformas': PERMISSION_KEYS.GROWTH.PLATAFORMA,
  '/growth/criativos': PERMISSION_KEYS.GROWTH.CRIATIVOS,
  '/growth/turbodash': PERMISSION_KEYS.GROWTH.TURBODASH,
  // G&G
  '/dashboard/geg': PERMISSION_KEYS.GG.VISAO_GERAL,
  '/dashboard/recrutamento': PERMISSION_KEYS.GG.RECRUTAMENTO,
  '/rh/onboarding': PERMISSION_KEYS.GG.ONBOARDING,
  '/rh/pesquisas': PERMISSION_KEYS.GG.PESQUISAS,
  '/colaboradores': PERMISSION_KEYS.GG.COLABORADORES,
  '/colaboradores/analise': PERMISSION_KEYS.GG.COLABORADORES,
  '/patrimonio': PERMISSION_KEYS.GG.PATRIMONIO,
  // Jurídico
  '/juridico/clientes': PERMISSION_KEYS.JUR.CLIENTES_INADIMPLENTES,
  // Reports
  '/investors-report': PERMISSION_KEYS.REPORTS.INVESTORS,
  // Administração
  '/admin/usuarios': PERMISSION_KEYS.ADMIN.USUARIOS,
};

// Convert permission keys to routes (for backwards compatibility)
export const PERMISSION_TO_ROUTES: Record<string, string[]> = {};
Object.entries(ROUTE_TO_PERMISSION).forEach(([route, permission]) => {
  if (!PERMISSION_TO_ROUTES[permission]) {
    PERMISSION_TO_ROUTES[permission] = [];
  }
  PERMISSION_TO_ROUTES[permission].push(route);
});

// Helper to convert old allowedRoutes to new permission keys
export function routesToPermissions(routes: string[]): string[] {
  const permissions = new Set<string>();
  routes.forEach(route => {
    const permission = ROUTE_TO_PERMISSION[route];
    if (permission) {
      permissions.add(permission);
    }
  });
  return Array.from(permissions);
}

// Helper to convert new permission keys to routes
export function permissionsToRoutes(permissions: string[]): string[] {
  const routes = new Set<string>();
  permissions.forEach(permission => {
    const permRoutes = PERMISSION_TO_ROUTES[permission];
    if (permRoutes) {
      permRoutes.forEach(r => routes.add(r));
    }
  });
  return Array.from(routes);
}

// Navigation configuration structure
export interface NavItem {
  title: string;
  url: string;
  icon: string; // Icon name as string for serialization
  permissionKey: string;
  locked?: boolean;
}

export interface NavCategory {
  title: string;
  icon: string;
  items: NavItem[];
}

export interface NavSection {
  title: string;
  categories: NavCategory[];
}

// Navigation structure
export const NAV_CONFIG = {
  // Acesso Rápido - shortcuts to Geral pages
  quickAccess: [
    { title: 'OKR 2026', url: '/okr-2026', icon: 'Target', permissionKey: PERMISSION_KEYS.ADMIN.OKR_2026 },
    { title: 'Meu Perfil', url: '/meu-perfil', icon: 'UserRound', permissionKey: PERMISSION_KEYS.GENERAL.PROFILE },
    { title: 'Calendário', url: '/calendario', icon: 'CalendarDays', permissionKey: PERMISSION_KEYS.GENERAL.CALENDAR },
    { title: 'Acessos', url: '/acessos', icon: 'Key', permissionKey: PERMISSION_KEYS.GENERAL.ACESSOS },
    { title: 'Conhecimento', url: '/conhecimentos', icon: 'BookOpen', permissionKey: PERMISSION_KEYS.GENERAL.CONHECIMENTO },
    { title: 'Clube Benefícios', url: '/beneficios', icon: 'Gift', permissionKey: PERMISSION_KEYS.GENERAL.BENEFICIOS },
    { title: 'GPTurbo', url: '/cases/chat', icon: 'Sparkles', permissionKey: PERMISSION_KEYS.GENERAL.GPTURBO },
    { title: 'Turbo Tools', url: '/ferramentas', icon: 'Wrench', permissionKey: PERMISSION_KEYS.GENERAL.TURBO_TOOLS },
  ],
  
  // Geral module
  geral: {
    title: 'Geral',
    icon: 'LayoutDashboard',
    items: [
      { title: 'Meu Perfil', url: '/meu-perfil', icon: 'UserRound', permissionKey: PERMISSION_KEYS.GENERAL.PROFILE },
      { title: 'Calendário', url: '/calendario', icon: 'CalendarDays', permissionKey: PERMISSION_KEYS.GENERAL.CALENDAR },
      { title: 'Acessos', url: '/acessos', icon: 'Key', permissionKey: PERMISSION_KEYS.GENERAL.ACESSOS },
      { title: 'Conhecimento', url: '/conhecimentos', icon: 'BookOpen', permissionKey: PERMISSION_KEYS.GENERAL.CONHECIMENTO },
      { title: 'Clube Benefícios', url: '/beneficios', icon: 'Gift', permissionKey: PERMISSION_KEYS.GENERAL.BENEFICIOS },
      { title: 'GPTurbo', url: '/cases/chat', icon: 'Sparkles', permissionKey: PERMISSION_KEYS.GENERAL.GPTURBO },
      { title: 'Turbo Tools', url: '/ferramentas', icon: 'Wrench', permissionKey: PERMISSION_KEYS.GENERAL.TURBO_TOOLS },
      { title: 'OKR 2026', url: '/okr-2026', icon: 'Trophy', permissionKey: PERMISSION_KEYS.ADMIN.OKR_2026 },
    ],
  },
  
  // Setores section
  setores: [
    {
      title: 'Financeiro',
      icon: 'DollarSign',
      items: [
        { title: 'Visão Geral', url: '/dashboard/financeiro', icon: 'TrendingUp', permissionKey: PERMISSION_KEYS.FIN.VISAO_GERAL },
        { title: 'DFC', url: '/dashboard/dfc', icon: 'BarChart3', permissionKey: PERMISSION_KEYS.FIN.DFC },
        { title: 'Fluxo de Caixa', url: '/dashboard/fluxo-caixa', icon: 'Wallet', permissionKey: PERMISSION_KEYS.FIN.FLUXO_CAIXA },
        { title: 'Revenue Goals', url: '/dashboard/revenue-goals', icon: 'Target', permissionKey: PERMISSION_KEYS.FIN.REVENUE_GOALS },
        { title: 'Inadimplência', url: '/dashboard/inadimplencia', icon: 'AlertTriangle', permissionKey: PERMISSION_KEYS.FIN.INADIMPLENCIA },
        { title: 'Auditoria de Sistemas', url: '/dashboard/auditoria-sistemas', icon: 'ShieldAlert', permissionKey: PERMISSION_KEYS.FIN.AUDITORIA },
      ],
    },
    {
      title: 'Operação',
      icon: 'Briefcase',
      items: [
        { title: 'Visão Geral', url: '/visao-geral', icon: 'Eye', permissionKey: PERMISSION_KEYS.OPS.VISAO_GERAL },
        { title: 'Clientes & Contratos', url: '/clientes', icon: 'Users', permissionKey: PERMISSION_KEYS.OPS.CLIENTES_CONTRATOS },
        { title: 'Análise de Retenção', url: '/dashboard/retencao', icon: 'UserCheck', permissionKey: PERMISSION_KEYS.OPS.RETENCAO },
        { title: 'Cohort de Retenção', url: '/dashboard/cohort', icon: 'BarChart3', permissionKey: PERMISSION_KEYS.OPS.COHORT },
      ],
    },
    {
      title: 'Tech',
      icon: 'Monitor',
      items: [
        { title: 'Visão Geral', url: '/dashboard/tech', icon: 'Eye', permissionKey: PERMISSION_KEYS.TECH.VISAO_GERAL },
        { title: 'Projetos', url: '/tech/projetos', icon: 'Rocket', permissionKey: PERMISSION_KEYS.TECH.PROJETOS },
      ],
    },
    {
      title: 'Comercial',
      icon: 'Handshake',
      items: [
        { title: 'Closers', url: '/dashboard/comercial/closers', icon: 'UserRound', permissionKey: PERMISSION_KEYS.COM.CLOSERS },
        { title: 'SDRs', url: '/dashboard/comercial/sdrs', icon: 'Headphones', permissionKey: PERMISSION_KEYS.COM.SDRS },
        { title: 'Detalhamento Closers', url: '/dashboard/comercial/detalhamento-closers', icon: 'UserSearch', permissionKey: PERMISSION_KEYS.COM.DET_CLOSERS },
        { title: 'Detalhamento SDRs', url: '/dashboard/comercial/detalhamento-sdrs', icon: 'UserSearch', permissionKey: PERMISSION_KEYS.COM.DET_SDRS },
        { title: 'Detalhamento Vendas', url: '/dashboard/comercial/detalhamento-vendas', icon: 'BarChart3', permissionKey: PERMISSION_KEYS.COM.DET_VENDAS },
        { title: 'Análise de Vendas', url: '/dashboard/comercial/analise-vendas', icon: 'LineChart', permissionKey: PERMISSION_KEYS.COM.ANALISE_VENDAS },
      ],
    },
    {
      title: 'Growth',
      icon: 'Sparkles',
      items: [
        { title: 'Visão Geral', url: '/growth/visao-geral', icon: 'Eye', permissionKey: PERMISSION_KEYS.GROWTH.VISAO_GERAL },
        { title: 'Meta Ads', url: '/dashboard/meta-ads', icon: 'Target', permissionKey: PERMISSION_KEYS.GROWTH.META_ADS },
        { title: 'Por Plataforma', url: '/growth/performance-plataformas', icon: 'Layers', permissionKey: PERMISSION_KEYS.GROWTH.PLATAFORMA },
        { title: 'Criativos', url: '/growth/criativos', icon: 'Image', permissionKey: PERMISSION_KEYS.GROWTH.CRIATIVOS },
        { title: 'TurboDash', url: '/growth/turbodash', icon: 'BarChart3', permissionKey: PERMISSION_KEYS.GROWTH.TURBODASH },
      ],
    },
  ],
  
  // G&G (Pessoas)
  gg: {
    title: 'G&G',
    icon: 'UsersRound',
    items: [
      { title: 'Visão Geral', url: '/dashboard/geg', icon: 'UsersRound', permissionKey: PERMISSION_KEYS.GG.VISAO_GERAL },
      { title: 'Colaboradores', url: '/colaboradores', icon: 'UserCog', permissionKey: PERMISSION_KEYS.GG.COLABORADORES },
      { title: 'Recrutamento', url: '/dashboard/recrutamento', icon: 'UserPlus', permissionKey: PERMISSION_KEYS.GG.RECRUTAMENTO },
      { title: 'Onboarding', url: '/rh/onboarding', icon: 'ClipboardList', permissionKey: PERMISSION_KEYS.GG.ONBOARDING },
      { title: 'Pesquisas', url: '/rh/pesquisas', icon: 'BarChart2', permissionKey: PERMISSION_KEYS.GG.PESQUISAS },
      { title: 'Patrimônio', url: '/patrimonio', icon: 'Building2', permissionKey: PERMISSION_KEYS.GG.PATRIMONIO },
    ],
  },
  
  // Governança section
  governanca: [
    {
      title: 'Jurídico',
      icon: 'Scale',
      items: [
        { title: 'Clientes Inadimplentes', url: '/juridico/clientes', icon: 'Gavel', permissionKey: PERMISSION_KEYS.JUR.CLIENTES_INADIMPLENTES },
      ],
    },
    {
      title: 'Reports',
      icon: 'FileText',
      items: [
        { title: 'Investors Report', url: '/investors-report', icon: 'TrendingUp', permissionKey: PERMISSION_KEYS.REPORTS.INVESTORS },
      ],
    },
  ],
  
  // Administração
  admin: {
    title: 'Administração',
    icon: 'Settings',
    items: [
      { title: 'Usuários', url: '/admin/usuarios', icon: 'Users', permissionKey: PERMISSION_KEYS.ADMIN.USUARIOS },
      { title: 'Design System', url: '/admin/design-system', icon: 'Palette', permissionKey: PERMISSION_KEYS.ADMIN.USUARIOS },
    ],
  },
};

// Categories for the permissions UI
export const PERMISSION_CATEGORIES = [
  { 
    key: 'GENERAL', 
    label: 'Geral',
    permissions: Object.entries(PERMISSION_KEYS.GENERAL).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'FIN', 
    label: 'Financeiro',
    permissions: Object.entries(PERMISSION_KEYS.FIN).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'OPS', 
    label: 'Operação',
    permissions: Object.entries(PERMISSION_KEYS.OPS).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'TECH', 
    label: 'Tech',
    permissions: Object.entries(PERMISSION_KEYS.TECH).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'COM', 
    label: 'Comercial',
    permissions: Object.entries(PERMISSION_KEYS.COM).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'GROWTH', 
    label: 'Growth',
    permissions: Object.entries(PERMISSION_KEYS.GROWTH).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'GG', 
    label: 'G&G',
    permissions: Object.entries(PERMISSION_KEYS.GG).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'JUR', 
    label: 'Jurídico',
    permissions: Object.entries(PERMISSION_KEYS.JUR).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'REPORTS', 
    label: 'Reports',
    permissions: Object.entries(PERMISSION_KEYS.REPORTS).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
  { 
    key: 'ADMIN', 
    label: 'Administração',
    permissions: Object.entries(PERMISSION_KEYS.ADMIN).map(([key, value]) => ({
      key: value,
      label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
    })),
  },
];

// Friendly labels for permission keys
export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSION_KEYS.GENERAL.PROFILE]: 'Meu Perfil',
  [PERMISSION_KEYS.GENERAL.CALENDAR]: 'Calendário',
  [PERMISSION_KEYS.GENERAL.ACESSOS]: 'Acessos',
  [PERMISSION_KEYS.GENERAL.CONHECIMENTO]: 'Conhecimento',
  [PERMISSION_KEYS.GENERAL.BENEFICIOS]: 'Clube Benefícios',
  [PERMISSION_KEYS.GENERAL.GPTURBO]: 'GPTurbo',
  [PERMISSION_KEYS.GENERAL.TURBO_TOOLS]: 'Turbo Tools',
  [PERMISSION_KEYS.ADMIN.OKR_2026]: 'OKR 2026',
  [PERMISSION_KEYS.FIN.VISAO_GERAL]: 'Visão Geral',
  [PERMISSION_KEYS.FIN.DFC]: 'DFC',
  [PERMISSION_KEYS.FIN.FLUXO_CAIXA]: 'Fluxo de Caixa',
  [PERMISSION_KEYS.FIN.REVENUE_GOALS]: 'Revenue Goals',
  [PERMISSION_KEYS.FIN.INADIMPLENCIA]: 'Inadimplência',
  [PERMISSION_KEYS.FIN.AUDITORIA]: 'Auditoria de Sistemas',
  [PERMISSION_KEYS.OPS.VISAO_GERAL]: 'Visão Geral',
  [PERMISSION_KEYS.OPS.RETENCAO]: 'Análise de Retenção',
  [PERMISSION_KEYS.OPS.COHORT]: 'Cohort de Retenção',
  [PERMISSION_KEYS.OPS.CLIENTES_CONTRATOS]: 'Clientes & Contratos',
  [PERMISSION_KEYS.TECH.VISAO_GERAL]: 'Visão Geral',
  [PERMISSION_KEYS.TECH.PROJETOS]: 'Projetos',
  [PERMISSION_KEYS.COM.CLOSERS]: 'Closers',
  [PERMISSION_KEYS.COM.SDRS]: 'SDRs',
  [PERMISSION_KEYS.COM.DET_CLOSERS]: 'Detalhamento Closers',
  [PERMISSION_KEYS.COM.DET_SDRS]: 'Detalhamento SDRs',
  [PERMISSION_KEYS.COM.DET_VENDAS]: 'Detalhamento Vendas',
  [PERMISSION_KEYS.COM.ANALISE_VENDAS]: 'Análise de Vendas',
  [PERMISSION_KEYS.GROWTH.VISAO_GERAL]: 'Visão Geral',
  [PERMISSION_KEYS.GROWTH.META_ADS]: 'Meta Ads',
  [PERMISSION_KEYS.GROWTH.PLATAFORMA]: 'Por Plataforma',
  [PERMISSION_KEYS.GROWTH.CRIATIVOS]: 'Criativos',
  [PERMISSION_KEYS.GG.VISAO_GERAL]: 'Visão Geral',
  [PERMISSION_KEYS.GG.RECRUTAMENTO]: 'Recrutamento',
  [PERMISSION_KEYS.GG.ONBOARDING]: 'Onboarding',
  [PERMISSION_KEYS.GG.PESQUISAS]: 'Pesquisas',
  [PERMISSION_KEYS.GG.COLABORADORES]: 'Colaboradores',
  [PERMISSION_KEYS.GG.PATRIMONIO]: 'Patrimônio',
  [PERMISSION_KEYS.JUR.CLIENTES_INADIMPLENTES]: 'Clientes Inadimplentes',
  [PERMISSION_KEYS.REPORTS.INVESTORS]: 'Investors Report',
  [PERMISSION_KEYS.ADMIN.USUARIOS]: 'Administração',
};
