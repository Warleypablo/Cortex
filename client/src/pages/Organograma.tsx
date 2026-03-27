import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Crown, Users, User, Building2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

interface Member {
  nome: string;
  cargo: string;
}

interface Team {
  name: string;
  leader: string | null;
  leaderCargo: string | null;
  members: Member[];
}

interface Department {
  name: string;
  color: string;
  teams: Team[];
}

interface OrgData {
  ceo: { nome: string; cargo: string };
  departments: Department[];
  totalColaboradores: number;
}

// ── Color mapping ─────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, {
  border: string; headerBg: string; headerText: string; badge: string; accent: string;
}> = {
  purple: {
    border: "border-purple-300 dark:border-purple-700",
    headerBg: "bg-purple-500 dark:bg-purple-600",
    headerText: "text-white",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
    accent: "border-purple-300 dark:border-purple-700",
  },
  blue: {
    border: "border-blue-300 dark:border-blue-700",
    headerBg: "bg-blue-500 dark:bg-blue-600",
    headerText: "text-white",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    accent: "border-blue-300 dark:border-blue-700",
  },
  emerald: {
    border: "border-emerald-300 dark:border-emerald-700",
    headerBg: "bg-emerald-500 dark:bg-emerald-600",
    headerText: "text-white",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    accent: "border-emerald-300 dark:border-emerald-700",
  },
  orange: {
    border: "border-orange-300 dark:border-orange-700",
    headerBg: "bg-orange-500 dark:bg-orange-600",
    headerText: "text-white",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
    accent: "border-orange-300 dark:border-orange-700",
  },
  gray: {
    border: "border-gray-300 dark:border-zinc-600",
    headerBg: "bg-gray-500 dark:bg-zinc-600",
    headerText: "text-white",
    badge: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
    accent: "border-gray-300 dark:border-zinc-600",
  },
};

// ── Tree building blocks ──────────────────────────────────────────────

function VLine({ height = "h-6" }: { height?: string }) {
  return (
    <div className="flex justify-center">
      <div className={cn("w-px bg-gray-300 dark:bg-zinc-600", height)} />
    </div>
  );
}

/**
 * Horizontal connector line that spans from the center of the first child
 * to the center of the last child. We render it as a single horizontal bar.
 */
function HConnector() {
  return (
    <div className="h-px bg-gray-300 dark:bg-zinc-600 self-stretch" />
  );
}

// ── Card components ───────────────────────────────────────────────────

function CeoCard({ ceo }: { ceo: OrgData["ceo"] }) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-xl px-6 py-4 text-center shadow-lg shadow-amber-100/50 dark:shadow-amber-900/20 min-w-[160px]">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Crown className="h-5 w-5 text-amber-500" />
        <span className="font-bold text-lg text-gray-900 dark:text-white">{ceo.nome}</span>
      </div>
      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{ceo.cargo}</span>
    </div>
  );
}

function DeptCard({ dept, memberCount }: { dept: Department; memberCount: number }) {
  const colors = DEPT_COLORS[dept.color] || DEPT_COLORS.gray;
  return (
    <div className={cn("rounded-lg border-2 overflow-hidden min-w-[120px] shadow-sm", colors.border)}>
      <div className={cn("px-4 py-2.5 text-center", colors.headerBg)}>
        <div className={cn("font-semibold text-sm", colors.headerText)}>{dept.name}</div>
      </div>
      <div className="px-3 py-2 bg-white dark:bg-zinc-900 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
          <Users className="h-3 w-3" />
          <span>{memberCount} pessoas</span>
        </div>
      </div>
    </div>
  );
}

