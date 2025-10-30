import { useState } from "react";
import { Users, FileText, BarChart3, UserCog, Building2, Wrench, TrendingUp, UsersRound, ChevronRight, Eye, UserCheck } from "lucide-react";
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
];

const dashboardItems = [
  {
    title: "Visão Geral",
    url: "/visao-geral",
    icon: Eye,
  },
  {
    title: "Financeiro",
    url: "/dashboard/financeiro",
    icon: TrendingUp,
  },
  {
    title: "G&G",
    url: "/dashboard/geg",
    icon: UsersRound,
  },
  {
    title: "Análise de Retenção",
    url: "/dashboard/retencao",
    icon: UserCheck,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [isDashboardOpen, setIsDashboardOpen] = useState(
    location.startsWith("/dashboard")
  );

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
                      {dashboardItems.map((item) => (
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

              {menuItems.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
