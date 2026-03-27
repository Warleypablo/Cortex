import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { ChevronDown, ChevronRight, Crown, Users, User, Building2, Loader2 } from "lucide-react";

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
  bg: string; border: string; text: string; badge: string; lightBg: string; accent: string;
}> = {
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-700 dark:text-purple-300",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
    lightBg: "bg-purple-25 dark:bg-purple-950/10",
    accent: "bg-purple-500",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    lightBg: "bg-blue-25 dark:bg-blue-950/10",
    accent: "bg-blue-500",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    lightBg: "bg-emerald-25 dark:bg-emerald-950/10",
    accent: "bg-emerald-500",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
    lightBg: "bg-orange-25 dark:bg-orange-950/10",
    accent: "bg-orange-500",
  },
  gray: {
    bg: "bg-gray-50 dark:bg-zinc-900/50",
    border: "border-gray-200 dark:border-zinc-700",
    text: "text-gray-700 dark:text-zinc-300",
    badge: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
    lightBg: "bg-gray-25 dark:bg-zinc-950/10",
    accent: "bg-gray-500",
  },
};

// ── Components ────────────────────────────────────────────────────────

function CeoCard({ ceo }: { ceo: OrgData["ceo"] }) {
  return (
    <div className="flex justify-center">
      <div className="relative">
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-xl px-8 py-5 text-center shadow-lg shadow-amber-100/50 dark:shadow-amber-900/20">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Crown className="h-5 w-5 text-amber-500" />
            <span className="font-bold text-lg text-gray-900 dark:text-white">{ceo.nome}</span>
          </div>
          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{ceo.cargo}</span>
        </div>
        {/* Vertical connector line */}
        <div className="absolute left-1/2 -translate-x-px bottom-0 translate-y-full w-0.5 h-8 bg-gray-300 dark:bg-zinc-600" />
      </div>
    </div>
  );
}

function TeamSection({ team, colors }: { team: Team; colors: typeof DEPT_COLORS["purple"] }) {
  const [isOpen, setIsOpen] = useState(false);
  const totalMembers = team.members.length + (team.leader ? 1 : 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left",
            "bg-white dark:bg-zinc-800/80 border-gray-200 dark:border-zinc-700",
            "hover:bg-gray-50 dark:hover:bg-zinc-800"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-zinc-500" />
            )}
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{team.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {team.leader && (
              <span className="text-xs text-gray-500 dark:text-zinc-400 hidden sm:block">{team.leader}</span>
            )}
            <Badge variant="secondary" className={cn("text-xs tabular-nums", colors.badge)}>
              {totalMembers}
            </Badge>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-6 space-y-1">
          {team.leader && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50">
              <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">{team.leader}</span>
              {team.leaderCargo && (
                <span className="text-xs text-gray-500 dark:text-zinc-400">- {team.leaderCargo}</span>
              )}
            </div>
          )}
          {team.members.map((member, i) => (
            <div
              key={`${member.nome}-${i}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <User className="h-3 w-3 text-gray-400 dark:text-zinc-500 shrink-0" />
              <span className="text-sm text-gray-700 dark:text-zinc-300">{member.nome}</span>
              <span className="text-xs text-gray-400 dark:text-zinc-500 ml-auto hidden sm:block">{member.cargo}</span>
            </div>
          ))}
          {team.members.length === 0 && !team.leader && (
            <div className="text-xs text-gray-400 dark:text-zinc-500 px-3 py-1.5">Sem membros</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DepartmentCard({ department }: { department: Department }) {
  const [isOpen, setIsOpen] = useState(true);
  const colors = DEPT_COLORS[department.color] || DEPT_COLORS.gray;
  const totalMembers = department.teams.reduce(
    (sum, t) => sum + t.members.length + (t.leader ? 1 : 0),
    0
  );

  return (
    <Card className={cn("border", colors.border, "overflow-hidden")}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className={cn("cursor-pointer select-none transition-colors hover:opacity-90 py-4", colors.bg)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-1 h-8 rounded-full", colors.accent)} />
                <div>
                  <CardTitle className={cn("text-base", colors.text)}>{department.name}</CardTitle>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    {department.teams.length} {department.teams.length === 1 ? "equipe" : "equipes"} &middot; {totalMembers} {totalMembers === 1 ? "pessoa" : "pessoas"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={cn("text-xs font-semibold", colors.badge)}>
                  {totalMembers}
                </Badge>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-3 pb-4 space-y-2">
            {department.teams.map((team) => (
              <TeamSection key={team.name} team={team} colors={colors} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function Organograma() {
  usePageTitle("Organograma");
  useSetPageInfo("Organograma", "Estrutura organizacional da Turbo Partners");

  const { data, isLoading, error } = useQuery<OrgData>({
    queryKey: ["/api/geg/organograma"],
  });

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
    <div className="space-y-8 pb-10">
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

      {/* CEO */}
      <CeoCard ceo={data.ceo} />

      {/* Departments — horizontal connector */}
      <div className="flex justify-center">
        <div className="w-0.5 h-4 bg-gray-300 dark:bg-zinc-600" />
      </div>

      {/* Department grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.departments.map((dept) => (
          <DepartmentCard key={dept.name} department={dept} />
        ))}
      </div>
    </div>
  );
}
