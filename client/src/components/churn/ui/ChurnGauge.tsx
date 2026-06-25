// Componente de Gauge visual para taxa de churn
export const ChurnGauge = ({
  value,
  maxValue = 10,
  statusOverride,
}: {
  value: number;
  maxValue?: number;
  statusOverride?: { label: string; color: string; bg: string; dotBg: string };
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const getColor = () => {
    if (value <= 2) return { color: "text-emerald-500", bg: "from-emerald-500 to-green-500", status: "Excelente", dotBg: "bg-emerald-500" };
    if (value <= 4) return { color: "text-yellow-500", bg: "from-yellow-500 to-amber-500", status: "Atenção", dotBg: "bg-yellow-500" };
    if (value <= 6) return { color: "text-orange-500", bg: "from-orange-500 to-red-500", status: "Crítico", dotBg: "bg-orange-500" };
    return { color: "text-red-600", bg: "from-red-600 to-rose-700", status: "Emergência", dotBg: "bg-red-600" };
  };
  const config = statusOverride
    ? { ...statusOverride, status: statusOverride.label }
    : getColor();

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0 bg-gray-200 dark:bg-zinc-800 rounded-t-full" />
        {/* Colored arc */}
        <div
          className={`absolute inset-0 bg-gradient-to-r ${config.bg} rounded-t-full origin-bottom transition-transform duration-1000`}
          style={{
            clipPath: `polygon(0 100%, 0 ${100 - percentage}%, 100% ${100 - percentage}%, 100% 100%)`,
          }}
        />
        {/* Center circle */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-12 bg-white dark:bg-zinc-900 rounded-t-full flex items-end justify-center pb-1">
          <span className={`text-2xl font-bold ${config.color}`}>{value.toFixed(1)}%</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className={`w-3 h-3 rounded-full ${config.dotBg} animate-pulse`} />
        <span className={`text-sm font-semibold ${config.color}`}>{config.status}</span>
      </div>
    </div>
  );
};
