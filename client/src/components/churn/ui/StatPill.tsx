export const StatPill = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "warning" | "success" | "info";
}) => {
  const toneStyles = {
    default: "border-border/60 bg-muted/40 text-foreground",
    danger: "border-red-200/60 bg-red-50/70 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    warning: "border-amber-200/60 bg-amber-50/70 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    success: "border-emerald-200/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    info: "border-blue-200/60 bg-blue-50/70 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  };

  return (
    <div className={`rounded-md border px-2.5 py-1 ${toneStyles[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
};
