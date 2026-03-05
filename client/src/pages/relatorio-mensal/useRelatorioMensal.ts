import { useQuery } from "@tanstack/react-query";
import type { RelatorioMensalData } from "./types";

export function useRelatorioMensal(mes: string) {
  return useQuery<RelatorioMensalData>({
    queryKey: ["/api/reports/mensal", mes],
    queryFn: async () => {
      const res = await fetch(`/api/reports/mensal?mes=${mes}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    enabled: !!mes,
    staleTime: 5 * 60 * 1000,
  });
}
