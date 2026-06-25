export const CustomTooltip = ({ active, payload, label, valueFormatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-gray-200 dark:border-zinc-700/50 rounded-lg shadow-xl p-3 min-w-[160px]">
      <p className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-gray-500 dark:text-zinc-400">{entry.name === "count" ? "Quantidade" : entry.name}</span>
          <span className="font-bold text-gray-900 dark:text-white">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};
