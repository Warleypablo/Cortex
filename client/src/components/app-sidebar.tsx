import { useState } from "react";
import { Users, FileText, BarChart3, UserCog, Building2, Wrench, TrendingUp, UsersRound, ChevronRight, Eye, UserCheck, Shield } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  {
    title: "Clientes",
    url: "/",
    icon: Users,
    permission: "clientes",
  },
  {
    title: "Contratos",
    url: "/contratos",
    icon: FileText,
    permission: "contratos",
  },
  {
    title: "Colaboradores",
    url: "/colaboradores",
    icon: UserCog,
    permission: "colaboradores",
  },
  {
    title: "Patrimônio",
    url: "/patrimonio",
    icon: Building2,
    permission: "patrimonio",
  },
  {
    title: "Ferramentas",
    url: "/ferramentas",
    icon: Wrench,
    permission: "ferramentas",
  },
];

const dashboardItems = [
  {
    title: "Visão Geral",
    url: "/visao-geral",
    icon: Eye,
    permission: "visao-geral",
  },
  {
    title: "Financeiro",
    url: "/dashboard/financeiro",
    icon: TrendingUp,
    permission: "dashboard-financeiro",
  },
  {
    title: "G&G",
    url: "/dashboard/geg",
    icon: UsersRound,
    permission: "dashboard-geg",
  },
  {
    title: "Análise de Retenção",
    url: "/dashboard/retencao",
    icon: UserCheck,
    permission: "dashboard-retencao",
  },
  {
    title: "DFC",
    url: "/dashboard/dfc",
    icon: TrendingUp,
    permission: "dashboard-dfc",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isSuperAdmin } = useAuth();
  const [isDashboardOpen, setIsDashboardOpen] = useState(
    location.startsWith("/dashboard")
  );

  const userPermissions = (user as any)?.permissions || [];

  const hasPermission = (permission: string) => {
    return isSuperAdmin || userPermissions.includes(permission);
  };

  const visibleMenuItems = menuItems.filter(item => hasPermission(item.permission));
  const visibleDashboardItems = dashboardItems.filter(item => hasPermission(item.permission));

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
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleDashboardItems.length > 0 && (
                <Collapsible
                  open={isDashboardOpen}
                  onOpenChange={setIsDashboardOpen}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton data-testid="nav-dashboards">
                        <BarChart3 />
                        <span>Dashboards</span>
                        <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {visibleDashboardItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === item.url}
                              data-testid={`nav-dashboard-${item.title.toLowerCase().replace('&', '')}`}
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
              )}

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

              {isSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === "/usuarios"}
                    data-testid="nav-usuarios"
                  >
                    <Link href="/usuarios">
                      <Shield />
                      <span>Usuários</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
