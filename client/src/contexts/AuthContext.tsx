import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: string;
  role: 'admin' | 'user';
  allowedRoutes: string[];
  department: 'admin' | 'comercial' | 'financeiro' | 'operacao' | null;
}

interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  hasAccess: (path: string) => boolean;
}

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
    return user.allowedRoutes?.includes(path) ?? false;
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
