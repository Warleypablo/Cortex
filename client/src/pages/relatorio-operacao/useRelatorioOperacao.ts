import { useQuery } from "@tanstack/react-query";
import type { Comparativo, DetalheResp, CelulaSelecionada } from "./types";

async function buscar<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.details || body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export function useReporteOperacao(ate?: string) {
  return useQuery<Comparativo>({
    queryKey: ["/api/reports/operacao", ate ?? "atual"],
    queryFn: () => buscar(`/api/reports/operacao${ate ? `?ate=${ate}` : ""}`),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDetalheOperacao(celula: CelulaSelecionada | null) {
  return useQuery<DetalheResp>({
    queryKey: [
      "/api/reports/operacao/detalhe",
      celula?.metrica,
      celula?.inicio,
      celula?.fim,
      celula?.chave ?? null,
      celula?.campo ?? null,
    ],
    queryFn: () => {
      const p = new URLSearchParams({
        metrica: celula!.metrica,
        inicio: celula!.inicio,
        fim: celula!.fim,
      });
      if (celula!.chave) p.set("chave", celula!.chave);
      if (celula!.campo) p.set("campo", celula!.campo);
      return buscar(`/api/reports/operacao/detalhe?${p.toString()}`);
    },
    enabled: celula !== null,
    staleTime: 5 * 60 * 1000,
  });
}
