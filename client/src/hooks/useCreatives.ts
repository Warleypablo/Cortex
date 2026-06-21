import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { CreativeLibraryItem } from "@shared/schema";

export type Creative = CreativeLibraryItem;

export interface ListCreativesParams {
  q?: string;
  personagem?: string;
  produto?: string;
  etapaFunil?: string;
  adValidado?: boolean;
  comInvestimento?: boolean; // só criativos com spend > 0 na janela (ordenado por gasto)
  since?: string;
  until?: string;
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
  if (p.comInvestimento) {
    out.comInvestimento = "true";
    if (p.since) out.since = p.since;
    if (p.until) out.until = p.until;
  }
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
  formatoAd?: string | null;
  proporcao?: string | null;
  bodyTipo?: string | null;
  ctaTipo?: string | null;
  roteiroUrl?: string | null;
  clickupTaskId?: string | null;
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

// ============== Read-back: performance + ranking ==============

export interface CreativeMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpm: number | null;
  hookRate: number | null;
  holdRate: number | null;
  leads: number;
  mqls: number;
  percMql: number | null;
  vendas: number;
  receita: number;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
}

export interface CreativePerfRow extends CreativeMetrics {
  creativeId: number;
  tpId: string;
  nomeDrive: string;
  adId: string | null;
  angulo: string | null;
  personagem: string | null;
  tipoAd: string | null;
  produto: string | null;
  bodyTipo: string | null;
  ctaTipo: string | null;
  adCount: number;
}

export interface CreativeRankRow extends CreativeMetrics {
  dimension: string;
  value: string;
  criativos: number;
}

export interface PerfWindow {
  since: string;
  until: string;
}

export function useCreativePerformance(win: PerfWindow) {
  return useQuery<{ since: string; until: string; rows: CreativePerfRow[] }>({
    queryKey: ["/api/growth/creative-performance", { since: win.since, until: win.until }],
    staleTime: 60 * 1000,
  });
}

export function useCreativeRanking(win: PerfWindow, dimension: string) {
  return useQuery<{ since: string; until: string; dimension: string; rows: CreativeRankRow[] }>({
    queryKey: ["/api/growth/creative-ranking", { since: win.since, until: win.until, dimension }],
    staleTime: 60 * 1000,
  });
}

// ============== Vocabulário controlado ==============

export interface VocabItem {
  id: number;
  kind: string;
  value: string;
  label: string;
  sortOrder: number;
  active: boolean;
}

export function useCreativeVocab(kind?: string) {
  return useQuery<{ items: VocabItem[]; byKind: Record<string, VocabItem[]> }>({
    queryKey: kind
      ? ["/api/growth/creative-vocab", { kind }]
      : ["/api/growth/creative-vocab"],
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertVocab() {
  const qc = useQueryClient();
  return useMutation<
    VocabItem,
    Error,
    { kind: string; value: string; label: string; sortOrder?: number; active?: boolean }
  >({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/growth/creative-vocab", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/growth/creative-vocab"] });
    },
  });
}
