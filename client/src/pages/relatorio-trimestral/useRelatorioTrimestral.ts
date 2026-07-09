import { useQuery } from "@tanstack/react-query";
import type { RelatorioTrimestralData } from "./types";

export function useRelatorioTrimestral(trimestre: string) {
  return useQuery<RelatorioTrimestralData>({
    queryKey: ["/api/reports/trimestral", trimestre],
    queryFn: async () => {
      const res = await fetch(`/api/reports/trimestral?trimestre=${trimestre}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    enabled: !!trimestre,
    staleTime: 5 * 60 * 1000,
  });
}
