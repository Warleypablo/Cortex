import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface OptimizationProposal {
  id: number;
  batchId: string;
  proposedEntityType: "campaign" | "adset" | "ad";
  proposedEntityId: string;
  proposedEntityName: string | null;
  proposedAction: "pause" | "reactivate";
  finalEntityType: "campaign" | "adset" | "ad" | null;
  finalEntityId: string | null;
  finalEntityName: string | null;
  finalAction: "pause" | "reactivate" | "skip" | null;
  produto: string | null;
  reason: string;
  currentMetrics: Record<string, unknown>;
  playbookRule: string | null;
  status: "pending" | "approved" | "rejected" | "edited" | "executed" | "failed";
  createdAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  editNotes: string | null;
  executedAt: string | null;
  executionError: string | null;
}

export interface IgnoredEntity {
  id: string;
  name: string;
  reason: string;
}

export interface ProposeResponse {
  batchId: string;
  ranSync: boolean;
  lastSyncAt: string;
  totalCandidates: number;
  totalEvaluated: number;
  proposals: OptimizationProposal[];
  ignored: IgnoredEntity[];
}

export interface ExecuteResult {
  id: number;
  status: "executed" | "failed";
  note?: string;
  error?: string;
}

export function useIsApprover() {
  return useQuery<{ isApprover: boolean }>({
    queryKey: ["/api/growth/ads-optimization/whoami"],
    staleTime: 5 * 60 * 1000,
  });
}

export function useProposeOptimization() {
  return useMutation<ProposeResponse, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/growth/ads-optimization/propose");
      return res.json();
    },
  });
}

export function usePatchProposal() {
  const queryClient = useQueryClient();
  return useMutation<
    { proposal: OptimizationProposal },
    Error,
    {
      id: number;
      batchId: string;
      status: "approved" | "rejected" | "edited";
      finalEntityType?: "campaign" | "adset" | "ad";
      finalEntityId?: string;
      finalEntityName?: string;
      finalAction?: "pause" | "reactivate" | "skip";
      editNotes?: string;
    }
  >({
    mutationFn: async ({ id, ...body }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/growth/ads-optimization/proposals/${id}`,
        body,
      );
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/growth/ads-optimization/proposals/${vars.batchId}`],
      });
    },
  });
}

export function useExecuteBatch() {
  const queryClient = useQueryClient();
  return useMutation<
    { batchId: string; results: ExecuteResult[] },
    Error,
    { batchId: string }
  >({
    mutationFn: async ({ batchId }) => {
      const res = await apiRequest(
        "POST",
        "/api/growth/ads-optimization/execute",
        { batchId },
      );
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/growth/ads-optimization/proposals/${vars.batchId}`],
      });
    },
  });
}
