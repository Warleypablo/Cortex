import { useQuery } from "@tanstack/react-query";
import type { SemanaMetricas, DetalheResp, CelulaSelecionada } from "./types";

async function buscar<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.details || body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export function useReporteSemanal(semanas = 12) {
  return useQuery<{ semanas: SemanaMetricas[] }>({
    queryKey: ["/api/reports/semanal", semanas],
    queryFn: () => buscar(`/api/reports/semanal?semanas=${semanas}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDetalheSemanal(celula: CelulaSelecionada | null) {
  return useQuery<DetalheResp>({
    queryKey: ["/api/reports/semanal/detalhe", celula?.metrica, celula?.inicio, celula?.fim],
    queryFn: () =>
      buscar(
        `/api/reports/semanal/detalhe?metrica=${celula!.metrica}&inicio=${celula!.inicio}&fim=${celula!.fim}`,
      ),
    enabled: celula !== null,
    staleTime: 5 * 60 * 1000,
  });
}
