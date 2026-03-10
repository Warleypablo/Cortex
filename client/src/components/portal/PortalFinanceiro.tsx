import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, TrendingUp, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { StatusBadge, formatCurrency, formatDate } from "./StatusBadge";

interface Fatura {
  id: string | number;
  status: string | null;
  valorBruto: string | null;
  valorPago: string | null;
  descricao: string | null;
  dataVencimento: string | null;
  dataQuitacao: string | null;
  naoPago: string | null;
  categoriaNome: string | null;
  tipoEvento: string | null;
  urlCobranca: string | null;
}

interface ResumoFinanceiro {
  faturas: Fatura[];
  totais: { total: number; pago: number; naoPago: number };
}

type FiltroStatus = "todas" | "pendentes" | "pagas" | "atrasadas";

export function PortalFinanceiro() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");

  const { data: resumo, isLoading } = useQuery<ResumoFinanceiro>({
    queryKey: ["/api/portal-cliente/resumo"],
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const totais = resumo?.totais ?? { total: 0, pago: 0, naoPago: 0 };
  const faturas = resumo?.faturas ?? [];

  const faturasAtrasadas = faturas.filter((f) =>
    ["ATRASADO", "VENCIDO"].includes((f.status ?? "").toUpperCase())
  );
  const totalAtrasado = faturasAtrasadas.reduce(
    (sum, f) => sum + parseFloat(f.valorBruto ?? "0"),
    0
  );

  const faturasFiltradas = faturas.filter((f) => {
    const s = (f.status ?? "").toUpperCase();
    if (filtroStatus === "pagas") return s === "QUITADO" || s === "PAGO" || s === "RECEBIDO";
    if (filtroStatus === "atrasadas") return s === "ATRASADO" || s === "VENCIDO";
    if (filtroStatus === "pendentes")
      return s !== "QUITADO" && s !== "PAGO" && s !== "RECEBIDO" && s !== "ATRASADO" && s !== "VENCIDO";
    return true;
  });

  const filtros: { key: FiltroStatus; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: faturas.length },
    {
      key: "pendentes",
      label: "Pendentes",
      count: faturas.filter((f) => {
        const s = (f.status ?? "").toUpperCase();
        return (
          s !== "QUITADO" &&
          s !== "PAGO" &&
          s !== "RECEBIDO" &&
          s !== "ATRASADO" &&
          s !== "VENCIDO"
        );
      }).length,
    },
    {
      key: "pagas",
      label: "Pagas",
      count: faturas.filter((f) => {
        const s = (f.status ?? "").toUpperCase();
        return s === "QUITADO" || s === "PAGO" || s === "RECEBIDO";
      }).length,
    },
    { key: "atrasadas", label: "Atrasadas", count: faturasAtrasadas.length },
  ];

  return (
    <div className="space-y-4">
      {/* Alert banner — faturas atrasadas */}
      {!isLoading && faturasAtrasadas.length > 0 && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
            isDark
              ? "bg-red-500/[0.08] border-red-500/20 text-red-400"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {faturasAtrasadas.length === 1
                ? "1 fatura atrasada"
                : `${faturasAtrasadas.length} faturas atrasadas`}
            </p>
            <p className={`text-xs mt-0.5 ${isDark ? "text-red-400/70" : "text-red-600/80"}`}>
              Total em aberto:{" "}
              <span className="font-semibold">{formatCurrency(totalAtrasado)}</span>
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total */}
        <div
          className={`relative overflow-hidden border rounded-2xl p-5 transition-colors duration-300 ${
            isDark
              ? "bg-zinc-900 border-white/[0.07]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div
            className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${
              isDark
                ? "from-white/0 via-white/10 to-white/0"
                : "from-slate-200/0 via-slate-200 to-slate-200/0"
            }`}
          />
          <div className="flex items-start justify-between mb-3">
            <p
              className={`text-[11px] font-medium uppercase tracking-widest ${
                isDark ? "text-white/35" : "text-slate-400"
              }`}
            >
              Total em Faturas
            </p>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                isDark ? "bg-white/[0.06]" : "bg-slate-100"
              }`}
            >
              <Receipt
                className={`w-3.5 h-3.5 ${isDark ? "text-white/30" : "text-slate-400"}`}
              />
            </div>
          </div>
          {isLoading ? (
            <div
              className={`h-7 w-28 rounded-lg animate-pulse ${
                isDark ? "bg-white/10" : "bg-slate-200"
              }`}
            />
          ) : (
            <p
              className={`text-2xl font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {formatCurrency(totais.total)}
            </p>
          )}
          <p
            className={`text-[11px] mt-2 ${isDark ? "text-white/20" : "text-slate-400"}`}
          >
            {faturas.length} faturas no total
          </p>
        </div>

        {/* Pago */}
        <div
          className={`relative overflow-hidden border rounded-2xl p-5 transition-colors duration-300 ${
            isDark
              ? "bg-zinc-900 border-white/[0.07]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-500/0 via-emerald-500/30 to-emerald-500/0" />
          <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-emerald-500/[0.04] blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between mb-3">
            <p
              className={`text-[11px] font-medium uppercase tracking-widest ${
                isDark ? "text-white/35" : "text-slate-400"
              }`}
            >
              Total Pago
            </p>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400/70" />
            </div>
          </div>
          {isLoading ? (
            <div
              className={`h-7 w-28 rounded-lg animate-pulse ${
                isDark ? "bg-white/10" : "bg-slate-200"
              }`}
            />
          ) : (
            <p
              className={`text-2xl font-bold tracking-tight ${
                isDark ? "text-emerald-400" : "text-emerald-600"
              }`}
            >
              {formatCurrency(totais.pago)}
            </p>
          )}
          <p
            className={`text-[11px] mt-2 ${
              isDark ? "text-emerald-500/30" : "text-emerald-600/50"
            }`}
          >
            {totais.total > 0
              ? `${Math.round((totais.pago / totais.total) * 100)}% do total`
              : "—"}
          </p>
        </div>

        {/* Atrasado */}
        <div
          className={`relative overflow-hidden border rounded-2xl p-5 transition-colors duration-300 ${
            isDark
              ? "bg-zinc-900 border-white/[0.07]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/0 via-red-500/25 to-red-500/0" />
          <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-red-500/[0.04] blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between mb-3">
            <p
              className={`text-[11px] font-medium uppercase tracking-widest ${
                isDark ? "text-white/35" : "text-slate-400"
              }`}
            >
              Atrasado
            </p>
            <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5 text-red-400/70" />
            </div>
          </div>
          {isLoading ? (
            <div
              className={`h-7 w-28 rounded-lg animate-pulse ${
                isDark ? "bg-white/10" : "bg-slate-200"
              }`}
            />
          ) : (
            <p
              className={`text-2xl font-bold tracking-tight ${
                isDark ? "text-red-400" : "text-red-600"
              }`}
            >
              {formatCurrency(totalAtrasado)}
            </p>
          )}
          <p
            className={`text-[11px] mt-2 ${
              isDark ? "text-red-500/30" : "text-red-600/50"
            }`}
          >
            {faturasAtrasadas.length > 0
              ? `${faturasAtrasadas.length} fatura${faturasAtrasadas.length > 1 ? "s" : ""} atrasada${faturasAtrasadas.length > 1 ? "s" : ""}`
              : "Tudo em dia"}
          </p>
        </div>
      </div>

      {/* Faturas table */}
      <div
        className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${
          isDark
            ? "bg-zinc-900 border-white/[0.07]"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        {/* Section header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap ${
            isDark ? "border-white/[0.05]" : "border-slate-100"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Receipt
              className={`w-4 h-4 ${isDark ? "text-white/25" : "text-slate-400"}`}
            />
            <h2
              className={`text-[11px] font-semibold uppercase tracking-widest ${
                isDark ? "text-white/35" : "text-slate-400"
              }`}
            >
              Faturas
            </h2>
            {!isLoading && faturas.length > 0 && (
              <span
                className={`text-xs border px-2 py-0.5 rounded-full tabular-nums ${
                  isDark
                    ? "bg-zinc-800 border-white/[0.06] text-white/25"
                    : "bg-slate-100 border-slate-200 text-slate-400"
                }`}
              >
                {faturasFiltradas.length}
                {filtroStatus !== "todas" && ` / ${faturas.length}`}
              </span>
            )}
          </div>

          {/* Filter buttons */}
          {!isLoading && faturas.length > 0 && (
            <div className="flex items-center gap-1">
              {filtros.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFiltroStatus(f.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                    filtroStatus === f.key
                      ? isDark
                        ? "bg-white/10 border-white/15 text-white/80"
                        : "bg-slate-800 border-slate-800 text-white"
                      : isDark
                      ? "bg-transparent border-white/[0.06] text-white/30 hover:text-white/55 hover:bg-white/[0.04]"
                      : "bg-transparent border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                  {f.count > 0 && (
                    <span
                      className={`ml-1.5 tabular-nums ${
                        filtroStatus === f.key
                          ? isDark
                            ? "text-white/50"
                            : "text-white/70"
                          : isDark
                          ? "text-white/20"
                          : "text-slate-300"
                      }`}
                    >
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-12 rounded-xl animate-pulse ${
                  isDark ? "bg-white/[0.04]" : "bg-slate-100"
                }`}
              />
            ))}
          </div>
        ) : faturas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                isDark
                  ? "bg-zinc-800 border-white/[0.06]"
                  : "bg-slate-100 border-slate-200"
              }`}
            >
              <Receipt
                className={`w-5 h-5 ${isDark ? "text-white/15" : "text-slate-300"}`}
              />
            </div>
            <p className={`text-sm ${isDark ? "text-white/25" : "text-slate-400"}`}>
              Nenhuma fatura encontrada
            </p>
          </div>
        ) : faturasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className={`text-sm ${isDark ? "text-white/25" : "text-slate-400"}`}>
              Nenhuma fatura com este filtro
            </p>
            <button
              onClick={() => setFiltroStatus("todas")}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                isDark
                  ? "border-white/[0.08] text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                  : "border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              Ver todas
            </button>
          </div>
        ) : (
          <>
            {/* Desktop column header */}
            <div
              className={`hidden sm:grid px-5 py-2.5 border-b ${
                isDark
                  ? "bg-zinc-800/40 border-white/[0.04]"
                  : "bg-slate-50 border-slate-100"
              }`}
              style={{ gridTemplateColumns: "1fr 100px 110px 96px 110px 80px" }}
            >
              {["Descrição", "Vencimento", "Pagamento", "Status", "Valor", "Link"].map(
                (col, i) => (
                  <span
                    key={col}
                    className={`text-[10px] font-semibold uppercase tracking-widest ${
                      i >= 4 ? "text-right" : ""
                    } ${isDark ? "text-white/20" : "text-slate-400"}`}
                  >
                    {col}
                  </span>
                )
              )}
            </div>

            {/* Rows */}
            <div
              className={`divide-y ${
                isDark ? "divide-white/[0.03]" : "divide-slate-100"
              }`}
            >
              {faturasFiltradas.map((fatura) => {
                const s = (fatura.status ?? "").toUpperCase();
                const isPago =
                  s === "QUITADO" || s === "PAGO" || s === "RECEBIDO";
                const isAtrasadoRow = s === "ATRASADO" || s === "VENCIDO";

                const borderColor = isAtrasadoRow
                  ? "border-l-red-500/50"
                  : isPago
                  ? "border-l-emerald-500/20"
                  : "border-l-amber-500/35";

                return (
                  <div key={fatura.id}>
                    {/* Desktop row */}
                    <div
                      className={`hidden sm:grid items-center px-5 py-3.5 transition-colors group border-l-[3px] ${borderColor} ${
                        isDark ? "hover:bg-white/[0.015]" : "hover:bg-slate-50"
                      }`}
                      style={{
                        gridTemplateColumns: "1fr 100px 110px 96px 110px 80px",
                      }}
                    >
                      {/* Descrição */}
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isDark ? "text-white/80" : "text-slate-700"
                          }`}
                        >
                          {fatura.descricao || fatura.categoriaNome || "Fatura"}
                        </p>
                        {fatura.descricao && fatura.categoriaNome && (
                          <p
                            className={`text-[11px] truncate mt-0.5 ${
                              isDark ? "text-white/20" : "text-slate-400"
                            }`}
                          >
                            {fatura.categoriaNome}
                          </p>
                        )}
                      </div>

                      {/* Vencimento */}
                      <p
                        className={`text-sm tabular-nums ${
                          isDark ? "text-white/45" : "text-slate-500"
                        }`}
                      >
                        {formatDate(fatura.dataVencimento)}
                      </p>

                      {/* Pagamento */}
                      <p
                        className={`text-sm tabular-nums ${
                          fatura.dataQuitacao
                            ? isDark
                              ? "text-emerald-400/60"
                              : "text-emerald-600/70"
                            : isDark
                            ? "text-white/15"
                            : "text-slate-300"
                        }`}
                      >
                        {formatDate(fatura.dataQuitacao)}
                      </p>

                      {/* Status */}
                      <div>
                        <StatusBadge status={fatura.status} />
                      </div>

                      {/* Valor */}
                      <p
                        className={`text-sm font-semibold tabular-nums text-right ${
                          isAtrasadoRow
                            ? isDark
                              ? "text-red-400"
                              : "text-red-600"
                            : isPago
                            ? isDark
                              ? "text-white/75"
                              : "text-slate-700"
                            : isDark
                            ? "text-amber-300/80"
                            : "text-amber-600"
                        }`}
                      >
                        {formatCurrency(fatura.valorBruto)}
                      </p>

                      {/* Boleto link */}
                      <div className="flex justify-end">
                        {fatura.urlCobranca ? (
                          <a
                            href={fatura.urlCobranca}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                              isDark
                                ? "bg-blue-600/15 hover:bg-blue-600/25 text-blue-400/80 border-blue-500/15"
                                : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                            }`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Boleto
                          </a>
                        ) : (
                          <span />
                        )}
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div
                      className={`sm:hidden px-4 py-3.5 border-l-[3px] ${borderColor} ${
                        isDark ? "hover:bg-white/[0.015]" : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Top row: description + status badge */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium truncate ${
                              isDark ? "text-white/80" : "text-slate-700"
                            }`}
                          >
                            {fatura.descricao || fatura.categoriaNome || "Fatura"}
                          </p>
                        </div>
                        <StatusBadge status={fatura.status} />
                      </div>

                      {/* Middle row: dates */}
                      <p
                        className={`text-xs tabular-nums mb-2 ${
                          isDark ? "text-white/30" : "text-slate-400"
                        }`}
                      >
                        <span className={isDark ? "text-white/20" : "text-slate-300"}>
                          Venc.{" "}
                        </span>
                        {formatDate(fatura.dataVencimento)}
                        {fatura.dataQuitacao && (
                          <>
                            <span
                              className={`mx-1.5 ${
                                isDark ? "text-white/15" : "text-slate-300"
                              }`}
                            >
                              ·
                            </span>
                            <span
                              className={isDark ? "text-white/20" : "text-slate-300"}
                            >
                              Pago{" "}
                            </span>
                            <span
                              className={
                                isDark
                                  ? "text-emerald-400/60"
                                  : "text-emerald-600/70"
                              }
                            >
                              {formatDate(fatura.dataQuitacao)}
                            </span>
                          </>
                        )}
                      </p>

                      {/* Bottom row: value + boleto link */}
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            isAtrasadoRow
                              ? isDark
                                ? "text-red-400"
                                : "text-red-600"
                              : isPago
                              ? isDark
                                ? "text-white/75"
                                : "text-slate-700"
                              : isDark
                              ? "text-amber-300/80"
                              : "text-amber-600"
                          }`}
                        >
                          {formatCurrency(fatura.valorBruto)}
                        </p>
                        {fatura.urlCobranca ? (
                          <a
                            href={fatura.urlCobranca}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                              isDark
                                ? "bg-blue-600/15 hover:bg-blue-600/25 text-blue-400/80 border-blue-500/15"
                                : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                            }`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Boleto
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
