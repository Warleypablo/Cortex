import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface ClientUser {
  id: number;
  nome: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  ativo: string | boolean | null;
}

interface ClientAuthContextType {
  client: ClientUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery<ClientUser | null>({
    queryKey: ["/api/auth/client-me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const logout = async () => {
    await fetch("/auth/client-logout", { method: "POST" });
    queryClient.removeQueries({ queryKey: ["/api/auth/client-me"] });
    window.location.href = "/login";
  };

  return (
    <ClientAuthContext.Provider value={{
      client: client ?? null,
      isLoading,
      isAuthenticated: !!client,
      logout,
    }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth(): ClientAuthContextType {
  const context = useContext(ClientAuthContext);
  if (!context) throw new Error("useClientAuth must be used within ClientAuthProvider");
  return context;
}
