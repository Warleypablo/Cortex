import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Sub-components
import AutoReportToolbar from "./auto-report/AutoReportToolbar";
import AutoReportFilters from "./auto-report/AutoReportFilters";
import AutoReportTable from "./auto-report/AutoReportTable";
import AutoReportActionBar from "./auto-report/AutoReportActionBar";
import AutoReportJobsDrawer from "./auto-report/AutoReportJobsDrawer";

// Types and utils
import type {
  AutoReportCliente,
  AutoReportJob,
  PageSelection,
  OutputFormat,
  StatusTab,
  SortState,
  SortColumn,
} from "./auto-report/types";
import { DEFAULT_PAGE_SELECTION } from "./auto-report/types";
import {
  getDefaultDateRange,
  classifyClientStatus,
  parseUltimaGeracao,
} from "./auto-report/utils";

import type { DateRange } from "react-day-picker";

export default function AutoReport() {
  const { toast } = useToast();

  // --- Toolbar state ---
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    getDefaultDateRange()
  );
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("slides");
  const [pageSelection, setPageSelection] =
    useState<PageSelection>(DEFAULT_PAGE_SELECTION);

  // --- Filter state ---
  const [activeTab, setActiveTab] = useState<StatusTab>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroGestor, setFiltroGestor] = useState("todos");
  const [filtroSquad, setFiltroSquad] = useState("todos");

  // --- Selection state ---
  const [selectedClientes, setSelectedClientes] = useState<Set<number>>(
    new Set()
  );

  // --- Table sort ---
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: "asc",
  });

  // --- Jobs drawer ---
  const [jobsDrawerOpen, setJobsDrawerOpen] = useState(false);

  // --- Batch tracking ---
  const [batchClientNames, setBatchClientNames] = useState<string[]>([]);
  const [batchDone, setBatchDone] = useState(false);

  // ========== React Query ==========

  const {
    data: clientes = [],
    isLoading,
    isError,
    refetch: refetchClientes,
  } = useQuery<AutoReportCliente[]>({
    queryKey: ["/api/autoreport/clientes"],
  });

  const { data: jobs = [], refetch: refetchJobs } = useQuery<AutoReportJob[]>({
    queryKey: ["/api/autoreport/jobs"],
    refetchInterval: 5000,
  });

  // ========== Mutations ==========

  const gerarRelatorioMutation = useMutation({
    mutationFn: async (cliente: AutoReportCliente): Promise<AutoReportJob> => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Selecione um periodo valido");
      }
      const response = await fetch("/api/autoreport/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cliente,
          dataInicio: dateRange.from.toISOString(),
          dataFim: dateRange.to.toISOString(),
          pageSelection,
          outputFormat,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar relatorio");
      }
      return response.json();
    },
    onSuccess: (data: AutoReportJob) => {
      let description = `Processando relatorio de ${data.clienteNome}...`;
      if (data.status === "concluido" && data.downloadUrl) {
        const isPptx = data.fileName?.endsWith(".pptx");
        description = isPptx
          ? `PPTX de ${data.clienteNome} pronto para download.`
          : `PDF de ${data.clienteNome} pronto para download.`;
      }
      toast({
        title:
          data.status === "concluido"
            ? "Relatorio gerado!"
            : "Relatorio em processamento",
        description,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/autoreport/jobs"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/autoreport/clientes"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao gerar relatorio",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const gerarLoteMutation = useMutation({
    mutationFn: async (
      clientesList: AutoReportCliente[]
    ): Promise<AutoReportJob[]> => {
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error("Selecione um periodo valido");
      }
      const response = await fetch("/api/autoreport/gerar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clientes: clientesList,
          dataInicio: dateRange.from.toISOString(),
          dataFim: dateRange.to.toISOString(),
          pageSelection,
          outputFormat,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar relatorios");
      }
      return response.json();
    },
    onSuccess: (data: AutoReportJob[]) => {
      const concluidos = data.filter((j) => j.status === "concluido").length;
      const erros = data.filter((j) => j.status === "erro").length;
      setBatchDone(true);
      setJobsDrawerOpen(true);
      setSelectedClientes(new Set());
      toast({
        title: "Geracao em lote concluida",
        description: `${concluidos} relatorios gerados, ${erros} erros.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/autoreport/jobs"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/autoreport/clientes"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na geracao em lote",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  // ========== Computed values ==========

  const gestores = useMemo(
    () =>
      Array.from(new Set(clientes.map((c) => c.gestor).filter(Boolean))).sort(),
    [clientes]
  );

  const squads = useMemo(
    () =>
      Array.from(new Set(clientes.map((c) => c.squad).filter(Boolean))).sort(),
    [clientes]
  );

  const clientesValidos = useMemo(
    () => clientes.filter((c) => c.categoria),
    [clientes]
  );

  // Apply search + gestor + squad filters
  const clientesFiltrados = useMemo(() => {
    return clientesValidos.filter((c) => {
      if (filtroGestor !== "todos" && c.gestor !== filtroGestor) return false;
      if (filtroSquad !== "todos" && c.squad !== filtroSquad) return false;
      if (
        searchTerm &&
        !c.cliente.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      return true;
    });
  }, [clientesValidos, filtroGestor, filtroSquad, searchTerm]);

  // Tab counts (from filtered clients, not tab-filtered)
  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      todos: 0,
      pendentes: 0,
      gerados: 0,
      com_erro: 0,
    };
    counts.todos = clientesFiltrados.length;
    clientesFiltrados.forEach((c) => {
      const status = classifyClientStatus(c, dateRange?.from);
      if (status !== "todos") counts[status]++;
    });
    return counts;
  }, [clientesFiltrados, dateRange]);

  // Apply tab filter
  const clientesByTab = useMemo(() => {
    if (activeTab === "todos") return clientesFiltrados;
    return clientesFiltrados.filter(
      (c) => classifyClientStatus(c, dateRange?.from) === activeTab
    );
  }, [clientesFiltrados, activeTab, dateRange]);

  // Apply sort
  const clientesSorted = useMemo(() => {
    const arr = [...clientesByTab];
    if (!sortState.column) {
      // Default sort: never generated first, then oldest
      return arr.sort((a, b) => {
        const dateA = parseUltimaGeracao(a.ultimaGeracao);
        const dateB = parseUltimaGeracao(b.ultimaGeracao);
        if (!dateA && !dateB) return 0;
        if (!dateA) return -1;
        if (!dateB) return 1;
        return dateA.getTime() - dateB.getTime();
      });
    }
    const dir = sortState.direction === "asc" ? 1 : -1;
    return arr.sort((a, b) => {
      switch (sortState.column) {
        case "nome":
          return a.cliente.localeCompare(b.cliente) * dir;
        case "gestor":
          return (a.gestor || "").localeCompare(b.gestor || "") * dir;
        case "squad":
          return (a.squad || "").localeCompare(b.squad || "") * dir;
        case "ultimaGeracao": {
          const dA = parseUltimaGeracao(a.ultimaGeracao);
          const dB = parseUltimaGeracao(b.ultimaGeracao);
          if (!dA && !dB) return 0;
          if (!dA) return -1 * dir;
          if (!dB) return 1 * dir;
          return (dA.getTime() - dB.getTime()) * dir;
        }
        default:
          return 0;
      }
    });
  }, [clientesByTab, sortState]);

  // Batch progress from polling jobs
  const batchProgress = useMemo(() => {
    if (batchClientNames.length === 0) return { completed: 0, errors: 0 };
    let completed = 0;
    let errors = 0;
    batchClientNames.forEach((name) => {
      const job = jobs.find((j) => j.clienteNome === name);
      if (job?.status === "concluido") completed++;
      if (job?.status === "erro") errors++;
    });
    return { completed, errors };
  }, [jobs, batchClientNames]);

  // ========== Handlers ==========

  const togglePage = (key: keyof PageSelection) => {
    setPageSelection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCliente = (rowIndex: number) => {
    setSelectedClientes((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const handleSelectAll = (rowIndexes: number[]) => {
    setSelectedClientes((prev) => {
      const allSelected = rowIndexes.every((r) => prev.has(r));
      if (allSelected) return new Set(); // deselect all
      return new Set(rowIndexes);
    });
  };

  const handleSort = (column: SortColumn) => {
    setSortState((prev) => {
      if (prev.column === column) {
        if (prev.direction === "asc")
          return { column, direction: "desc" as const };
        return { column: null, direction: "asc" as const }; // reset
      }
      return { column, direction: "asc" as const };
    });
  };

  const handleSelectPendentes = () => {
    const pendentes = clientesFiltrados
      .filter((c) => classifyClientStatus(c, dateRange?.from) === "pendentes")
      .map((c) => c.rowIndex);
    setSelectedClientes(new Set(pendentes));
  };

  const handleGerarLote = () => {
    const selected = clientes.filter((c) => selectedClientes.has(c.rowIndex));
    if (selected.length === 0) return;
    setBatchClientNames(selected.map((c) => c.cliente));
    setBatchDone(false);
    gerarLoteMutation.mutate(selected);
  };

  const handleRetryJob = (clienteNome: string) => {
    const cliente = clientes.find((c) => c.cliente === clienteNome);
    if (cliente) gerarRelatorioMutation.mutate(cliente);
  };

  const handleDismissBatch = () => {
    setBatchDone(false);
    setBatchClientNames([]);
  };

  // ========== Render ==========

  return (
    <div className="p-6 space-y-4 pb-24" data-testid="autoreport-page">
      <AutoReportToolbar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        outputFormat={outputFormat}
        onOutputFormatChange={setOutputFormat}
        pageSelection={pageSelection}
        onTogglePage={togglePage}
        onRefresh={() => {
          refetchClientes();
          refetchJobs();
        }}
        onOpenJobs={() => setJobsDrawerOpen(true)}
        isRefreshing={isLoading}
      />

      <AutoReportFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tabCounts={tabCounts}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filtroGestor={filtroGestor}
        onGestorChange={setFiltroGestor}
        filtroSquad={filtroSquad}
        onSquadChange={setFiltroSquad}
        gestores={gestores}
        squads={squads}
      />

      <AutoReportTable
        clientes={clientesSorted}
        selectedClientes={selectedClientes}
        onToggleCliente={toggleCliente}
        onSelectAll={handleSelectAll}
        sortState={sortState}
        onSort={handleSort}
        onGerarIndividual={(c) => gerarRelatorioMutation.mutate(c)}
        isGenerating={gerarRelatorioMutation.isPending}
        isLoading={isLoading}
        isError={isError}
        onRetryLoad={() => refetchClientes()}
        totalClientes={clientesValidos.length}
      />

      <AutoReportActionBar
        selectedCount={selectedClientes.size}
        onSelectPendentes={handleSelectPendentes}
        onClearSelection={() => setSelectedClientes(new Set())}
        onGerar={handleGerarLote}
        isGenerating={gerarLoteMutation.isPending}
        batchTotal={batchClientNames.length}
        batchCompleted={batchProgress.completed}
        batchErrors={batchProgress.errors}
        batchDone={batchDone}
        onVerDetalhes={() => setJobsDrawerOpen(true)}
        onDismiss={handleDismissBatch}
        outputFormat={outputFormat}
      />

      <AutoReportJobsDrawer
        open={jobsDrawerOpen}
        onOpenChange={setJobsDrawerOpen}
        jobs={jobs}
        onRetryJob={handleRetryJob}
      />
    </div>
  );
}
