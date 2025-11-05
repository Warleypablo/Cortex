import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Shield } from "lucide-react";

export default function TopBar() {
  const { user, logout, isSuperAdmin } = useAuth();

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user.email ? user.email[0].toUpperCase() : "U");

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-auto p-2 hover-elevate"
              data-testid="button-user-menu"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium leading-none">{user.name || user.email}</p>
                {isSuperAdmin && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                    <Shield className="w-3 h-3" />
                    Super Admin
                  </p>
                )}
              </div>
              <Avatar className="w-9 h-9" data-testid="avatar-user">
                <AvatarImage src={user.avatar || undefined} alt={user.name || user.email} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{user.name || user.email}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}