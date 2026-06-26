export type Severity = "ok" | "warn" | "bad" | "critical";

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function severityLevel(value: number): Severity {
  const v = clamp(value);
  if (v < 0.25) return "ok";
  if (v < 0.5) return "warn";
  if (v < 0.75) return "bad";
  return "critical";
}

export function severityTextClass(value: number): string {
  const level = severityLevel(value);
  switch (level) {
    case "ok":       return "text-emerald-600 dark:text-emerald-400";
    case "warn":     return "text-amber-600 dark:text-amber-400";
    case "bad":      return "text-orange-600 dark:text-orange-400";
    case "critical": return "text-red-600 dark:text-red-400";
  }
}

export function severityBarClass(value: number): string {
  const level = severityLevel(value);
  switch (level) {
    case "ok":       return "bg-emerald-500";
    case "warn":     return "bg-amber-500";
    case "bad":      return "bg-orange-500";
    case "critical": return "bg-red-500";
  }
}

export function severityHex(value: number): string {
  const level = severityLevel(value);
  switch (level) {
    case "ok":       return "#10b981"; // emerald-500
    case "warn":     return "#f59e0b"; // amber-500
    case "bad":      return "#f97316"; // orange-500
    case "critical": return "#ef4444"; // red-500
  }
}
