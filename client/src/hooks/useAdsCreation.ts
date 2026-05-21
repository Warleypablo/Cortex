import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type BudgetMode = "ABO" | "CBO";

export type CampaignMode = "new" | "existing";

export interface ExistingCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  created_time: string;
}

export type MetaObjective =
  | "OUTCOME_AWARENESS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_LEADS"
  | "OUTCOME_SALES"
  | "OUTCOME_APP_PROMOTION";

export type MetaCallToAction =
  | "LEARN_MORE"
  | "SHOP_NOW"
  | "SIGN_UP"
  | "SUBSCRIBE"
  | "CONTACT_US"
  | "GET_OFFER"
  | "DOWNLOAD"
  | "WATCH_MORE"
  | "APPLY_NOW"
  | "GET_QUOTE";

export type Placement =
  | "facebook_feed"
  | "facebook_profile_feed"
  | "facebook_stories"
  | "facebook_reels"
  | "facebook_marketplace"
  | "facebook_video_feeds"
  | "facebook_instream_video"
  | "facebook_right_column"
  | "instagram_feed"
  | "instagram_profile_feed"
  | "instagram_stories"
  | "instagram_reels"
  | "instagram_explore"
  | "instagram_explore_home"
  | "instagram_search";

export interface ConjuntoOverride {
  folderName: string;
  audienceName?: string;
  dailyBudgetCents?: number;
}

export interface BriefingPayload {
  campaignMode: CampaignMode;
  existingCampaignId?: string;
  campaignName: string;
  objective: MetaObjective;
  budgetMode: BudgetMode;
  dailyBudgetCents: number;
  startDate: string;
  endDate?: string;
  audienceName: string;
  excludedAudienceNames?: string[];
  disableAdvantageExpansion?: boolean;
  placements: "auto" | Placement[];
  conjuntoOverrides?: ConjuntoOverride[];
  primaryText: string;
  headline?: string;
  description?: string;
  callToAction: MetaCallToAction;
  destinationUrl: string;
  driveFolderUrl: string;
}

export interface ConjuntoStatusEntry {
  folderName: string;
  status: "pending" | "running" | "done" | "failed";
  adsetId?: string;
  adIds: string[];
  totalAds: number;
  error?: string;
}

export interface CreationDraft {
  id: number;
  userEmail: string;
  adAccountId: string;
  status: "draft" | "executing" | "created" | "failed";
  briefing: BriefingPayload;
  driveFolderUrl: string | null;
  result: {
    campaignId?: string;
    /** @deprecated usar `adsetIds`. */
    adsetId?: string;
    /** Conjuntos criados (1 no single, N no bulk). */
    adsetIds?: string[];
    adIds: string[];
    errors: string[];
    managerUrl?: string;
    conjuntos?: ConjuntoStatusEntry[];
  } | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
}

export interface SavedAudience {
  id: string;
  name: string;
  approximateCount?: number;
  subtype?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  kind: "image" | "video";
}

export interface PreviewFileEntry {
  id: string;
  name: string;
  kind: "image" | "video";
  inLibrary: boolean;
  /** "matched" = já cadastrado; "auto" = vai ser auto-cadastrado no submit; "unparseable" = nome fora do padrão, vai entrar como stub mínimo. */
  status?: "matched" | "auto" | "unparseable";
}

export interface CreativeStub {
  nomeDrive: string;
  linkDrive?: string | null;
  driveFileId?: string | null;
  personagem?: string | null;
  angulo?: string | null;
  produto?: string | null;
  etapaFunil?: string | null;
}

export interface PreviewConjunto {
  folderName: string;
  totalFiles: number;
  formats: Record<string, { count: number; files: PreviewFileEntry[] }>;
}

export type PreviewDriveResponse =
  | {
      mode: "single";
      files: (PreviewFileEntry & { mimeType: string })[];
      totalFiles: number;
      unmatchedFiles: string[];
      autoStubs: CreativeStub[];
      unparseableStubs: CreativeStub[];
    }
  | {
      mode: "bulk";
      conjuntos: PreviewConjunto[];
      totalConjuntos: number;
      totalFiles: number;
      unmatchedFiles: string[];
      autoStubs: CreativeStub[];
      unparseableStubs: CreativeStub[];
    };

