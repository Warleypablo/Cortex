import { useState } from "react";
import { Users, FileText, BarChart3, UserCog, Building2, Wrench, MessageSquare, TrendingUp, UsersRound, ChevronRight, Eye, UserCheck, UserPlus, Shield, Target, ShieldAlert, DollarSign, Briefcase, Monitor, Rocket, Wallet, AlertTriangle, Handshake, UserRound, Headphones, UserSearch, LineChart, Tv, Sparkles, Image, Trophy, Layers, Scale, Gavel } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
}

const menuItems = [
  {
    title: "Clientes",
    url: "/",
    icon: Users,
  },
  {
    title: "Contratos",
    url: "/contratos",
    icon: FileText,
  },
  {
    title: "Colaboradores",
    url: "/colaboradores",
    icon: UserCog,
  },
  {
    title: "Patrimônio",
    url: "/patrimonio",
    icon: Building2,
  },
  {
    title: "Ferramentas",
    url: "/ferramentas",
    icon: Wrench,
  },
  {
    title: "TurboZap",
    url: "/turbozap",
    icon: MessageSquare,
  },
  {
    title: "Cases de Sucesso",
    url: "/cases/chat",
    icon: Trophy,
  },
];

const dashboardCategories = [
  {
    title: "Financeiro",
    icon: DollarSign,
    baseUrl: "/dashboard/financeiro",
    subItems: [
      { title: "Visão Geral", url: "/dashboard/financeiro", icon: TrendingUp },
      { title: "DFC", url: "/dashboard/dfc", icon: BarChart3 },
      { title: "Fluxo de Caixa", url: "/dashboard/fluxo-caixa", icon: Wallet },
      { title: "Revenue Goals", url: "/dashboard/revenue-goals", icon: Target },
      { title: "Inadimplência", url: "/dashboard/inadimplencia", icon: AlertTriangle },
      { title: "Auditoria de Sistemas", url: "/dashboard/auditoria-sistemas", icon: ShieldAlert },
    ],
  },
  {
    title: "G&G",
    icon: UsersRound,
    baseUrl: "/dashboard/geg",
    subItems: [
      { title: "Visão Geral", url: "/dashboard/geg", icon: UsersRound },
      { title: "Inhire", url: "/dashboard/inhire", icon: UserCheck },
      { title: "Recrutamento", url: "/dashboard/recrutamento", icon: UserPlus },
    ],
  },
  {
    title: "Operação",
    icon: Briefcase,
    baseUrl: "/visao-geral",
    subItems: [
      { title: "Visão Geral", url: "/visao-geral", icon: Eye },
      { title: "Análise de Retenção", url: "/dashboard/retencao", icon: UserCheck },
      { title: "Meta Ads", url: "/dashboard/meta-ads", icon: Target },
    ],
  },
  {
    title: "Tech",
    icon: Monitor,
    baseUrl: "/dashboard/tech",
    subItems: [
      { title: "Visão Geral", url: "/dashboard/tech", icon: Eye },
      { title: "Projetos", url: "/tech/projetos", icon: Rocket },
    ],
  },
  {
    title: "Comercial",
    icon: Handshake,
    baseUrl: "/dashboard/comercial",
    subItems: [
      { title: "Closers", url: "/dashboard/comercial/closers", icon: UserRound },
      { title: "SDRs", url: "/dashboard/comercial/sdrs", icon: Headphones },
      { title: "Detalhamento Closers", url: "/dashboard/comercial/detalhamento-closers", icon: UserSearch },
      { title: "Detalhamento SDRs", url: "/dashboard/comercial/detalhamento-sdrs", icon: UserSearch },
      { title: "Detalhamento Vendas", url: "/dashboard/comercial/detalhamento-vendas", icon: BarChart3 },
      { title: "Análise de Vendas", url: "/dashboard/comercial/analise-vendas", icon: LineChart },
      { title: "Modo Apresentação", url: "/dashboard/comercial/apresentacao", icon: Tv },
    ],
  },
  {
    title: "Growth",
    icon: Sparkles,
    baseUrl: "/growth",
    subItems: [
      { title: "Visão Geral", url: "/growth/visao-geral", icon: Eye },
      { title: "Por Plataforma", url: "/growth/performance-plataformas", icon: Layers },
      { title: "Criativos", url: "/growth/criativos", icon: Image },
    ],
  },
  {
    title: "Jurídico",
    icon: Scale,
    baseUrl: "/juridico",
    subItems: [
      { title: "Clientes Inadimplentes", url: "/juridico/clientes", icon: Gavel },
    ],
  },
];

const adminItems = [
  {
    title: "Gerenciar Usuários",
    url: "/admin/usuarios",
    icon: Shield,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    dashboardCategories.forEach(cat => {
      const isActive = cat.subItems.some(sub => location === sub.url || location.startsWith(sub.url));
      initial[cat.title] = isActive;
    });
    return initial;
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const hasAccess = (path: string) => {
    if (!user) return false;
    return user.role === 'admin' || (user.allowedRoutes && user.allowedRoutes.includes(path));
  };

  const visibleMenuItems = menuItems.filter((item) => hasAccess(item.url));
  const visibleAdminItems = adminItems.filter((item) => hasAccess(item.url));

  const toggleCategory = (title: string) => {
    setOpenCategories(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sidebar-foreground">CRM Dashboard</h2>
            <p className="text-xs text-muted-foreground">Marketing Digital</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dashboardCategories.map((category) => {
                const visibleSubItems = category.subItems.filter(sub => hasAccess(sub.url));
                if (visibleSubItems.length === 0) return null;
                
                const isOpen = openCategories[category.title] || false;
                const isActive = category.subItems.some(sub => location === sub.url);

                return (
                  <Collapsible
                    key={category.title}
                    open={isOpen}
                    onOpenChange={() => toggleCategory(category.title)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton 
                          data-testid={`nav-${category.title.toLowerCase()}`}
                          className={isActive ? "bg-sidebar-accent" : ""}
                        >
                          <category.icon />
                          <span>{category.title}</span>
                          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {visibleSubItems.map((item) => (
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location === item.url}
                                data-testid={`nav-${category.title.toLowerCase()}-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                <Link href={item.url}>
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
