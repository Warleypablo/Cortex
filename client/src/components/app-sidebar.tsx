import { useState } from "react";
import { 
  Users, FileText, BarChart3, UserCog, Building2, Wrench, TrendingUp, UsersRound, 
  ChevronRight, Eye, UserCheck, UserPlus, Target, ShieldAlert, DollarSign, Briefcase, 
  Monitor, Rocket, Wallet, AlertTriangle, Handshake, UserRound, Headphones, UserSearch, 
  LineChart, Sparkles, Image, Trophy, Layers, Scale, Gavel, Key, Gift, BookOpen, 
  CalendarDays, ClipboardList, Settings, LayoutDashboard, Zap, Tv, LogOut
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import turboLogoLight from "@assets/logo-preta_1766452973532.png";
import turboLogoDark from "@assets/logo-branca_1766452973531.png";
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Handshake as HandshakeDash, BarChart3 as BarChart3Dash, DollarSign as DollarSignDash, TrendingUp as TrendingUpDash } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { NAV_CONFIG, ROUTE_TO_PERMISSION, permissionsToRoutes } from "@shared/nav-config";

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

// Icon mapping
const ICONS: Record<string, any> = {
  Users, FileText, BarChart3, UserCog, Building2, Wrench, TrendingUp, UsersRound,
  Eye, UserCheck, UserPlus, Target, ShieldAlert, DollarSign, Briefcase, Monitor,
  Rocket, Wallet, AlertTriangle, Handshake, UserRound, Headphones, UserSearch,
  LineChart, Sparkles, Image, Trophy, Layers, Scale, Gavel, Key, Gift, BookOpen,
  CalendarDays, ClipboardList, Settings, LayoutDashboard, Zap,
};

const getIcon = (iconName: string) => ICONS[iconName] || FileText;

