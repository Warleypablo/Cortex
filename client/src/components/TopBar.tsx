import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
}

export default function TopBar() {
  const [, setLocation] = useLocation();
  
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/auth/logout");
      setLocation("/login");
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
      </div>
      
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="gap-2 h-auto p-1.5 hover-elevate"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.picture} alt={user.name} />
                <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline-block">
                {user.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}