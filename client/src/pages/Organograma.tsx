import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Crown, X, Loader2, Search, Expand, Shrink } from "lucide-react";

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

// ── Helpers ───────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isInactive(teamName: string) {
  return /\(OFF\)/i.test(teamName);
}

function getDeptMemberCount(dept: Department) {
  return dept.teams.reduce(
    (sum, t) => sum + t.members.length + (t.leader ? 1 : 0),
    0,
  );
}

// ── Color mapping ─────────────────────────────────────────────────────

const DEPT_STYLES: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    teamBorder: string;
  }
> = {
  purple: {
    border: "border-purple-400 dark:border-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-700 dark:text-purple-300",
    teamBorder: "border-purple-200 dark:border-purple-800",
  },
  blue: {
    border: "border-blue-400 dark:border-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    teamBorder: "border-blue-200 dark:border-blue-800",
  },
  emerald: {
    border: "border-emerald-400 dark:border-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    teamBorder: "border-emerald-200 dark:border-emerald-800",
  },
  orange: {
    border: "border-orange-400 dark:border-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    teamBorder: "border-orange-200 dark:border-orange-800",
  },
  gray: {
    border: "border-gray-400 dark:border-zinc-500",
    bg: "bg-gray-50 dark:bg-zinc-900/50",
    text: "text-gray-700 dark:text-zinc-300",
    teamBorder: "border-gray-200 dark:border-zinc-700",
  },
};

// ── Small components ──────────────────────────────────────────────────

function VLine({ height = 24 }: { height?: number }) {
  return (
    <div
      className="w-px bg-gray-300 dark:bg-zinc-600 shrink-0"
      style={{ height }}
    />
  );
}

function CeoCard({ ceo }: { ceo: OrgData["ceo"] }) {
  return (
    <div className="px-6 py-4 rounded-xl border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-center shadow-lg">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Crown className="h-4 w-4 text-amber-500" />
        <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
          {ceo.cargo}
        </span>
      </div>
      <div className="text-lg font-bold text-gray-900 dark:text-white">
        {ceo.nome}
      </div>
    </div>
  );
}

function DeptCard({ dept }: { dept: Department }) {
  const styles = DEPT_STYLES[dept.color] || DEPT_STYLES.gray;
  const memberCount = getDeptMemberCount(dept);

  return (
    <div
      className={cn(
        "px-5 py-3 rounded-lg border-2 text-center shadow-sm",
        styles.border,
        styles.bg,
      )}
    >
      <div
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          styles.text,
        )}
      >
        {dept.name}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {dept.teams.length} equipes &middot; {memberCount} pessoas
      </div>
    </div>
  );
}

function TeamCardButton({
  team,
  color,
  isSelected,
  onClick,
}: {
  team: Team;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const styles = DEPT_STYLES[color] || DEPT_STYLES.gray;
  const totalMembers = team.members.length + (team.leader ? 1 : 0);
  const inactive = isInactive(team.name);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-3 py-2.5 rounded-lg border text-left transition-all hover:shadow-md cursor-pointer",
        "bg-white dark:bg-zinc-900",
        styles.teamBorder,
        isSelected && "ring-2 ring-primary shadow-md",
        inactive && "opacity-50",
      )}
    >
      <div className="text-sm font-medium truncate text-gray-900 dark:text-white">
        {team.name}
      </div>
      {team.leader && (
        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
          {team.leader}
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {totalMembers} membros
        </Badge>
        {inactive && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 text-muted-foreground"
          >
            Inativo
          </Badge>
        )}
      </div>
    </button>
  );
}

// ── Department column ─────────────────────────────────────────────────

