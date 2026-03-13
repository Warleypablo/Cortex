import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckCircle, XCircle } from "lucide-react";
import type { StatusTab } from "./types";

interface AutoReportFiltersProps {
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  tabCounts: Record<StatusTab, number>;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filtroGestor: string;
  onGestorChange: (gestor: string) => void;
  filtroSquad: string;
  onSquadChange: (squad: string) => void;
  gestores: string[];
  squads: string[];
}

const TAB_CONFIG: { key: StatusTab; label: string; icon?: 'check' | 'error'; hideWhenZero?: boolean }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'gerados', label: 'Gerados', icon: 'check' },
  { key: 'com_erro', label: 'Com Erro', icon: 'error', hideWhenZero: true },
];

export default function AutoReportFilters({
  activeTab,
  onTabChange,
  tabCounts,
  searchTerm,
  onSearchChange,
  filtroGestor,
  onGestorChange,
  filtroSquad,
  onSquadChange,
  gestores,
  squads,
}: AutoReportFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        {/* Status tabs row */}
        <div className="flex items-center gap-2 flex-wrap">
          {TAB_CONFIG.map((tab) => {
            if (tab.hideWhenZero && tabCounts[tab.key] === 0) return null;

            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 hover:bg-muted text-foreground'
                }`}
              >
                {tab.icon === 'check' && <CheckCircle className="w-3.5 h-3.5" />}
                {tab.icon === 'error' && <XCircle className="w-3.5 h-3.5" />}
                {tab.label}
                <span className="opacity-80">({tabCounts[tab.key]})</span>
              </button>
            );
          })}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-3 flex-wrap mt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>

          <Select value={filtroGestor} onValueChange={onGestorChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os Gestores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os Gestores</SelectItem>
              {gestores.map((gestor) => (
                <SelectItem key={gestor} value={gestor}>
                  {gestor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroSquad} onValueChange={onSquadChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos os Squads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os Squads</SelectItem>
              {squads.map((squad) => (
                <SelectItem key={squad} value={squad}>
                  {squad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
