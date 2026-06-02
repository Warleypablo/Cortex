import { useAuth } from "@/contexts/AuthContext";

export function useIsColaboradoresRestrito(): boolean {
  const { user } = useAuth();
  if (!user || user.role === 'admin') return false;
  const routes = user.allowedRoutes ?? [];
  return routes.includes('gg.colaboradores_restrito') && !routes.includes('gg.colaboradores');
}