function TeamCard({
  team,
  color,
  isExpanded,
  onToggle,
}: {
  team: Team;
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colors = DEPT_COLORS[color] || DEPT_COLORS.gray;
  const totalMembers = team.members.length + (team.leader ? 1 : 0);

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onToggle}
        className={cn(
          "rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden min-w-[130px] max-w-[180px] shadow-sm transition-all hover:shadow-md cursor-pointer text-left",
          colors.accent
        )}
      >
        <div className="px-3 py-2.5">
          <div className="font-medium text-xs text-gray-900 dark:text-white text-center">{team.name}</div>
          {team.leader && (
            <div className="flex items-center justify-center gap-1 mt-1">
              <Crown className="h-2.5 w-2.5 text-amber-500" />
              <span className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">{team.leader}</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", colors.badge)}>
              {totalMembers}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-gray-400 dark:text-zinc-500" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded member list */}
      {isExpanded && (
        <>
          <VLine height="h-3" />
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-2 max-w-[200px] shadow-sm">
            {team.leader && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 mb-1">
                <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="text-[11px] font-medium text-gray-900 dark:text-white truncate">{team.leader}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1 justify-center">
              {team.members.map((m, i) => (
                <span
                  key={`${m.nome}-${i}`}
                  className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 px-1.5 py-0.5 rounded truncate max-w-[90px]"
                  title={`${m.nome} - ${m.cargo}`}
                >
                  {m.nome.split(" ").slice(0, 2).join(" ")}
                </span>
              ))}
              {team.members.length === 0 && !team.leader && (
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">Sem membros</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Department branch (dept card + its teams below) ───────────────────

function DepartmentBranch({
  dept,
  expandedTeam,
  onToggleTeam,
}: {
  dept: Department;
  expandedTeam: string | null;
  onToggleTeam: (teamKey: string) => void;
}) {
  const memberCount = dept.teams.reduce(
    (sum, t) => sum + t.members.length + (t.leader ? 1 : 0),
    0
  );

  return (
    <div className="flex flex-col items-center">
      <VLine />
      <DeptCard dept={dept} memberCount={memberCount} />

      {dept.teams.length > 0 && (
        <>
          <VLine />
          {/* Teams row with horizontal connector */}
          <div className="flex flex-col items-center">
            {dept.teams.length > 1 && (
              <div className="relative w-full flex">
                {/* Horizontal line across teams */}
                <div className="absolute top-0 left-0 right-0 flex">
                  <div className="flex-1" />
                  {dept.teams.map((_, i) => (
                    <div key={i} className="flex-1 relative">
                      {i === 0 && (
                        <div className="absolute top-0 right-0 left-1/2 h-px bg-gray-300 dark:bg-zinc-600" />
                      )}
                      {i === dept.teams.length - 1 && (
                        <div className="absolute top-0 left-0 right-1/2 h-px bg-gray-300 dark:bg-zinc-600" />
                      )}
                      {i > 0 && i < dept.teams.length - 1 && (
                        <div className="absolute top-0 left-0 right-0 h-px bg-gray-300 dark:bg-zinc-600" />
                      )}
                    </div>
                  ))}
                  <div className="flex-1" />
                </div>
              </div>
            )}
            <div className={cn("flex items-start", dept.teams.length > 1 ? "gap-3" : "gap-0")}>
              {dept.teams.map((team) => {
                const teamKey = `${dept.name}::${team.name}`;
                return (
                  <div key={team.name} className="flex flex-col items-center">
                    <VLine height={dept.teams.length > 1 ? "h-0" : "h-0"} />
                    <TeamCard
                      team={team}
                      color={dept.color}
                      isExpanded={expandedTeam === teamKey}
                      onToggle={() => onToggleTeam(teamKey)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function Organograma() {
  usePageTitle("Organograma");
  useSetPageInfo("Organograma", "Estrutura organizacional da Turbo Partners");

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<OrgData>({
    queryKey: ["/api/geg/organograma"],
  });

  const toggleTeam = (teamKey: string) => {
    setExpandedTeam((prev) => (prev === teamKey ? null : teamKey));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-zinc-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 dark:text-zinc-400">
        Erro ao carregar organograma. Tente novamente.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
          <Building2 className="h-4 w-4" />
          <span>{data.departments.length} departamentos</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
          <Users className="h-4 w-4" />
          <span>{data.totalColaboradores} colaboradores ativos</span>
        </div>
      </div>

      {/* Tree */}
      <div className="overflow-x-auto pb-8">
        <div className="flex flex-col items-center min-w-fit">
          {/* CEO */}
          <CeoCard ceo={data.ceo} />

          {/* Vertical line from CEO */}
          <VLine />

          {/* Horizontal connector across all departments */}
          {data.departments.length > 1 && (
            <div className="relative w-full">
              <div className="flex">
                {data.departments.map((_, i) => (
                  <div key={i} className="flex-1 relative h-px">
                    {i === 0 && (
                      <div className="absolute top-0 right-0 left-1/2 h-px bg-gray-300 dark:bg-zinc-600" />
                    )}
                    {i === data.departments.length - 1 && (
                      <div className="absolute top-0 left-0 right-1/2 h-px bg-gray-300 dark:bg-zinc-600" />
                    )}
                    {i > 0 && i < data.departments.length - 1 && (
                      <div className="absolute top-0 left-0 right-0 h-px bg-gray-300 dark:bg-zinc-600" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Department branches */}
          <div className="flex items-start gap-6">
            {data.departments.map((dept) => (
              <DepartmentBranch
                key={dept.name}
                dept={dept}
                expandedTeam={expandedTeam}
                onToggleTeam={toggleTeam}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 dark:text-zinc-500 pt-4 border-t border-gray-100 dark:border-zinc-800">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          Clique em uma equipe para ver os membros
        </span>
      </div>
    </div>
  );
}
