import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Briefcase, XCircle } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { CancelamentoModal } from "./CancelamentoModal";
import type { Servico } from "./CancelamentoModal";

export function PortalServicos() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [cancelServico, setCancelServico] = useState<Servico | null>(null);

  const { data: servicos, isLoading } = useQuery<Servico[]>({
    queryKey: ["/api/portal-cliente/servicos"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <>
      <div
        className={`border rounded-2xl overflow-hidden transition-colors duration-300 ${
          isDark
            ? "bg-zinc-900 border-white/[0.07]"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center gap-3 px-5 py-4 border-b ${
            isDark ? "border-white/[0.07]" : "border-slate-100"
          }`}
        >
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              isDark
                ? "bg-zinc-800 border-white/[0.07]"
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <Briefcase
              className={`w-4 h-4 ${isDark ? "text-white/40" : "text-slate-400"}`}
            />
          </div>
          <div>
            <p
              className={`font-semibold text-sm ${
                isDark ? "text-white/80" : "text-slate-700"
              }`}
            >
              Serviços Contratados
            </p>
            <p
              className={`text-xs ${
                isDark ? "text-white/30" : "text-slate-400"
              }`}
            >
              Produtos e responsáveis ativos na sua conta
            </p>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div
            className={`flex items-center justify-center py-16 gap-2 ${
              isDark ? "text-white/30" : "text-slate-400"
            }`}
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : !servicos || servicos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <Briefcase
              className={`w-8 h-8 ${isDark ? "text-white/10" : "text-slate-200"}`}
            />
            <p
              className={`text-sm ${
                isDark ? "text-white/30" : "text-slate-400"
              }`}
            >
              Nenhum serviço encontrado para esta conta.
            </p>
          </div>
        ) : (
          <div
            className={`divide-y ${
              isDark ? "divide-white/[0.05]" : "divide-slate-100"
            }`}
          >
            {servicos.map((s, i) => {
              const st = (s.status ?? "").toLowerCase();
              const isAtivo =
                st.includes("ativo") ||
                st.includes("anda") ||
                st.includes("progr");
              const isConcluido =
                st.includes("conclui") ||
                st.includes("finaliz") ||
                st.includes("encerr");
              const isPausado =
                st.includes("paus") || st.includes("suspen");

              const badgeClass = isAtivo
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : isConcluido
                ? isDark
                  ? "bg-zinc-700/60 text-white/40 border-white/[0.07]"
                  : "bg-slate-100 text-slate-400 border-slate-200"
                : isPausado
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20";

              return (
                <div
                  key={i}
                  className="flex items-center justify-between px-5 py-4 gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        isDark ? "text-white/80" : "text-slate-700"
                      }`}
                    >
                      {s.produto ?? "—"}
                    </p>
                    {s.responsavel && (
                      <p
                        className={`text-xs mt-0.5 truncate ${
                          isDark ? "text-white/30" : "text-slate-400"
                        }`}
                      >
                        Responsável: {s.responsavel}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.status && (
                      <span
                        className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${badgeClass}`}
                      >
                        {s.status}
                      </span>
                    )}
                    {!isConcluido && (
                      <button
                        onClick={() => setCancelServico(s)}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium bg-transparent hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors ${
                          isDark
                            ? "text-white/20 border-white/[0.07]"
                            : "text-slate-300 border-slate-200"
                        }`}
                      >
                        <XCircle className="w-3 h-3" />
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelServico && (
        <CancelamentoModal
          servico={cancelServico}
          onClose={() => setCancelServico(null)}
        />
      )}
    </>
  );
}
