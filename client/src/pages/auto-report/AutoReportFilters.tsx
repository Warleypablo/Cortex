import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import type { StatusTab } from './types';

interface AutoReportFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filtroGestor: string;
  onGestorChange: (gestor: string) => void;
  filtroSquad: string;
  onSquadChange: (squad: string) => void;
  gestores: string[];
  squads: string[];
  activeTab: StatusTab;
  onClearStatusFilter: () => void;
}

const STATUS_LABELS: Record<Exclude<StatusTab, 'todos'>, string> = {
  pendentes: 'Pendentes',
  gerados: 'Gerados',
  com_erro: 'Com Erro',
};

export default function AutoReportFilters({
  searchTerm,
  onSearchChange,
  filtroGestor,
  onGestorChange,
  filtroSquad,
  onSquadChange,
  gestores,
  squads,
  activeTab,
  onClearStatusFilter,
}: AutoReportFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {activeTab !== 'todos' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrando:</span>
            <div
              role="group"
              aria-label={`Filtro ativo: ${STATUS_LABELS[activeTab as Exclude<StatusTab, 'todos'>]}`}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-xs font-medium text-primary"
              data-testid="active-filter-chip"
            >
              <span>{STATUS_LABELS[activeTab as Exclude<StatusTab, 'todos'>]}</span>
              <button
                type="button"
                onClick={onClearStatusFilter}
                className="hover:bg-primary/10 rounded-full p-0.5 transition-colors"
                aria-label="Limpar filtro de status"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do cliente..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 w-[280px]"
              data-testid="input-search"
            />
          </div>

          <Select value={filtroGestor} onValueChange={onGestorChange}>
            <SelectTrigger className="w-[180px]" data-testid="select-gestor">
              <SelectValue placeholder="Todos os gestores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os gestores</SelectItem>
              {gestores.map((gestor) => (
                <SelectItem key={gestor} value={gestor}>
                  {gestor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroSquad} onValueChange={onSquadChange}>
            <SelectTrigger className="w-[180px]" data-testid="select-squad">
              <SelectValue placeholder="Todos os squads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os squads</SelectItem>
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