function DepartmentColumn({
  dept,
  selectedTeamKey,
  onSelectTeam,
  expanded,
}: {
  dept: Department;
  selectedTeamKey: string | null;
  onSelectTeam: (teamKey: string, dept: Department) => void;
  expanded: boolean;
}) {
  const styles = DEPT_STYLES[dept.color] || DEPT_STYLES.gray;
  const gridCols = expanded ? "grid-cols-1" : dept.teams.length > 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="flex flex-col items-center">
      <VLine />
      <DeptCard dept={dept} />
      <VLine height={16} />
      <div className={cn("grid gap-2", expanded ? "max-w-[320px]" : "max-w-[280px]", gridCols)}>
        {dept.teams.map((team) => {
          const key = `${dept.name}::${team.name}`;
          return (
            <div key={key} className="flex flex-col">
              <TeamCardButton
                team={team}
                color={dept.color}
                isSelected={selectedTeamKey === key}
                onClick={() => onSelectTeam(key, dept)}
              />
              {/* Expanded: show members inline below each team */}
              {expanded && (
                <div className={cn("mt-1 ml-2 border-l-2 pl-3 pb-2 space-y-0.5", styles.teamBorder)}>
                  {team.leader && (
                    <div className="flex items-center gap-2 py-1">
                      <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="text-xs font-medium truncate">{team.leader.split(' ').slice(0, 2).join(' ')}</span>
                    </div>
                  )}
                  {team.members.map((m) => (
                    <div key={m.nome} className="flex items-center gap-2 py-0.5">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-medium">{getInitials(m.nome)}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] truncate block">{m.nome.split(' ').slice(0, 2).join(' ')}</span>
                        <span className="text-[9px] text-muted-foreground truncate block">{m.cargo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Team detail drawer ────────────────────────────────────────────────

function TeamDrawer({
  team,
  deptName,
  deptColor,
  onClose,
}: {
  team: Team;
  deptName: string;
  deptColor: string;
  onClose: () => void;
}) {
  const styles = DEPT_STYLES[deptColor] || DEPT_STYLES.gray;
  const totalMembers = team.members.length + (team.leader ? 1 : 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {team.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              <span className={styles.text}>{deptName}</span> &middot;{" "}
              {totalMembers} membros
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {/* Leader */}
          {team.leader && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-xs shrink-0">
                {getInitials(team.leader)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {team.leader}
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                  {team.leaderCargo || "Líder"}
                </div>
              </div>
              <Crown className="h-4 w-4 text-amber-500 shrink-0 ml-auto" />
            </div>
          )}

          {/* Members */}
          <div className="space-y-1">
            {team.members.map((m, i) => (
              <div
                key={`${m.nome}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-zinc-300 shrink-0">
                  {getInitials(m.nome)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 dark:text-white truncate">
                    {m.nome.split(" ").slice(0, 2).join(" ")}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {m.cargo}
                  </div>
                </div>
              </div>
            ))}
            {team.members.length === 0 && !team.leader && (
              <div className="text-sm text-muted-foreground text-center py-4">
                Sem membros cadastrados
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────

export default function Organograma() {
  usePageTitle("Organograma");
  useSetPageInfo("Organograma", "Estrutura organizacional da Turbo Partners");

  const [selectedTeamKey, setSelectedTeamKey] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<OrgData>({
    queryKey: ["/api/geg/organograma"],
  });

  // Filtered departments based on search
  const filteredDepts = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.departments;

    const q = search.toLowerCase();
    return data.departments
      .map((d) => ({
        ...d,
        teams: d.teams.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.leader?.toLowerCase().includes(q) ||
            t.members.some((m) => m.nome.toLowerCase().includes(q)) ||
            d.name.toLowerCase().includes(q),
        ),
      }))
      .filter((d) => d.teams.length > 0);
  }, [data, search]);

  // Stats
  const totalTeams = useMemo(
    () => (data?.departments ?? []).reduce((s, d) => s + d.teams.length, 0),
    [data],
  );

  // Find selected team object
  const selectedTeam = useMemo(() => {
    if (!selectedTeamKey || !data) return null;
    const [deptName, teamName] = selectedTeamKey.split("::");
    for (const dept of data.departments) {
      if (dept.name === deptName) {
        const team = dept.teams.find((t) => t.name === teamName);
        if (team) return team;
      }
    }
    return null;
  }, [selectedTeamKey, data]);

  const handleSelectTeam = (teamKey: string, dept: Department) => {
    if (selectedTeamKey === teamKey) {
      setSelectedTeamKey(null);
      setSelectedDept(null);
    } else {
      setSelectedTeamKey(teamKey);
      setSelectedDept(dept);
    }
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
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div />
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar equipe ou pessoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-64"
            />
          </div>
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors",
              expanded
                ? "bg-primary text-primary-foreground border-primary"
                : "border-gray-200 dark:border-zinc-700 hover:bg-muted"
            )}
          >
            {expanded ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
            {expanded ? "Compacto" : "Expandido"}
          </button>
          {/* Stats */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <span>{data.departments.length} departamentos</span>
            <span>&middot;</span>
            <span>{totalTeams} equipes</span>
            <span>&middot;</span>
            <span>{data.totalColaboradores} colaboradores</span>
          </div>
        </div>
      </div>

      {/* Tree */}
      <div className="flex flex-col items-center min-h-[calc(100vh-200px)]">
        {/* Level 1: CEO */}
        <CeoCard ceo={data.ceo} />
        <VLine />

        {/* Level 1.5: COO */}
        <div className="px-5 py-3 rounded-xl border-2 border-sky-400 dark:border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-center shadow-md">
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold uppercase tracking-wider">COO</div>
          <div className="text-base font-bold text-gray-900 dark:text-white">Rafael Vilela</div>
        </div>
        <VLine />

        {/* Level 2+3: Departments + Teams */}
        {filteredDepts.length > 0 ? (
          <div className="relative flex flex-wrap justify-center gap-6 lg:gap-8 pt-6 w-full">
            {/* Horizontal connector line */}
            <div
              className="absolute top-0 h-px bg-gray-300 dark:bg-zinc-600"
              style={{ left: "15%", right: "15%" }}
            />
            {filteredDepts.map((dept) => (
              <DepartmentColumn
                key={dept.name}
                dept={dept}
                selectedTeamKey={selectedTeamKey}
                onSelectTeam={handleSelectTeam}
                expanded={expanded}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground mt-8">
            Nenhum resultado para &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedTeam && selectedDept && (
        <TeamDrawer
          team={selectedTeam}
          deptName={selectedDept.name}
          deptColor={selectedDept.color}
          onClose={() => {
            setSelectedTeamKey(null);
            setSelectedDept(null);
          }}
        />
      )}
    </div>
  );
}