export function AppSidebar() {
  const [location] = useLocation();
  const { theme } = useTheme();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";
  const turboLogo = theme === "dark" ? turboLogoDark : turboLogoLight;
  
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    // Check setores
    NAV_CONFIG.setores.forEach(cat => {
      const isActive = cat.items.some(item => location === item.url || location.startsWith(item.url + "/"));
      initial[cat.title] = isActive;
    });
    // Check G&G
    const ggActive = NAV_CONFIG.gg.items.some(item => location === item.url || location.startsWith(item.url + "/"));
    initial[NAV_CONFIG.gg.title] = ggActive;
    // Check governança
    NAV_CONFIG.governanca.forEach(cat => {
      const isActive = cat.items.some(item => location === item.url || location.startsWith(item.url + "/"));
      initial[cat.title] = isActive;
    });
    // Check admin
    const adminActive = NAV_CONFIG.admin.items.some(item => location === item.url || location.startsWith(item.url + "/"));
    initial[NAV_CONFIG.admin.title] = adminActive;
    // Check geral
    const geralActive = NAV_CONFIG.geral.items.some(item => location === item.url || location.startsWith(item.url + "/"));
    initial[NAV_CONFIG.geral.title] = geralActive;
    return initial;
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  // Check if user has access to a route - supports both old route-based and new permission-based systems
  const hasAccess = (url: string, permissionKey?: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    // Check new permission-based system first
    if (permissionKey && user.allowedRoutes) {
      if (user.allowedRoutes.includes(permissionKey)) return true;
    }
    
    // Fallback to old route-based system for backwards compatibility
    if (user.allowedRoutes && user.allowedRoutes.includes(url)) return true;
    
    // Check if any related routes are allowed
    const relatedRoutes = permissionsToRoutes([permissionKey || '']);
    return relatedRoutes.some(route => user.allowedRoutes?.includes(route));
  };

  const toggleCategory = (title: string) => {
    if (isCollapsed) {
      setOpen(true);
    }
    setOpenCategories(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleItemClick = () => {
    if (isCollapsed) {
      setOpen(true);
    }
  };

  // Filter items based on access
  const filterItems = <T extends { url: string; permissionKey: string }>(items: T[]): T[] => {
    return items.filter(item => hasAccess(item.url, item.permissionKey));
  };

  // Render a category with subitems
  const renderCategory = (category: { title: string; icon: string; items: Array<{ title: string; url: string; icon: string; permissionKey: string }> }, sectionKey: string) => {
    const visibleItems = filterItems(category.items);
    if (visibleItems.length === 0) return null;
    
    const isOpen = openCategories[category.title] || false;
    const isActive = category.items.some(item => location === item.url);
    const CategoryIcon = getIcon(category.icon);

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
              data-testid={`nav-${category.title.toLowerCase().replace(/\s+/g, '-')}`}
              className={isActive ? "bg-sidebar-accent" : ""}
            >
              <CategoryIcon />
              <span>{category.title}</span>
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {visibleItems.map((item) => {
                const ItemIcon = getIcon(item.icon);
                return (
                  <SidebarMenuSubItem key={item.url}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={location === item.url || location.startsWith(item.url + "/")}
                      data-testid={`nav-${category.title.toLowerCase()}-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url} onClick={handleItemClick}>
                        <ItemIcon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  // Quick access items
  const visibleQuickAccess = filterItems(NAV_CONFIG.quickAccess);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader 
        className="border-b border-sidebar-border px-6 py-5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:cursor-pointer"
        data-testid="sidebar-header"
      >
        <Link 
          href="/" 
          onClick={() => isCollapsed && setOpen(true)}
          className="hover-elevate rounded-md"
          data-testid="link-home-logo"
        >
          <div className="flex flex-col items-start gap-1 group-data-[collapsible=icon]:hidden">
            <img src={turboLogo} alt="Turbo" className="h-6 w-auto" />
            <span className="text-sm font-medium text-muted-foreground">Cortex</span>
          </div>
          <div className="hidden group-data-[collapsible=icon]:block">
            <img src={turboLogo} alt="Turbo" className="h-8 w-8 object-contain" />
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Setores - Primeiro */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40">
              <Layers className="w-3 h-3 text-blue-500" />
            </span>
            <span className="text-blue-500 font-medium">Setores</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_CONFIG.setores.map(category => renderCategory(category, 'setores'))}
              
              {/* G&G */}
              {filterItems(NAV_CONFIG.gg.items).length > 0 && renderCategory(NAV_CONFIG.gg, 'gg')}
              
              {/* Governança */}
              {NAV_CONFIG.governanca.map(category => renderCategory(category, 'governanca'))}
              
              {/* Administração */}
              {NAV_CONFIG.admin.items.filter(item => hasAccess(item.url, item.permissionKey)).map((item) => {
                const ItemIcon = getIcon(item.icon);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url || location.startsWith(item.url + "/")}
                      data-testid={`nav-admin-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url} onClick={handleItemClick}>
                        <ItemIcon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Acesso Rápido - Por último */}
        {visibleQuickAccess.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40">
                <Zap className="w-3 h-3 text-blue-500" />
              </span>
              <span className="text-blue-500 font-medium">Acesso Rápido</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleQuickAccess.map((item) => {
                  const ItemIcon = getIcon(item.icon);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location === item.url}
                        data-testid={`nav-quick-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Link href={item.url} onClick={handleItemClick}>
                          <ItemIcon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className="flex flex-col gap-1 group-data-[collapsible=icon]:items-center">
          <PresentationModeItem isCollapsed={isCollapsed} />
          {user && <LogoutItem isCollapsed={isCollapsed} />}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// Presentation Mode component for sidebar
interface DashboardCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  dashboards: { id: string; label: string; description: string }[];
}

const DASHBOARD_CATEGORIES: DashboardCategory[] = [
  {
    id: "comercial",
    label: "Comercial",
    icon: HandshakeDash,
    dashboards: [
      { id: "closers", label: "Closers", description: "Ranking e métricas de closers" },
      { id: "sdrs", label: "SDRs", description: "Ranking e métricas de SDRs" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    icon: BarChart3Dash,
    dashboards: [
      { id: "visao-geral", label: "Visão Geral", description: "MRR, clientes ativos e métricas gerais" },
      { id: "retencao", label: "Análise de Retenção", description: "Churn por serviço e responsável" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSignDash,
    dashboards: [
      { id: "financeiro-resumo", label: "Resumo Financeiro", description: "Receitas, despesas e saldo" },
      { id: "fluxo-caixa", label: "Fluxo de Caixa", description: "Projeção de entradas e saídas" },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    icon: TrendingUpDash,
    dashboards: [
      { id: "growth-visao-geral", label: "Performance Marketing", description: "ROI, CAC e métricas de anúncios" },
    ],
  },
];

const ALL_DASHBOARDS = DASHBOARD_CATEGORIES.flatMap(cat => cat.dashboards);

function PresentationModeItem({ isCollapsed }: { isCollapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>(["closers", "sdrs"]);
  const [rotationInterval, setRotationInterval] = useState("30");
  const [, setLocation] = useLocation();

  const handleStart = () => {
    sessionStorage.setItem("presentationConfig", JSON.stringify({
      dashboards: selectedDashboards,
      interval: parseInt(rotationInterval) * 1000
    }));
    setOpen(false);
    setLocation("/dashboard/comercial/apresentacao");
  };

  const toggleCategory = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;
    
    const categoryDashboardIds = category.dashboards.map(d => d.id);
    const allSelected = categoryDashboardIds.every(id => selectedDashboards.includes(id));
    
    if (allSelected) {
      setSelectedDashboards(selectedDashboards.filter(id => !categoryDashboardIds.includes(id)));
    } else {
      const combined = [...selectedDashboards, ...categoryDashboardIds];
      setSelectedDashboards(combined.filter((id, index) => combined.indexOf(id) === index));
    }
  };

  const isCategoryFullySelected = (categoryId: string) => {
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return false;
    return category.dashboards.every(d => selectedDashboards.includes(d.id));
  };

  const isCategoryPartiallySelected = (categoryId: string) => {
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return false;
    const selected = category.dashboards.filter(d => selectedDashboards.includes(d.id));
    return selected.length > 0 && selected.length < category.dashboards.length;
  };

  const getSelectedCount = (categoryId: string) => {
    const category = DASHBOARD_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return 0;
    return category.dashboards.filter(d => selectedDashboards.includes(d.id)).length;
  };

  if (isCollapsed) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button
                className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-sidebar-accent transition-colors"
                data-testid="button-presentation-mode-sidebar"
              >
                <Tv className="h-4 w-4 text-muted-foreground" />
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Modo Apresentação</TooltipContent>
        </Tooltip>
        <PresentationModeDialogContent
          open={open}
          selectedDashboards={selectedDashboards}
          setSelectedDashboards={setSelectedDashboards}
          rotationInterval={rotationInterval}
          setRotationInterval={setRotationInterval}
          handleStart={handleStart}
          toggleCategory={toggleCategory}
          isCategoryFullySelected={isCategoryFullySelected}
          isCategoryPartiallySelected={isCategoryPartiallySelected}
          getSelectedCount={getSelectedCount}
        />
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-sidebar-accent transition-colors"
          data-testid="button-presentation-mode-sidebar"
        >
          <Tv className="h-4 w-4" />
          <span>Modo Apresentação</span>
        </button>
      </DialogTrigger>
      <PresentationModeDialogContent
        open={open}
        selectedDashboards={selectedDashboards}
        setSelectedDashboards={setSelectedDashboards}
        rotationInterval={rotationInterval}
        setRotationInterval={setRotationInterval}
        handleStart={handleStart}
        toggleCategory={toggleCategory}
        isCategoryFullySelected={isCategoryFullySelected}
        isCategoryPartiallySelected={isCategoryPartiallySelected}
        getSelectedCount={getSelectedCount}
      />
    </Dialog>
  );
}

function PresentationModeDialogContent({
  selectedDashboards,
  setSelectedDashboards,
  rotationInterval,
  setRotationInterval,
  handleStart,
  toggleCategory,
  isCategoryFullySelected,
  isCategoryPartiallySelected,
  getSelectedCount,
}: {
  open: boolean;
  selectedDashboards: string[];
  setSelectedDashboards: (val: string[]) => void;
  rotationInterval: string;
  setRotationInterval: (val: string) => void;
  handleStart: () => void;
  toggleCategory: (id: string, e: React.MouseEvent) => void;
  isCategoryFullySelected: (id: string) => boolean;
  isCategoryPartiallySelected: (id: string) => boolean;
  getSelectedCount: (id: string) => number;
}) {
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Modo Apresentação</DialogTitle>
        <DialogDescription>
          Selecione os dashboards para exibir em tela cheia com rotação automática.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <ScrollArea className="h-[300px] pr-3">
          <Accordion type="multiple" defaultValue={["comercial"]} className="w-full">
            {DASHBOARD_CATEGORIES.map(category => {
              const Icon = category.icon;
              const isFullySelected = isCategoryFullySelected(category.id);
              const isPartiallySelected = isCategoryPartiallySelected(category.id);
              const selectedCount = getSelectedCount(category.id);
              
              return (
                <AccordionItem key={category.id} value={category.id} className="border-b">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={isFullySelected || (isPartiallySelected ? "indeterminate" : false)}
                        onCheckedChange={() => {}}
                        onClick={(e) => toggleCategory(category.id, e)}
                        data-testid={`checkbox-category-${category.id}`}
                      />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{category.label}</span>
                      {selectedCount > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto mr-2">
                          {selectedCount}/{category.dashboards.length}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="ml-7 space-y-1.5 pb-2">
                      {category.dashboards.map(d => (
                        <label 
                          key={d.id} 
                          className="flex items-start gap-2 cursor-pointer hover:bg-accent/30 rounded-md p-1.5"
                        >
                          <Checkbox
                            checked={selectedDashboards.includes(d.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDashboards([...selectedDashboards, d.id]);
                              } else {
                                setSelectedDashboards(selectedDashboards.filter(id => id !== d.id));
                              }
                            }}
                            data-testid={`checkbox-dashboard-${d.id}`}
                          />
                          <div className="grid gap-0.5 leading-none">
                            <span className="text-sm font-medium">
                              {d.label}
                            </span>
                            <p className="text-xs text-muted-foreground">{d.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </ScrollArea>
        
        <div className="space-y-2 pt-2 border-t">
          <label className="text-sm font-medium">Intervalo de rotação:</label>
          <Select value={rotationInterval} onValueChange={setRotationInterval}>
            <SelectTrigger data-testid="select-rotation-interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 segundos</SelectItem>
              <SelectItem value="20">20 segundos</SelectItem>
              <SelectItem value="30">30 segundos</SelectItem>
              <SelectItem value="60">1 minuto</SelectItem>
              <SelectItem value="120">2 minutos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{selectedDashboards.length} de {ALL_DASHBOARDS.length} dashboards selecionados</span>
        </div>
        
        <Button 
          onClick={handleStart} 
          disabled={selectedDashboards.length === 0}
          className="w-full"
          data-testid="button-start-presentation"
        >
          <Play className="mr-2 h-4 w-4" />
          Iniciar Apresentação
        </Button>
      </div>
    </DialogContent>
  );
}

function LogoutItem({ isCollapsed }: { isCollapsed: boolean }) {
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.clear();
      setLocation("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-destructive/10 transition-colors"
            data-testid="button-logout-sidebar"
          >
            <LogOut className="h-4 w-4 text-destructive" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Sair</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md text-destructive hover:bg-destructive/10 transition-colors"
      data-testid="button-logout-sidebar"
    >
      <LogOut className="h-4 w-4" />
      <span>Sair</span>
    </button>
  );
}
