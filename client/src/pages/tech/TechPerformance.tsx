import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";

export default function TechPerformance() {
  const [viewMode, setViewMode] = useState<'geral' | 'por-po'>('geral');
  const [periodo, setPeriodo] = useState<number>(12);

  // Fetch tempo deploy
  const { data: deployData = [], isLoading: loadingDeploy } = useQuery({
    queryKey: ['/api/tech/tempo-deploy', periodo],
    queryFn: async () => {
      const res = await fetch(`/api/tech/tempo-deploy?meses=${periodo}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Fetch entregas trimestre
  const { data: entregasData = [], isLoading: loadingEntregas } = useQuery({
    queryKey: ['/api/tech/entregas-trimestre', periodo],
    queryFn: async () => {
      const res = await fetch(`/api/tech/entregas-trimestre?meses=${periodo}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Fetch prazo por status
  const { data: prazoPorStatus = [], isLoading: loadingPrazo } = useQuery({
    queryKey: ['/api/tech/prazo-por-status'],
    queryFn: async () => {
      const res = await fetch('/api/tech/prazo-por-status');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  // Fetch deploy by PO (parallel requests instead of sequential N+1)
  const { data: deployByPO = [] } = useQuery({
    queryKey: ['/api/tech/tempo-deploy', periodo, 'all-pos'],
    queryFn: async () => {
      const res = await fetch('/api/tech/board');
      if (!res.ok) return [];
      const columns = await res.json();
      const poResults = await Promise.all(
        columns.map(async (col: any) => {
          const poRes = await fetch(`/api/tech/tempo-deploy?meses=${periodo}&responsavel=${encodeURIComponent(col.responsavel)}`);
          if (!poRes.ok) return null;
          const poData = await poRes.json();
          if (poData.length === 0) return null;
          const avgDays = poData.reduce((sum: number, d: any) => sum + (parseFloat(d.media_dias) || 0), 0) / poData.length;
          return { responsavel: col.responsavel, media_dias: Math.round(avgDays * 10) / 10 };
        })
      );
      return poResults.filter(Boolean).sort((a: any, b: any) => b.media_dias - a.media_dias);
    },
    enabled: viewMode === 'por-po',
  });

  // Compute KPIs
  const kpis = useMemo(() => {
    const avgDeploy = deployData.length > 0
      ? deployData.reduce((sum: number, d: any) => sum + (parseFloat(d.media_dias) || 0), 0) / deployData.length
      : 0;

    const currentQuarter = entregasData.length > 0 ? entregasData[entregasData.length - 1] : null;
    const entregasTrimestre = currentQuarter ? parseInt(currentQuarter.total_entregas) || 0 : 0;

    // Gargalo = phase with highest average days
    const gargalo = prazoPorStatus.length > 0
      ? prazoPorStatus.reduce((max: any, curr: any) =>
          (parseFloat(curr.media_dias) || 0) > (parseFloat(max.media_dias) || 0) ? curr : max,
          prazoPorStatus[0]
        )
      : null;

    return {
      tempoMedioDeploy: Math.round(avgDeploy * 10) / 10,
      entregasTrimestre,
      gargalo: gargalo?.status || '—',
      gargaloDias: gargalo ? Math.round(parseFloat(gargalo.media_dias) * 10) / 10 : 0,
    };
  }, [deployData, entregasData, prazoPorStatus]);

  // Phase cards data
  const phaseCards = useMemo(() => {
    const phases = ['design', 'dev', 'review', 'qa', 'deploy'];
    const totalDays = prazoPorStatus.reduce((sum: number, s: any) => sum + (parseFloat(s.media_dias) || 0), 0);

    return phases.map(phase => {
      const found = prazoPorStatus.find((s: any) => (s.status || '').toLowerCase().includes(phase));
      const dias = found ? Math.round(parseFloat(found.media_dias) * 10) / 10 : 0;
      const pct = totalDays > 0 ? Math.round((dias / totalDays) * 100) : 0;
      const isGargalo = found && prazoPorStatus.length > 0 &&
        parseFloat(found.media_dias) === Math.max(...prazoPorStatus.map((s: any) => parseFloat(s.media_dias) || 0));

      return { phase, dias, pct, isGargalo };
    });
  }, [prazoPorStatus]);

  const PHASE_COLORS: Record<string, string> = {
    design: '#a78bfa',
    dev: '#6366f1',
    review: '#818cf8',
    qa: '#c4b5fd',
    deploy: '#ddd6fe',
  };

  const isLoading = loadingDeploy || loadingEntregas || loadingPrazo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toggle + Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-gray-300 dark:border-zinc-600 overflow-hidden">
          <button
            onClick={() => setViewMode('geral')}
            className={`px-3 py-1.5 text-sm font-medium ${
              viewMode === 'geral' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setViewMode('por-po')}
            className={`px-3 py-1.5 text-sm font-medium ${
              viewMode === 'por-po' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
            }`}
          >
            Por PO
          </button>
        </div>

        <div className="flex rounded-lg border border-gray-300 dark:border-zinc-600 overflow-hidden">
          {[6, 12, 24].map(m => (
            <button
              key={m}
              onClick={() => setPeriodo(m)}
              className={`px-3 py-1.5 text-sm font-medium ${
                periodo === m ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
          <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Tempo Medio Deploy</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{kpis.tempoMedioDeploy}d</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
          <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Entregas no Trimestre</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{kpis.entregasTrimestre}</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
          <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Gargalo Principal</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 capitalize">{kpis.gargalo}</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500">{kpis.gargaloDias}d media</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-gray-200 dark:border-zinc-700">
          <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Fases Monitoradas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{phaseCards.length}</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tempo Deploy por Trimestre */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-gray-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-4">Tempo Deploy por Trimestre</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={deployData.map((d: any) => ({ ...d, media_dias: parseFloat(d.media_dias) || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${Math.round(value * 10) / 10} dias`, 'Tempo Medio']}
              />
              <Bar dataKey="media_dias" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Entregas por Trimestre */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-gray-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-4">Entregas por Trimestre</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={entregasData.map((d: any) => ({ ...d, total_entregas: parseInt(d.total_entregas) || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value} projetos`, 'Entregas']}
              />
              <Bar dataKey="total_entregas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deploy by PO (only in por-po mode) */}
      {viewMode === 'por-po' && deployByPO.length > 0 && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-5 border border-gray-200 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-4">Tempo Deploy por PO</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, deployByPO.length * 40)}>
            <BarChart data={deployByPO} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis type="category" dataKey="responsavel" tick={{ fontSize: 11 }} stroke="#9ca3af" width={120} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                formatter={(value: number) => [`${value} dias`, 'Tempo Medio']}
              />
              <Bar dataKey="media_dias" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Phase cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {phaseCards.map(card => (
          <div
            key={card.phase}
            className={`bg-white dark:bg-zinc-800 rounded-xl p-4 border ${
              card.isGargalo
                ? 'border-amber-400 dark:border-amber-500'
                : 'border-gray-200 dark:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PHASE_COLORS[card.phase] || '#d4d4d8' }} />
              <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase font-medium capitalize">{card.phase}</p>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{card.dias}d</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">{card.pct}% do ciclo</p>
            {card.isGargalo && (
              <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded mt-1 inline-block font-medium">
                Gargalo
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
