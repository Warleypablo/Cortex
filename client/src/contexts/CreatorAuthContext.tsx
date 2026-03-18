import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface CreatorUser {
  id: number;
  nome: string;
  email: string;
  cpf: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  chave_pix: string | null;
  tipo_pix: string | null;
}

interface CreatorAuthContextType {
  creator: CreatorUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetch: () => void;
}

const CreatorAuthContext = createContext<CreatorAuthContextType | undefined>(undefined);

export function CreatorAuthProvider({ children, token }: { children: ReactNode; token?: string | null }) {
  const queryClient = useQueryClient();

  // When token is present, pass as object param so getQueryFn appends ?token=...
  const queryKey: any[] = token
    ? ["/api/portal/creator/me", { token }]
    : ["/api/portal/creator/me"];

  const { data: creator, isLoading, refetch } = useQuery<CreatorUser | null>({
    queryKey,
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const logout = async () => {
    await fetch("/api/portal/creator/logout", { method: "POST" });
    queryClient.removeQueries({ queryKey: ["/api/portal/creator/me"] });
    window.location.href = "/portal/creator";
  };

  return (
    <CreatorAuthContext.Provider value={{
      creator: creator ?? null,
      isLoading,
      isAuthenticated: !!creator,
      logout,
      refetch,
    }}>
      {children}
    </CreatorAuthContext.Provider>
  );
}

export function useCreatorAuth(): CreatorAuthContextType {
  const context = useContext(CreatorAuthContext);
  if (!context) throw new Error("useCreatorAuth must be used within CreatorAuthProvider");
  return context;
}
