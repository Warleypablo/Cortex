import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CreativeLibraryItem } from "@shared/schema";
import { sumRaw, computeDerived, type CriativoData } from "@/lib/criativosMetrics";

export type Creative = CreativeLibraryItem;

export interface ListCreativesParams {
  q?: string;
  personagem?: string;
  produto?: string;
  etapaFunil?: string;
  adValidado?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListCreativesResult {
  rows: Creative[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreativeOptions {
  personagem: string[];
  produto: string[];
  etapaFunil: string[];
  plataforma: string[];
  tipoAd: string[];
}

export function useIsCreativesApprover() {
  return useQuery<{ isApprover: boolean }>({
    queryKey: ["/api/growth/creatives/whoami"],
    staleTime: 5 * 60 * 1000,
  });
}

function paramsToQuery(p: ListCreativesParams): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.q) out.q = p.q;
  if (p.personagem) out.personagem = p.personagem;
  if (p.produto) out.produto = p.produto;
  if (p.etapaFunil) out.etapaFunil = p.etapaFunil;
  if (typeof p.adValidado === "boolean") out.adValidado = String(p.adValidado);
  if (p.page) out.page = String(p.page);
  if (p.pageSize) out.pageSize = String(p.pageSize);
  return out;
}

export function useCreativesList(params: ListCreativesParams) {
  return useQuery<ListCreativesResult>({
    queryKey: ["/api/growth/creatives", paramsToQuery(params)],
    staleTime: 30 * 1000,
  });
}

export function useCreativeOptions() {
  return useQuery<CreativeOptions>({
    queryKey: ["/api/growth/creatives/options"],
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreativeById(id: number | null) {
  return useQuery<Creative>({
    queryKey: [`/api/growth/creatives/${id}`],
    enabled: id != null,
  });
}

export interface CreativePayload {
  nomeDrive: string;
  linkDrive?: string | null;
  driveFileId?: string | null;
  angulo?: string | null;
  etapaFunil?: string | null;
  dataPostagem?: string | null;
  produto?: string | null;
  plataforma?: string | null;
  personagem?: string | null;
  tipoAd?: string | null;
  observacao?: string | null;
  adValidado?: boolean;
}

export function useCreateCreative() {
  const qc = useQueryClient();
  return useMutation<Creative, Error, CreativePayload>({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/growth/creatives", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/growth/creatives"] });
      qc.invalidateQueries({ queryKey: ["/api/growth/creatives/options"] });
    },
  });
}

export function useUpdateCreative() {
  const qc = useQueryClient();
  return useMutation<Creative, Error, { id: number; patch: Partial<CreativePayload> }>({
    mutationFn: async ({ id, patch }) => {
      const res = await apiRequest("PATCH", `/api/growth/creatives/${id}`, patch);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/growth/creatives"] });
      qc.invalidateQueries({ queryKey: [`/api/growth/creatives/${vars.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/growth/creatives/options"] });
    },
  });
}

export function useBulkUpdateCreatives() {
  const qc = useQueryClient();
  return useMutation<
    { updated: number; failed: number; total: number },
    Error,
    { ids: number[]; patch: Partial<CreativePayload> }
  >({
    mutationFn: async ({ ids, patch }) => {
      const res = await apiRequest("PATCH", "/api/growth/creatives/bulk", { ids, patch });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/growth/creatives"] });
      qc.invalidateQueries({ queryKey: ["/api/growth/creatives/options"] });
    },
  });
}

export function useDeleteCreative() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/growth/creatives/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/growth/creatives"] });
    },
  });
}

// ============== Performance por TP (lifetime) ==============
// Métricas de anúncio (Meta/Google/TikTok) agregadas por TP do criativo.
// Casamento: o adName do anúncio começa com o TP (nomeFinal = "{TP} - {nomeDrive} - {data}").
export type CreativeMetrics = ReturnType<typeof computeDerived>;

const TP_RE = /^(TP\d+)\b/i;

export function tpFromAdName(adName: string | null | undefined): string | null {
  if (!adName) return null;
  const m = adName.match(TP_RE);
  return m ? m[1].toUpperCase() : null;
}

export function useCreativeMetricsByTp() {
  return useQuery<Map<string, CreativeMetrics>>({
    queryKey: ["/api/growth/criativos", "biblioteca-lifetime"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Lifetime: janela bem ampla cobre todo o histórico do anúncio.
      const params = new URLSearchParams({
        startDate: "2020-01-01",
        endDate: "2030-12-31",
        plataforma: "Todos",
        status: "Todos",
      });
      const res = await fetch(`/api/growth/criativos?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao carregar métricas dos criativos");
      const rows = (await res.json()) as CriativoData[];

      const byTp = new Map<string, CriativoData[]>();
      for (const row of rows) {
        const tp = tpFromAdName(row.adName);
        if (!tp) continue;
        const arr = byTp.get(tp);
        if (arr) arr.push(row);
        else byTp.set(tp, [row]);
      }

      const out = new Map<string, CreativeMetrics>();
      byTp.forEach((tpRows, tp) => {
        out.set(tp, computeDerived(sumRaw(tpRows)));
      });
      return out;
    },
  });
}
