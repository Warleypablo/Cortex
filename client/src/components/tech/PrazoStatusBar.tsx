// --- Types ---

interface PrazoStatusBarProps {
  statusHistory: Array<{
    status_novo: string;
    duracao_ms: number;
  }>;
}

// --- Color map ---

const STATUS_COLORS: Record<string, string> = {
  kickoff: "#93c5fd",
  design: "#a78bfa",
  dev: "#6366f1",
  desenvolvimento: "#6366f1",
  review: "#818cf8",
  qa: "#c4b5fd",
  deploy: "#ddd6fe",
  done: "#86efac",
};

const DEFAULT_COLOR = "#d4d4d8";

// --- Component ---

export default function PrazoStatusBar({ statusHistory }: PrazoStatusBarProps) {
  const totalMs = statusHistory.reduce((sum, s) => sum + s.duracao_ms, 0);

  if (totalMs === 0) {
    return (
      <p className="text-xs text-gray-400 dark:text-zinc-500">
        Sem dados de histórico
      </p>
    );
  }

  const segments = statusHistory
    .filter((s) => s.duracao_ms > 0)
    .map((s) => ({
      status: s.status_novo,
      days: Math.round((s.duracao_ms / 86400000) * 10) / 10,
      pct: (s.duracao_ms / totalMs) * 100,
    }));

  return (
    <div className="flex h-8 rounded-lg overflow-hidden" title="Prazo por Status">
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            width: `${seg.pct}%`,
            backgroundColor:
              STATUS_COLORS[seg.status.toLowerCase().trim()] || DEFAULT_COLOR,
          }}
          className="flex items-center justify-center text-[10px] font-medium text-white truncate px-1"
          title={`${seg.status}: ${seg.days}d`}
        >
          {seg.pct > 10 ? `${seg.days}d` : ""}
        </div>
      ))}
    </div>
  );
}
