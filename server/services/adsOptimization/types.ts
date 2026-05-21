/**
 * Tipos compartilhados pelo agente de otimização de ads.
 */

export type EntityType = "campaign" | "adset" | "ad";
export type ActionType = "pause" | "reactivate" | "skip";
export type ProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "edited"
  | "executed"
  | "failed";

export interface ProductTarget {
  produto: string;
  cpmqlAlvo: number;
  mqlMinPct: number | null;
  cplAlvo: number | null;
  toleranciaPct: number;
}

export interface ParsedPlaybook {
  cooldownHoras: number;
  janelaAvaliacaoDias: number;
  whitelistPatterns: string[];
  knownProdutos: string[];
  rawMarkdown: string;
}

export interface WindowMetrics {
  spend: number;
  leads: number;
  mqls: number;
  cpmql: number | null;
  percMql: number | null;
  cpl: number | null;
}

export interface EntitySnapshot {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  campaignName: string | null;
  adsetName: string | null;
  produto: string | null;
  status: string;
  effectiveStatus: string;
  inLearning: boolean;
  ageInDays: number;
  dailyBudget: number | null;
  isScaled: boolean;
  d14: WindowMetrics;
  d7: WindowMetrics;
  d3: WindowMetrics;
}

export interface AgentProposal {
  proposedEntityType: EntityType;
  proposedEntityId: string;
  proposedEntityName: string;
  proposedAction: Exclude<ActionType, "skip">;
  produto: string | null;
  reason: string;
  currentMetrics: Record<string, unknown>;
  playbookRule: string;
}

export interface AdsExecutor {
  pauseCampaign(id: string): Promise<void>;
  pauseAdSet(id: string): Promise<void>;
  pauseAd(id: string): Promise<void>;
  reactivateCampaign(id: string): Promise<void>;
  reactivateAdSet(id: string): Promise<void>;
  reactivateAd(id: string): Promise<void>;
  getEntityStatus(
    entityType: EntityType,
    entityId: string,
  ): Promise<string>;
}
