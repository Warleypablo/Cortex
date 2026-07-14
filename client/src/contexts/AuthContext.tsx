import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { PERMISSION_TO_ROUTES } from "@shared/nav-config";
import { BP2026_ROUTE, podeAcessarBp2026 } from "@shared/bp2026-tabs";
import { cargoTemAcessoMapaDisc } from "@shared/disc";

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
  allowedBpTabs: string[];
  department: 'admin' | 'comercial' | 'financeiro' | 'operacao' | null;
  cargo?: string | null;
}

// Rota do Mapa DISC — restrita a cargos de liderança (além de admin e liberação manual).
export const DISC_MAPA_ROUTE = '/gg/disc/mapa';

interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  hasAccess: (path: string) => boolean;
}

// Rotas acessíveis a todos os usuários autenticados (sem precisar de permissão).
// O Mapa DISC (/gg/disc/mapa) NÃO é público — é gateado por cargo em hasAccess.
const PUBLIC_ROUTES = ['/rh/nps/responder', '/meu-perfil', '/gg/disc'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const hasAccess = (path: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (PUBLIC_ROUTES.includes(path)) return true;
    if (path === DISC_MAPA_ROUTE && cargoTemAcessoMapaDisc(user.cargo)) return true;
    if (path === BP2026_ROUTE && podeAcessarBp2026(user.role, user.allowedBpTabs)) return true;
    if (user.allowedRoutes?.includes(path)) return true;
    for (const perm of (user.allowedRoutes ?? [])) {
      if (PERMISSION_TO_ROUTES[perm]?.includes(path)) return true;
    }
    return false;
  };

  const value: AuthContextType = {
    user: user ?? null,
    isLoading,
    error: error as Error | null,
    isAuthenticated: !!user,
    hasAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
