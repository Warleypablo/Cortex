import { useQuery } from "@tanstack/react-query";
import type { RelatorioSemanalData } from "./types";

export function useRelatorioSemanal(ate?: string) {
  const qs = ate ? `?ate=${ate}` : "";
  return useQuery<RelatorioSemanalData>({
    queryKey: ["/api/reports/semanal", ate ?? "hoje"],
    queryFn: async () => {
      const res = await fetch(`/api/reports/semanal${qs}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || `Erro ${res.status}`);
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
