import { useState } from "react";
import { 
  Users, FileText, BarChart3, UserCog, Building2, Wrench, TrendingUp, UsersRound, 
  Eye, UserCheck, UserPlus, Target, ShieldAlert, DollarSign, Briefcase, 
  Monitor, Rocket, Wallet, AlertTriangle, Handshake, UserRound, Headphones, UserSearch, 
  LineChart, Sparkles, Image, Trophy, Layers, Scale, Gavel, Key, Gift, BookOpen, 
  CalendarDays, ClipboardList, Settings, LayoutDashboard, Zap, Tv, LogOut, Lock, Bell, Moon, Sun,
  ChevronRight, ChevronDown, Presentation
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import turboLogoLight from "@assets/logo-preta_1766452973532.png";
import turboLogoDark from "@assets/logo-branca_1766452973531.png";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { NAV_CONFIG, permissionsToRoutes } from "@shared/nav-config";
import { cn } from "@/lib/utils";

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
  const { theme, toggleTheme } = useTheme();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";
  const turboLogo = theme === "dark" ? turboLogoDark : turboLogoLight;

  // Track open categories
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'Financeiro': false,
    'Operação': true,
    'Tech': false,
    'Comercial': false,
    'Growth': false,
    'G&G': false,
    'Jurídico': false,
    'Reports': false,
    'Admin': false,
  });

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const hasAccess = (url: string, permissionKey?: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    if (permissionKey && user.allowedRoutes) {
      if (user.allowedRoutes.includes(permissionKey)) return true;
    }
    
    if (user.allowedRoutes && user.allowedRoutes.includes(url)) return true;
    
    const relatedRoutes = permissionsToRoutes([permissionKey || '']);
    return relatedRoutes.some(route => user.allowedRoutes?.includes(route));
  };

  const handleItemClick = () => {
    if (isCollapsed) {
      setOpen(true);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.clear();
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getRoleBadge = () => {
    if (!user) return null;
    if (user.role === 'admin') {
      return { label: 'Admin', variant: 'default' as const };
    }
    return { label: 'User', variant: 'secondary' as const };
  };

  const roleBadge = getRoleBadge();

  const getUserInitials = () => {
    if (!user?.name) return '?';
    const names = user.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  const renderNavItem = (item: { title: string; url: string; icon: string; permissionKey: string }, showLocked = false) => {
    const ItemIcon = getIcon(item.icon);
    const isActive = location === item.url || location.startsWith(item.url + "/");
    const isLocked = !hasAccess(item.url, item.permissionKey);
    
    if (isLocked && !showLocked && user?.role !== 'admin') {
      return null;
    }
    
    if (isCollapsed) {
      return (
        <Tooltip key={item.url}>
          <TooltipTrigger asChild>
            <Link
              href={isLocked ? "#" : item.url}
              onClick={isLocked ? (e) => e.preventDefault() : handleItemClick}
              className={cn(
                "flex items-center justify-center h-9 w-9 mx-auto rounded-md transition-all",
                isActive 
                  ? "bg-violet-600/20 text-white border-l-2 border-violet-500" 
                  : isLocked
                    ? "text-slate-500 cursor-not-allowed"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
              data-testid={`nav-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <ItemIcon className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.title}
            {isLocked && <Lock className="h-3 w-3 text-slate-400" />}
          </TooltipContent>
        </Tooltip>
      );
    }
    
    return (
      <Link
        key={item.url}
        href={isLocked ? "#" : item.url}
        onClick={isLocked ? (e) => e.preventDefault() : handleItemClick}
        className={cn(
          "flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-all",
          isActive 
            ? "bg-violet-600/20 text-white border-l-2 border-violet-500 ml-0 pl-[10px]" 
            : isLocked
              ? "text-slate-500 cursor-not-allowed"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
        )}
        data-testid={`nav-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <ItemIcon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate flex-1">{item.title}</span>
        {isLocked && <Lock className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />}
      </Link>
    );
  };

  const renderCategorySection = (category: { title: string; icon: string; items: any[] }) => {
    const CategoryIcon = getIcon(category.icon);
    const isOpen = openCategories[category.title] ?? false;
    const hasAnyAccess = category.items.some(item => hasAccess(item.url, item.permissionKey));
    
    if (!hasAnyAccess && user?.role !== 'admin') {
      return null;
    }

    if (isCollapsed) {
      return (
        <div key={category.title} className="space-y-1">
          {category.items.map(item => renderNavItem(item))}
        </div>
      );
    }

    return (
      <Collapsible
        key={category.title}
        open={isOpen}
        onOpenChange={() => toggleCategory(category.title)}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors rounded-md hover:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <CategoryIcon className="h-4 w-4" />
            <span>{category.title}</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-3 space-y-0.5 mt-1">
          {category.items.map(item => renderNavItem(item))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Sidebar 
      collapsible="icon"
      className="bg-slate-900 dark:bg-slate-950 border-r border-slate-800"
    >
      <SidebarHeader 
        className="border-b border-slate-800 px-4 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3"
        data-testid="sidebar-header"
      >
        <Link 
          href="/" 
          onClick={() => isCollapsed && setOpen(true)}
          className="flex items-center gap-2"
          data-testid="link-home-logo"
        >
          <div className="flex flex-col items-start gap-1 group-data-[collapsible=icon]:hidden">
            <img src={turboLogoDark} alt="Turbo" className="h-6 w-auto" />
            <span className="text-xs font-medium text-slate-400">Cortex</span>
          </div>
          <div className="hidden group-data-[collapsible=icon]:block">
            <img src={turboLogoDark} alt="Turbo" className="h-7 w-7 object-contain" />
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="bg-slate-900 dark:bg-slate-950">
        <ScrollArea className="flex-1 px-2 py-2">
          <nav className="flex flex-col gap-1">
            {/* Acesso Rápido */}
            {!isCollapsed && (
              <div className="px-3 py-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Acesso Rápido
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              {NAV_CONFIG.quickAccess.map(item => renderNavItem(item))}
            </div>
            
            {!isCollapsed && <Separator className="my-3 bg-slate-800" />}
            
            {/* Setores */}
            {!isCollapsed && (
              <div className="px-3 py-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Setores
                </span>
              </div>
            )}
            
            {NAV_CONFIG.setores.map(category => renderCategorySection(category))}
            
            {/* G&G */}
            {renderCategorySection(NAV_CONFIG.gg)}
            
            {!isCollapsed && <Separator className="my-3 bg-slate-800" />}
            
            {/* Governança */}
            {!isCollapsed && (
              <div className="px-3 py-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Governança
                </span>
              </div>
            )}
            
            {NAV_CONFIG.governanca.map(category => renderCategorySection(category))}
            
            {/* Admin */}
            {user?.role === 'admin' && (
              <>
                {!isCollapsed && <Separator className="my-3 bg-slate-800" />}
                {!isCollapsed && (
                  <div className="px-3 py-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Administração
                    </span>
                  </div>
                )}
                {renderCategorySection(NAV_CONFIG.admin)}
              </>
            )}
          </nav>
        </ScrollArea>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-slate-800 bg-slate-900 dark:bg-slate-950 p-3">
        {user && (
          <div className="flex flex-col gap-3">
            <div className={cn(
              "flex items-center gap-3",
              isCollapsed && "justify-center"
            )}>
              <Avatar className="h-9 w-9 border border-slate-700">
                <AvatarImage src={user.picture} alt={user.name} />
                <AvatarFallback className="bg-slate-800 text-slate-300 text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-white truncate">
                    {user.name}
                  </span>
                  {roleBadge && (
                    <Badge 
                      variant={roleBadge.variant}
                      className={cn(
                        "w-fit text-[10px] px-1.5 py-0 h-4 mt-0.5",
                        roleBadge.variant === 'default' 
                          ? "bg-violet-600 hover:bg-violet-600 text-white"
                          : "bg-slate-700 hover:bg-slate-700 text-slate-300"
                      )}
                      data-testid="badge-user-role"
                    >
                      {roleBadge.label}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <Separator className="bg-slate-800" />
            
            <div className={cn(
              "flex items-center gap-1",
              isCollapsed ? "flex-col" : "justify-between"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    data-testid="button-theme-toggle-sidebar"
                  >
                    {theme === "light" ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "top"}>
                  {theme === "light" ? "Modo escuro" : "Modo claro"}
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    data-testid="button-notifications-sidebar"
                  >
                    <Bell className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "top"}>
                  Notificações
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/presentation"
                    className="flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    data-testid="button-presentation-sidebar"
                  >
                    <Tv className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "top"}>
                  Apresentação
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/meu-perfil"
                    className="flex items-center justify-center h-8 w-8 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    data-testid="button-settings-sidebar"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "top"}>
                  Configurações
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    data-testid="button-logout-sidebar"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "top"}>
                  Sair
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
