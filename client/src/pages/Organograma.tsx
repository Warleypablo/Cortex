import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { Crown, X, Loader2, Search, Maximize2, Minimize2, LayoutGrid, AlertTriangle } from "lucide-react";

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

// ── View modes ────────────────────────────────────────────────────────

const VIEW_MODES = [
  { key: 'compacto', label: 'Compacto', icon: Minimize2 },
  { key: 'normal', label: 'Normal', icon: LayoutGrid },
  { key: 'expandido', label: 'Expandido', icon: Maximize2 },
] as const;

type ViewMode = 'compacto' | 'normal' | 'expandido';

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

function isTeamMatch(team: Team, deptName: string, searchQuery: string): boolean {
  if (!searchQuery) return true;
  return (
    team.name.toLowerCase().includes(searchQuery) ||
    team.leader?.toLowerCase().includes(searchQuery) ||
    team.members.some((m) => m.nome.toLowerCase().includes(searchQuery)) ||
    deptName.toLowerCase().includes(searchQuery)
  ) as boolean;
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
      className="w-0.5 bg-gray-400 dark:bg-zinc-500 shrink-0"
      style={{ height }}
    />
  );
}

function CeoCard({ ceo }: { ceo: OrgData["ceo"] }) {
  return (
    <div className="px-6 py-4 rounded-xl border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-center shadow-lg">
      <div className="w-12 h-12 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center mx-auto mb-2">
        <span className="text-lg font-bold text-amber-800 dark:text-amber-200">{getInitials(ceo.nome)}</span>
      </div>
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
        {dept.teams.length} {dept.teams.length === 1 ? 'equipe' : 'equipes'} &middot; {memberCount} {memberCount === 1 ? 'pessoa' : 'pessoas'}
      </div>
    </div>
  );
}

