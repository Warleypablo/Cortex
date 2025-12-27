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
                  ? "bg-primary/20 text-sidebar-foreground border-l-2 border-primary" 
                  : isLocked
                    ? "text-sidebar-foreground/40 cursor-not-allowed"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
              data-testid={`nav-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <ItemIcon className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            {item.title}
            {isLocked && <Lock className="h-3 w-3 text-sidebar-foreground/40" />}
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
            ? "bg-primary/20 text-sidebar-foreground border-l-2 border-primary ml-0 pl-[10px]" 
            : isLocked
              ? "text-sidebar-foreground/40 cursor-not-allowed"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
        data-testid={`nav-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <ItemIcon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate flex-1">{item.title}</span>
        {isLocked && <Lock className="h-3.5 w-3.5 text-sidebar-foreground/40 flex-shrink-0" />}
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
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors rounded-md hover:bg-sidebar-accent">
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
      className="bg-sidebar border-r border-sidebar-border"
    >
      <SidebarHeader 
        className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3"
        data-testid="sidebar-header"
      >
        <Link 
          href="/" 
          onClick={() => isCollapsed && setOpen(true)}
          className="flex items-center gap-2"
          data-testid="link-home-logo"
        >
          <div className="flex flex-col items-start gap-1 group-data-[collapsible=icon]:hidden">
            <img src={turboLogo} alt="Turbo" className="h-6 w-auto" />
            <span className="text-xs font-medium text-sidebar-foreground/60">Cortex</span>
          </div>
          <div className="hidden group-data-[collapsible=icon]:block">
            <img src={turboLogo} alt="Turbo" className="h-7 w-7 object-contain" />
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="bg-sidebar">
        <ScrollArea className="flex-1 px-2 py-2">
          <nav className="flex flex-col gap-1">
            {/* Setores - Primeiro */}
            {!isCollapsed && (
              <div className="flex items-center gap-2 px-3 py-2 mb-1">
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/20">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Setores
                </span>
                <Badge className="h-4 px-1.5 text-[9px] bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">
                  {NAV_CONFIG.setores.length + 3}
                </Badge>
              </div>
            )}
            
            {NAV_CONFIG.setores.map(category => renderCategorySection(category))}
            {renderCategorySection(NAV_CONFIG.gg)}
            {NAV_CONFIG.governanca.map(category => renderCategorySection(category))}
            {user?.role === 'admin' && renderCategorySection(NAV_CONFIG.admin)}
            
            {!isCollapsed && <Separator className="my-3 bg-sidebar-border" />}
            
            {/* Acesso Rápido - Segundo */}
            {!isCollapsed && (
              <div className="flex items-center gap-2 px-3 py-2 mb-1">
                <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
                  <Zap className="h-3.5 w-3.5 text-primary/70" />
                </div>
                <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">
                  Acesso Rápido
                </span>
                <Badge className="h-4 px-1.5 text-[9px] bg-primary/10 text-primary/70 border-primary/20 hover:bg-primary/10">
                  {NAV_CONFIG.quickAccess.length}
                </Badge>
              </div>
            )}
            <div className="space-y-0.5">
              {NAV_CONFIG.quickAccess.map(item => renderNavItem(item))}
            </div>
          </nav>
        </ScrollArea>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-3">
        {user && (
          <div className="flex flex-col gap-3">
            <Link
              href="/meu-perfil"
              className={cn(
                "flex items-center gap-3 rounded-md p-2 -m-2 hover:bg-sidebar-accent transition-colors cursor-pointer",
                isCollapsed && "justify-center"
              )}
              data-testid="link-user-profile"
            >
              <Avatar className="h-9 w-9 border border-sidebar-border">
                <AvatarImage src={user.picture} alt={user.name} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              
              {!isCollapsed && (
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium text-sidebar-foreground truncate">
                    {user.name}
                  </span>
                  {roleBadge && (
                    <Badge 
                      variant={roleBadge.variant}
                      className={cn(
                        "w-fit text-[10px] px-1.5 py-0 h-4 mt-0.5",
                        roleBadge.variant === 'default' 
                          ? "bg-primary hover:bg-primary text-primary-foreground"
                          : "bg-sidebar-accent hover:bg-sidebar-accent text-sidebar-foreground"
                      )}
                      data-testid="badge-user-role"
                    >
                      {roleBadge.label}
                    </Badge>
                  )}
                </div>
              )}
            </Link>
            
            <Separator className="bg-sidebar-border" />
            
            <div className={cn(
              "flex items-center gap-1",
              isCollapsed ? "flex-col" : "justify-between"
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
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
                    className="flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
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
                    className="flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
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
                    className="flex items-center justify-center h-8 w-8 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
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
                    className="flex items-center justify-center h-8 w-8 rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
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
