import { useState } from "react";
import { 
  Users, FileText, BarChart3, UserCog, Building2, Wrench, TrendingUp, UsersRound, 
  ChevronRight, Eye, UserCheck, UserPlus, Target, ShieldAlert, DollarSign, Briefcase, 
  Monitor, Rocket, Wallet, AlertTriangle, Handshake, UserRound, Headphones, UserSearch, 
  LineChart, Sparkles, Image, Trophy, Layers, Scale, Gavel, Key, Gift, BookOpen, 
  CalendarDays, ClipboardList, Settings, LayoutDashboard, Zap
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
  useSidebar,
} from "@/components/ui/sidebar";
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
          <SidebarGroupLabel>
            <Layers className="w-3 h-3 mr-1" />
            Setores
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
            <SidebarGroupLabel>
              <Zap className="w-3 h-3 mr-1" />
              Acesso Rápido
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
    </Sidebar>
  );
}