function TeamCardButton({
  team,
  color,
  isSelected,
  onClick,
  dimmed,
  highlighted,
}: {
  team: Team;
  color: string;
  isSelected: boolean;
  onClick: () => void;
  dimmed?: boolean;
  highlighted?: boolean;
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
        dimmed && "opacity-20",
        !team.leader && "border-dashed border-amber-300 dark:border-amber-700",
        highlighted && "ring-2 ring-primary shadow-md",
      )}
    >
      <div className="text-sm font-medium truncate text-gray-900 dark:text-white">
        {team.name}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {team.leader ? (
          <>
            <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
              <span className="text-[8px] font-bold text-amber-700 dark:text-amber-300">{getInitials(team.leader)}</span>
            </div>
            <span className="text-[10px] text-muted-foreground truncate" title={team.leader}>{(() => { const parts = team.leader!.split(' '); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]; })()}</span>
          </>
        ) : (
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-500 dark:text-amber-400 italic">Sem líder</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {totalMembers} {totalMembers === 1 ? 'membro' : 'membros'}
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
  viewMode,
  searchQuery,
}: {
  dept: Department;
  selectedTeamKey: string | null;
  onSelectTeam: (teamKey: string, dept: Department) => void;
  viewMode: ViewMode;
  searchQuery: string;
}) {
  const styles = DEPT_STYLES[dept.color] || DEPT_STYLES.gray;

  return (
    <div className="flex flex-col items-center">
      <VLine />
      <DeptCard dept={dept} />

      {viewMode !== 'compacto' && (
        <>
          <VLine height={16} />

          {/* Teams in horizontal row with connector line */}
          <div className="relative flex items-start gap-1 pt-4">
            {/* Horizontal connector line above all teams */}
            {dept.teams.length > 1 && (
              <div
                className="absolute top-0 h-0.5 bg-gray-400 dark:bg-zinc-500"
                style={{
                  left: `calc(${100 / dept.teams.length / 2}% + 4px)`,
                  right: `calc(${100 / dept.teams.length / 2}% + 4px)`,
                }}
              />
            )}
            {dept.teams.map((team) => {
              const key = `${dept.name}::${team.name}`;
              const matched = isTeamMatch(team, dept.name, searchQuery);
              return (
                <div key={key} className="flex flex-col items-center" style={{ minWidth: viewMode === 'expandido' ? 180 : 120 }}>
                  {/* Vertical line from horizontal connector down to team card */}
                  <div className="w-0.5 h-4 bg-gray-400 dark:bg-zinc-500 -mt-4" />
                  <TeamCardButton
                    team={team}
                    color={dept.color}
                    isSelected={selectedTeamKey === key}
                    onClick={() => onSelectTeam(key, dept)}
                    dimmed={!!searchQuery && !matched}
                    highlighted={!!searchQuery && matched}
                  />
                  {/* Expanded: show members grouped by cargo */}
                  {viewMode === 'expandido' && (
                    <div className={cn("mt-1 border-l-2 pl-2 pb-1 self-stretch max-h-[60vh] overflow-y-auto", styles.teamBorder)} style={{ scrollbarWidth: 'thin' }}>
                      {team.leader && (
                        <div className="flex items-center gap-1.5 py-0.5" title={team.leader}>
                          <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="text-[10px] font-medium truncate">{(() => { const parts = team.leader!.split(' '); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]; })()}</span>
                        </div>
                      )}
                      {(() => {
                        const grouped: Record<string, Member[]> = {};
                        for (const m of team.members) {
                          const c = m.cargo || 'Outros';
                          if (!grouped[c]) grouped[c] = [];
                          grouped[c].push(m);
                        }
                        return Object.entries(grouped).map(([cargo, members]) => (
                          <div key={cargo} className="mt-1">
                            <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{cargo}</div>
                            {members.map((m) => (
                              <div key={m.nome} className="flex items-center gap-1.5 py-0.5 pl-1" title={m.nome}>
                                <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <span className="text-[7px] font-medium">{getInitials(m.nome)}</span>
                                </div>
                                <span className="text-[10px] truncate">{(() => { const parts = m.nome.split(' '); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]; })()}</span>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
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
              {totalMembers} {totalMembers === 1 ? 'membro' : 'membros'}
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
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-sm shrink-0">
                {getInitials(team.leader)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {team.leader}
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  {team.leaderCargo || "Líder"}
                </div>
              </div>
              <Crown className="h-4 w-4 text-amber-500 shrink-0 ml-auto" />
            </div>
          )}

          {!team.leader && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed border-gray-300 dark:border-zinc-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs text-muted-foreground">?</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground italic">Sem líder definido</div>
              </div>
            </div>
          )}

          {/* Members grouped by cargo */}
          <div className="space-y-3">
            {(() => {
              const grouped: Record<string, Member[]> = {};
              for (const m of team.members) {
                const c = m.cargo || 'Outros';
                if (!grouped[c]) grouped[c] = [];
                grouped[c].push(m);
              }
              return Object.entries(grouped).map(([cargo, members]) => (
                <div key={cargo}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                    {cargo} ({members.length})
                  </div>
                  <div className="space-y-0.5">
                    {members.map((m, i) => (
                      <div
                        key={`${m.nome}-${i}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-zinc-300 shrink-0">
                          {getInitials(m.nome)}
                        </div>
                        <div className="text-sm text-gray-900 dark:text-white truncate" title={m.nome}>
                          {(() => { const parts = m.nome.split(' '); return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]; })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
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
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('orgchart-view') as ViewMode) || 'normal';
  });

  useEffect(() => {
    localStorage.setItem('orgchart-view', viewMode);
  }, [viewMode]);

  // ── Data query (must be before any useEffect that references `data`) ──
  const { data, isLoading, error } = useQuery<OrgData>({
    queryKey: ["/api/geg/organograma"],
  });

  // ── Zoom & drag state ─────────────────────────────────────────────
  const [scale, setScale] = useState(0.75);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasAutocentered, setHasAutocentered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setScale((s) => Math.min(1.5, Math.max(0.3, s + delta)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Auto-center on first load
  useEffect(() => {
    if (data && containerRef.current && !hasAutocentered) {
      const containerWidth = containerRef.current.clientWidth;
      setPosition({ x: containerWidth * 0.05, y: 20 });
      setScale(0.75);
      setHasAutocentered(true);
    }
  }, [data, hasAutocentered]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const fitToScreen = () => {
    const containerWidth = containerRef.current?.clientWidth ?? 0;
    setScale(0.75);
    setPosition({ x: containerWidth * 0.05, y: 20 });
  };

  const searchQuery = search.toLowerCase().trim();

  // All departments always shown (search just dims non-matching teams)
  const displayDepts = data?.departments ?? [];

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
    <div className="p-6 flex flex-col h-[calc(100vh-64px)]">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
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

          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden">
            {VIEW_MODES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === key
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground",
                )}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{data.departments.length} departamentos</span>
            <span>&middot;</span>
            <span>{totalTeams} equipes</span>
            <span>&middot;</span>
            <span>{data.totalColaboradores} colaboradores</span>
          </div>
        </div>
      </div>

      {/* Canvas with zoom/drag */}
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 overflow-hidden rounded-xl border bg-muted/10 dark:bg-zinc-950/50",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-canvas
      >
        {/* Subtle dot pattern background */}
        <div
          className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div
          className="origin-top-left p-8 inline-flex flex-col items-center min-w-full"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 75ms ease-out',
          }}
        >
          {/* Level 1: CEO */}
          <CeoCard ceo={data.ceo} />
          <VLine />

          {/* Level 2+3: Departments + Teams */}
          {displayDepts.length > 0 ? (
            <div className="relative flex justify-center gap-4 lg:gap-6 pt-6 min-w-fit">
              {/* Horizontal connector line */}
              <div
                className="absolute top-0 h-0.5 bg-gray-400 dark:bg-zinc-500"
                style={{ left: "15%", right: "15%" }}
              />
              {displayDepts.map((dept) => (
                <div key={dept.name} className="flex flex-col items-center">
                  {/* COO card above Commerce only */}
                  {dept.name === "Commerce" && (
                    <>
                      <VLine />
                      <div className="px-4 py-2 rounded-lg border-2 border-sky-400 dark:border-sky-500 bg-sky-50 dark:bg-sky-950/30 text-center shadow-sm mb-0">
                        <div className="w-8 h-8 rounded-full bg-sky-200 dark:bg-sky-800 flex items-center justify-center mx-auto mb-1">
                          <span className="text-xs font-bold text-sky-800 dark:text-sky-200">RV</span>
                        </div>
                        <div className="text-[9px] text-sky-600 dark:text-sky-400 font-semibold uppercase tracking-wider">COO</div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Rafael Vilela</div>
                      </div>
                    </>
                  )}
                  <DepartmentColumn
                    dept={dept}
                    selectedTeamKey={selectedTeamKey}
                    onSelectTeam={handleSelectTeam}
                    viewMode={viewMode}
                    searchQuery={searchQuery}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-8">
              Nenhum departamento encontrado
            </div>
          )}
        </div>
      </div>

      {/* Zoom controls - fixed bottom right */}
      <div className="fixed bottom-6 left-6 flex flex-col gap-1 z-30">
        <button
          onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
          className="w-9 h-9 rounded-lg bg-card border border-gray-200 dark:border-zinc-700 shadow-md flex items-center justify-center hover:bg-muted text-sm font-bold text-gray-700 dark:text-zinc-300"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
          className="w-9 h-9 rounded-lg bg-card border border-gray-200 dark:border-zinc-700 shadow-md flex items-center justify-center hover:bg-muted text-sm font-bold text-gray-700 dark:text-zinc-300"
        >
          −
        </button>
        <button
          onClick={fitToScreen}
          className="w-9 h-9 rounded-lg bg-card border border-gray-200 dark:border-zinc-700 shadow-md flex items-center justify-center hover:bg-muted text-gray-700 dark:text-zinc-300"
          title="Centralizar"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="text-center text-[10px] text-muted-foreground mt-1">
          {Math.round(scale * 100)}%
        </div>
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
