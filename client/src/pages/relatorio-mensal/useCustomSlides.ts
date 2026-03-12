import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CustomSlide {
  id: number;
  mes_ano: string;
  posicao: number;
  ordem: number;
  titulo: string | null;
  subtitulo: string | null;
  image_url: string | null;
}

export function useCustomSlides(mes: string) {
  const queryClient = useQueryClient();
  const queryKey = ["/api/reports/mensal/custom-slides", mes];

  const query = useQuery<CustomSlide[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/reports/mensal/custom-slides?mes=${mes}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar custom slides");
      return res.json();
    },
    enabled: !!mes,
    staleTime: 60_000,
  });

  const createSlide = useMutation({
    mutationFn: async (data: { mes_ano: string; posicao: number; titulo?: string; subtitulo?: string; image_url?: string }) => {
      const res = await fetch("/api/reports/mensal/custom-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao criar custom slide");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteSlide = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/reports/mensal/custom-slides/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao deletar custom slide");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    customSlides: query.data ?? [],
    isLoading: query.isLoading,
    createSlide,
    deleteSlide,
  };
}
