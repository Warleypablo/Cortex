import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, AlertTriangle, XCircle, HelpCircle, 
  Target, Calendar, Tag, FileQuestion 
} from "lucide-react";

type MetricStatus = "on_track" | "attention" | "off_track" | "no_data";

interface MetricStatusBadgeProps {
  status: MetricStatus;
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<MetricStatus, { 
  label: string; 
  icon: typeof CheckCircle2; 
  className: string;
}> = {
  on_track: {
    label: "No caminho",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  attention: {
    label: "Atenção",
    icon: AlertTriangle,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  },
  off_track: {
    label: "Fora do caminho",
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  no_data: {
    label: "Sem dados",
    icon: HelpCircle,
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  },
};

export function MetricStatusBadge({ 
  status, 
  showIcon = true, 
  showLabel = true,
  className 
}: MetricStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, "gap-1 font-medium", className)}
      data-testid={`badge-status-${status}`}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {showLabel && <span>{config.label}</span>}
    </Badge>
  );
}

type ObjectiveKey = "O1" | "O2" | "O3" | "O4" | "O5";

interface ObjectiveBadgeProps {
  objective: ObjectiveKey | string;
  showLabel?: boolean;
  className?: string;
}

const objectiveConfig: Record<ObjectiveKey, { 
  label: string; 
  className: string;
  fullLabel: string;
}> = {
  O1: {
    label: "O1",
    fullLabel: "Ecossistema",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  O2: {
    label: "O2",
    fullLabel: "Eficiência & Sistemas",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  },
  O3: {
    label: "O3",
    fullLabel: "Saúde da Receita (Hugz)",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  O4: {
    label: "O4",
    fullLabel: "TurboOH",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  },
  O5: {
    label: "O5",
    fullLabel: "Padronização & Produto",
    className: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  },
};

export function ObjectiveBadge({ objective, showLabel = false, className }: ObjectiveBadgeProps) {
  const key = objective.toUpperCase() as ObjectiveKey;
  const config = objectiveConfig[key] || {
    label: objective,
    fullLabel: objective,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  };
  
  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, "gap-1 font-semibold", className)}
      data-testid={`badge-objective-${objective}`}
    >
      <Target className="w-3 h-3" />
      <span>{config.label}</span>
      {showLabel && <span className="font-normal">· {config.fullLabel}</span>}
    </Badge>
  );
}

type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

interface QuarterBadgeProps {
  quarter: Quarter | string;
  year?: number;
  className?: string;
}

export function QuarterBadge({ quarter, year, className }: QuarterBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border-slate-200 dark:border-slate-700 gap-1 font-medium",
        className
      )}
      data-testid={`badge-quarter-${quarter}`}
    >
      <Calendar className="w-3 h-3" />
      <span>{quarter}{year ? `/${year}` : ""}</span>
    </Badge>
  );
}

interface TagBadgeProps {
  tag: string;
  variant?: "default" | "outline";
  className?: string;
  onRemove?: () => void;
}

export function TagBadge({ tag, variant = "outline", className, onRemove }: TagBadgeProps) {
  return (
    <Badge 
      variant={variant}
      className={cn(
        "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 gap-1 text-xs",
        className
      )}
      data-testid={`badge-tag-${tag}`}
    >
      <Tag className="w-2.5 h-2.5" />
      <span>{tag}</span>
      {onRemove && (
        <button 
          onClick={onRemove} 
          className="ml-1 hover:text-indigo-900 dark:hover:text-indigo-100"
          aria-label={`Remover tag ${tag}`}
        >
          ×
        </button>
      )}
    </Badge>
  );
}

interface KRLinkBadgeProps {
  krKey: string;
  className?: string;
}

export function KRLinkBadge({ krKey, className }: KRLinkBadgeProps) {
  return (
    <Badge 
      variant="outline"
      className={cn(
        "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 gap-1 text-xs font-mono",
        className
      )}
      data-testid={`badge-kr-${krKey}`}
    >
      {krKey}
    </Badge>
  );
}

interface ConfidencePillProps {
  value: number;
  className?: string;
}

export function ConfidencePill({ value, className }: ConfidencePillProps) {
  const getColor = (v: number) => {
    if (v >= 80) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200";
    if (v >= 60) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200";
    if (v >= 40) return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200";
  };
  
  return (
    <Badge 
      variant="outline"
      className={cn(getColor(value), "font-medium", className)}
      data-testid={`pill-confidence-${value}`}
    >
      {value}% confiança
    </Badge>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: typeof FileQuestion;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  icon: Icon = FileQuestion,
  action,
  className 
}: EmptyStateProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
      data-testid="empty-state"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          data-testid="button-empty-state-action"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface InitiativeStatusBadgeProps {
  status: string;
  className?: string;
}

const initiativeStatusConfig: Record<string, { 
  label: string; 
  className: string;
}> = {
  backlog: {
    label: "Backlog",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  },
  doing: {
    label: "Em andamento",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  done: {
    label: "Concluído",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  blocked: {
    label: "Bloqueado",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
  },
};

export function InitiativeStatusBadge({ status, className }: InitiativeStatusBadgeProps) {
  const statusLower = status.toLowerCase();
  const config = initiativeStatusConfig[statusLower] || {
    label: status,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  };
  
  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, "font-medium", className)}
      data-testid={`badge-initiative-status-${statusLower}`}
    >
      {config.label}
    </Badge>
  );
}

export function NoDataValue({ label = "—" }: { label?: string }) {
  return (
    <span 
      className="text-muted-foreground/60 italic"
      data-testid="no-data-value"
    >
      {label}
    </span>
  );
}

export function formatMetricValue(
  value: number | null | undefined, 
  unit: string,
  options?: { compact?: boolean; decimals?: number }
): string {
  if (value === null || value === undefined) return "—";
  
  const { compact = false, decimals = 2 } = options || {};
  
  if (unit === "BRL" || unit === "R$") {
    if (compact && Math.abs(value) >= 1000) {
      if (Math.abs(value) >= 1000000) {
        return `R$ ${(value / 1000000).toFixed(1)}M`;
      }
      return `R$ ${(value / 1000).toFixed(0)}k`;
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  
  if (unit === "PCT" || unit === "%") {
    return `${(value * 100).toFixed(decimals)}%`;
  }
  
  if (unit === "COUNT" || unit === "#") {
    return new Intl.NumberFormat("pt-BR").format(Math.round(value));
  }
  
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function getStatusFromProgress(
  current: number | null | undefined, 
  target: number | null | undefined,
  direction: "gte" | "lte" = "gte"
): MetricStatus {
  if (current === null || current === undefined || target === null || target === undefined) {
    return "no_data";
  }
  
  if (direction === "gte") {
    const pct = (current / target) * 100;
    if (pct >= 100) return "on_track";
    if (pct >= 90) return "attention";
    return "off_track";
  } else {
    const ratio = current / target;
    if (ratio <= 1) return "on_track";
    if (ratio <= 1.1) return "attention";
    return "off_track";
  }
}