export function useIsCreationApprover() {
  return useQuery<{ isApprover: boolean }>({
    queryKey: ["/api/growth/ads-creation/whoami"],
    staleTime: 5 * 60 * 1000,
  });
}

export function useCampaigns(enabled: boolean) {
  return useQuery<{ adAccountId: string; campaigns: ExistingCampaign[] }>({
    queryKey: ["/api/growth/ads-creation/campaigns"],
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAudiences(enabled: boolean) {
  return useQuery<{ adAccountId: string; audiences: SavedAudience[] }>({
    queryKey: ["/api/growth/ads-creation/audiences"],
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePreviewDrive() {
  return useMutation<PreviewDriveResponse, Error, string>({
    mutationFn: async (driveFolderUrl) => {
      const res = await apiRequest("POST", "/api/growth/ads-creation/preview-drive", {
        driveFolderUrl,
      });
      return res.json();
    },
  });
}

export function useCreateDraft() {
  return useMutation<{ draft: CreationDraft }, Error, BriefingPayload>({
    mutationFn: async (briefing) => {
      const res = await apiRequest("POST", "/api/growth/ads-creation/draft", { briefing });
      return res.json();
    },
  });
}

export interface ExecuteDraftPayload {
  id: number;
  autoStubs?: CreativeStub[];
  unparseableStubs?: CreativeStub[];
}

export function useExecuteDraft() {
  const queryClient = useQueryClient();
  return useMutation<{ id: number; status: string }, Error, ExecuteDraftPayload>({
    mutationFn: async ({ id, autoStubs, unparseableStubs }) => {
      const res = await apiRequest("POST", `/api/growth/ads-creation/execute/${id}`, {
        autoStubs: autoStubs ?? [],
        unparseableStubs: unparseableStubs ?? [],
      });
      return res.json();
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/growth/ads-creation/status/${payload.id}`],
      });
    },
  });
}

export function useLastDraft(enabled: boolean) {
  return useQuery<{ briefing: BriefingPayload | null; createdAt?: string }>({
    queryKey: ["/api/growth/ads-creation/last-draft"],
    enabled,
    staleTime: 30 * 1000,
  });
}

export interface HistoryItem {
  id: number;
  status: CreationDraft["status"];
  briefing: BriefingPayload;
  result: CreationDraft["result"];
  executedAt: string | null;
  createdAt: string;
}

export function useCreationHistory(enabled: boolean, limit = 10) {
  return useQuery<{ items: HistoryItem[] }>({
    queryKey: ["/api/growth/ads-creation/history", limit],
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useDraftStatus(id: number | null, enabled: boolean) {
  return useQuery<{
    id: number;
    status: CreationDraft["status"];
    result: CreationDraft["result"];
    errorMessage: string | null;
    executedAt: string | null;
  }>({
    queryKey: [`/api/growth/ads-creation/status/${id}`],
    enabled: enabled && id !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      return data.status === "executing" ? 2000 : false;
    },
  });
}

// Job ativo do usuário atual (executing, paused_rate_limit, paused_manual)
export interface ActiveJob {
  id: number;
  status: 'executing' | 'paused_rate_limit' | 'paused_manual';
  campaignName: string | null;
  uploadedCount: number;
  totalFiles: number | null;
  phase: 'upload' | 'create' | null;
  percent: number | null;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
}

export function useActiveJob(enabled: boolean) {
  return useQuery<{ active: ActiveJob | null }>({
    queryKey: ["/api/growth/ads-creation/active"],
    enabled,
    refetchInterval: (query) => {
      const active = query.state.data?.active;
      if (!active) return 30_000; // sem job: checar a cada 30s
      // Job rodando ou pausado: refresh mais agressivo pra UI ficar viva
      return active.status === 'executing' ? 3_000 : 10_000;
    },
  });
}

export function useResumeDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/growth/ads-creation/resume/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/growth/ads-creation/active"] });
    },
  });
}

export function useCancelDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/growth/ads-creation/cancel/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/growth/ads-creation/active"] });
      qc.invalidateQueries({ queryKey: ["/api/growth/ads-creation/history"] });
    },
  });
}
