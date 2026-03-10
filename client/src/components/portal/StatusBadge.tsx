import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function StatusBadge({ status }: { status: string | null }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const s = (status ?? "").toUpperCase();

  if (s === "RECEBIDO" || s === "PAGO" || s === "QUITADO") {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
        isDark ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border-emerald-200"
      }`}>
        <CheckCircle2 className="w-3 h-3" />
        Pago
      </span>
    );
  }

  if (s === "ATRASADO" || s === "VENCIDO") {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
        isDark ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-red-50 text-red-600 border-red-200"
      }`}>
        <AlertCircle className="w-3 h-3" />
        Atrasado
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
      isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200"
    }`}>
      <Clock className="w-3 h-3" />
      {status ?? "Pendente"}
    </span>
  );
}

export function formatCurrency(value: number | string | null | undefined) {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}
