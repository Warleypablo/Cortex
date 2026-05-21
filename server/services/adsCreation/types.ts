/**
 * Tipos compartilhados pela feature de criação de campanhas Meta Ads.
 */

export type BudgetMode = "ABO" | "CBO";

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

export type CampaignMode = "new" | "existing";

export interface Briefing {
  /** Modo: criar nova campanha ou adicionar conjunto/ads a uma existente. */
  campaignMode: CampaignMode;
  /** Quando campaignMode = "existing": ID da campanha (ex: 120247...). Demais fields de campanha são ignorados. */
  existingCampaignId?: string;

  /** Nome literal da campanha — usado direto, sem prefixo automático. */
  campaignName: string;
  objective: MetaObjective;
  /** Padrão de orçamento. Default ABO (orçamento no conjunto). */
  budgetMode: BudgetMode;

  dailyBudgetCents: number;
  startDate: string; // ISO date
  endDate?: string; // ISO date, opcional

  audienceName: string;
  /** Nomes de saved audiences a excluir do targeting (ex: compradores, leads). Opcional. */
  excludedAudienceNames?: string[];
  /**
   * Se true, desativa a expansão automática Advantage+ — entrega só pro público salvo,
   * sem o Meta ampliar pra lookalikes/audiences semelhantes. Default: false (deixa o Meta expandir).
   */
  disableAdvantageExpansion?: boolean;
  placements: "auto" | Placement[];
  /**
   * Overrides por conjunto (modo bulk). Se um conjunto detectado tem entry aqui pelo `folderName`,
   * usa o público/orçamento override; senão cai pro `audienceName`/`dailyBudgetCents` do briefing.
   * Modo single ignora isso.
   */
  conjuntoOverrides?: ConjuntoOverride[];

  primaryText: string;
  headline?: string;
  description?: string;
  callToAction: MetaCallToAction;
  destinationUrl: string;

  driveFolderUrl: string;
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
  | "BOOK_TRAVEL"
  | "DOWNLOAD"
  | "WATCH_MORE"
  | "APPLY_NOW"
  | "GET_QUOTE";

/**
 * Override por conjunto (modo bulk). Identifica o conjunto pelo `folderName`
 * literal vindo do Drive. Campos opcionais — se vazio, usa o valor do briefing principal.
 */
export interface ConjuntoOverride {
  folderName: string;
  audienceName?: string;
  dailyBudgetCents?: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  kind: "image" | "video";
  buffer?: Buffer;
}

export interface UploadedMedia {
  fileName: string;
  kind: "image" | "video";
  imageHash?: string;
  videoId?: string;
}

/**
 * Um ad pareado entre formatos. Quando o conjunto tem subpastas 9x16/4x5,
 * cada par (mesmo basename) vira um `PairedAdMedia` com ambos os formatos.
 * Quando há um só formato, `format4x5` ou `format9x16` fica indefinido.
 */
export interface PairedAdMedia {
  /** Identificador estável do ad (basename sem extensão), usado pra debug/logs. */
  baseName: string;
  /** Variante 9x16 (Stories/Reels). */
  format9x16?: UploadedMedia;
  /** Variante 4x5 (Feed). */
  format4x5?: UploadedMedia;
  /** Quando o conjunto não tem subpastas de formato, o arquivo vai aqui. */
  default?: UploadedMedia;
  /** Nome final do ad (vem da Biblioteca de Criativos: nome_final). */
  finalAdName: string;
  /** Nome do arquivo principal (pra display/log). */
  primaryFileName: string;
}

/**
 * Um conjunto pronto pra ser enviado pro Meta. Agrupa pares de mídia +
 * metadata derivada da Biblioteca (Personagem) + nome do conjunto.
 */
export interface ConjuntoBatch {
  /** Personagem comum aos ads do conjunto (vem da Biblioteca de Criativos). */
  personagem: string;
  /** Nome-base do ad usado na composição do nome do conjunto. */
  adNameBase: string;
  /** Pares de mídia já com upload concluído (image_hash / video_id resolvidos). */
  ads: PairedAdMedia[];
  /** Display: nome literal da subpasta no Drive (pra status/logs). */
  folderName?: string;
  /**
   * Audience ID resolvido pra este conjunto (override). Quando undefined,
   * orchestrateCreation cai pro audienceId global.
   */
  audienceIdOverride?: string;
  /** Orçamento diário override em centavos. Quando undefined, usa briefing.dailyBudgetCents. */
  dailyBudgetCentsOverride?: number;
}

export type ConjuntoStatusName = "pending" | "running" | "done" | "failed";

export interface ConjuntoStatus {
  folderName: string;
  status: ConjuntoStatusName;
  adsetId?: string;
  adIds: string[];
  totalAds: number;
  error?: string;
}

export interface CreationResult {
  campaignId?: string;
  /** @deprecated mantido por compat — primeiro ID da lista `adsetIds`. */
  adsetId?: string;
  /** Conjuntos criados nessa execução (1 no modo single, N no bulk). */
  adsetIds: string[];
  adIds: string[];
  errors: string[];
  managerUrl?: string;
  /** Progresso por conjunto durante execução (atualizado incrementalmente). */
  conjuntos?: ConjuntoStatus[];
}

export interface SavedAudience {
  id: string;
  name: string;
  approximateCount?: number;
  subtype?: string;
}
