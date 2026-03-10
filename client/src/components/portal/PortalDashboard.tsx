import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  AlertCircle,
  Briefcase,
  MessageSquare,
  BarChart3,
  CircleDollarSign,
  Settings,
  Loader2,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { StatusBadge, formatCurrency, formatDate } from "./StatusBadge";

type Module =
  | "dashboard"
  | "financeiro"
  | "relatorios"
  | "servicos"
  | "atendimento"
  | "perfil";

interface Props {
  onNavigate: (module: Module) => void;
}

interface DashboardData {
  proximoVencimento: { valor: number; data: string } | null;
  faturasAtrasadas: { count: number; total: number };
  servicosAtivos: number;
  mensagensNaoLidas: number;
  ultimasFaturas: Array<{
    id: string | number;
    status: string | null;
    valorBruto: string | null;
    descricao: string | null;
    dataVencimento: string | null;
    categoriaNome: string | null;
    urlCobranca: string | null;
  }>;
  alertas: Array<{ tipo: string; mensagem: string }>;
}

export function PortalDashboard({ onNavigate }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/portal-cliente/dashboard"],
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2
          className={`w-8 h-8 animate-spin ${isDark ? "text-white/40" : "text-slate-400"}`}
        />
        <p className={`text-sm ${isDark ? "text-white/40" : "text-slate-400"}`}>
          Carregando...
        </p>
      </div>
    );
  }

  const proximoVencimento = data?.proximoVencimento ?? null;
  const faturasAtrasadas = data?.faturasAtrasadas ?? { count: 0, total: 0 };
  const servicosAtivos = data?.servicosAtivos ?? 0;
  const mensagensNaoLidas = data?.mensagensNaoLidas ?? 0;
  const ultimasFaturas = (data?.ultimasFaturas ?? []).slice(0, 3);
  const alertas = data?.alertas ?? [];

  // ── KPI card helper ──────────────────────────────────────────────────────
  const cardBase = `border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
    isDark
      ? "bg-zinc-900 border-white/[0.07] hover:border-white/[0.12]"
      : "bg-white border-slate-200 shadow-sm hover:shadow-md"
  }`;

  // ── Quick action button helper ────────────────────────────────────────────
  const actionBase = `flex flex-col items-center justify-center gap-2 rounded-2xl p-5 border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
    isDark
      ? "bg-zinc-900 border-white/[0.07] hover:border-white/[0.15]"
      : "bg-white border-slate-200 shadow-sm hover:shadow-md"
  }`;

  return (
    <div className="space-y-6">
      {/* ── 1. KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 — Próximo Vencimento */}
        <div className={cardBase} onClick={() => onNavigate("financeiro")}>
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isDark ? "bg-blue-500/10" : "bg-blue-50"
              }`}
            >
              <CalendarClock className="w-5 h-5 text-blue-500" />
            </div>
            <ArrowRight
              className={`w-4 h-4 mt-1 ${isDark ? "text-white/20" : "text-slate-300"}`}
            />
          </div>
          <p
            className={`text-xs font-medium mb-1 ${isDark ? "text-white/40" : "text-slate-400"}`}
          >
            Próximo Vencimento
          </p>
          <p
            className={`text-xl font-bold leading-tight ${isDark ? "text-white/90" : "text-slate-800"}`}
          >
            {proximoVencimento ? formatCurrency(proximoVencimento.valor) : "—"}
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-slate-400"}`}>
            {proximoVencimento
              ? formatDate(proximoVencimento.data)
              : "Nenhuma pendente"}
          </p>
        </div>

        {/* Card 2 — Faturas Atrasadas */}
        <div className={cardBase} onClick={() => onNavigate("financeiro")}>
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                faturasAtrasadas.count > 0
                  ? isDark
                    ? "bg-red-500/10"
                    : "bg-red-50"
                  : isDark
                    ? "bg-emerald-500/10"
                    : "bg-emerald-50"
              }`}
            >
              <AlertCircle
                className={`w-5 h-5 ${
                  faturasAtrasadas.count > 0
                    ? "text-red-500"
                    : "text-emerald-500"
                }`}
              />
            </div>
            <ArrowRight
              className={`w-4 h-4 mt-1 ${isDark ? "text-white/20" : "text-slate-300"}`}
            />
          </div>
          <p
            className={`text-xs font-medium mb-1 ${isDark ? "text-white/40" : "text-slate-400"}`}
          >
            Faturas Atrasadas
          </p>
          <p
            className={`text-xl font-bold leading-tight ${
              faturasAtrasadas.count > 0
                ? "text-red-500"
                : isDark
                  ? "text-emerald-400"
                  : "text-emerald-600"
            }`}
          >
            {faturasAtrasadas.count}
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-slate-400"}`}>
            {faturasAtrasadas.count > 0
              ? formatCurrency(faturasAtrasadas.total)
              : "Tudo em dia"}
          </p>
        </div>

        {/* Card 3 — Serviços Ativos */}
        <div className={cardBase} onClick={() => onNavigate("servicos")}>
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isDark ? "bg-emerald-500/10" : "bg-emerald-50"
              }`}
            >
              <Briefcase className="w-5 h-5 text-emerald-500" />
            </div>
            <ArrowRight
              className={`w-4 h-4 mt-1 ${isDark ? "text-white/20" : "text-slate-300"}`}
            />
          </div>
          <p
            className={`text-xs font-medium mb-1 ${isDark ? "text-white/40" : "text-slate-400"}`}
          >
            Serviços Ativos
          </p>
          <p
            className={`text-xl font-bold leading-tight ${isDark ? "text-emerald-400" : "text-emerald-600"}`}
          >
            {servicosAtivos}
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-slate-400"}`}>
            serviço{servicosAtivos !== 1 ? "s" : ""} ativo
            {servicosAtivos !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Card 4 — Mensagens */}
        <div className={cardBase} onClick={() => onNavigate("atendimento")}>
          <div className="flex items-start justify-between mb-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                mensagensNaoLidas > 0
                  ? isDark
                    ? "bg-blue-500/10"
                    : "bg-blue-50"
                  : isDark
                    ? "bg-zinc-800"
                    : "bg-slate-100"
              }`}
            >
              <MessageSquare
                className={`w-5 h-5 ${
                  mensagensNaoLidas > 0
                    ? "text-blue-500"
                    : isDark
                      ? "text-white/30"
                      : "text-slate-400"
                }`}
              />
            </div>
            <ArrowRight
              className={`w-4 h-4 mt-1 ${isDark ? "text-white/20" : "text-slate-300"}`}
            />
          </div>
          <p
            className={`text-xs font-medium mb-1 ${isDark ? "text-white/40" : "text-slate-400"}`}
          >
            Mensagens
          </p>
          <p
            className={`text-xl font-bold leading-tight ${
              mensagensNaoLidas > 0
                ? "text-blue-500"
                : isDark
                  ? "text-white/90"
                  : "text-slate-800"
            }`}
          >
            {mensagensNaoLidas}
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-slate-400"}`}>
            {mensagensNaoLidas > 0 ? "não lida(s)" : "Tudo lido"}
          </p>
        </div>
      </div>

      {/* ── 2. Alertas ────────────────────────────────────────────────────── */}
      {alertas.length > 0 && (
        <div className="space-y-3">
          {alertas.map((alerta, i) => {
            const isAtrasado = alerta.tipo === "atrasado";
            const isMensagem = alerta.tipo === "mensagem";

            if (isAtrasado) {
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                    isDark
                      ? "bg-red-500/5 border-red-500/20 text-red-400"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-sm flex-1">{alerta.mensagem}</p>
                  <button
                    onClick={() => onNavigate("financeiro")}
                    className={`text-xs font-medium underline underline-offset-2 flex-shrink-0 ${
                      isDark ? "text-red-400" : "text-red-600"
                    }`}
                  >
                    Ver detalhes
                  </button>
                </div>
              );
            }

            if (isMensagem) {
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                    isDark
                      ? "bg-blue-500/5 border-blue-500/20 text-blue-400"
                      : "bg-blue-50 border-blue-200 text-blue-700"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-sm flex-1">{alerta.mensagem}</p>
                  <button
                    onClick={() => onNavigate("atendimento")}
                    className={`text-xs font-medium underline underline-offset-2 flex-shrink-0 ${
                      isDark ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    Ver mensagens
                  </button>
                </div>
              );
            }

            // Generic fallback
            return (
              <div
                key={i}
                className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                  isDark
                    ? "bg-amber-500/5 border-amber-500/20 text-amber-400"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm">{alerta.mensagem}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. Ações Rápidas ──────────────────────────────────────────────── */}
      <div
        className={`border rounded-2xl p-5 ${
          isDark
            ? "bg-zinc-900 border-white/[0.07]"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <p
          className={`text-sm font-semibold mb-4 ${isDark ? "text-white/70" : "text-slate-600"}`}
        >
          Ações Rápidas
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Ver Performance */}
          <button
            className={actionBase}
            onClick={() => onNavigate("relatorios")}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? "bg-violet-500/10" : "bg-violet-50"
              }`}
            >
              <BarChart3 className="w-5 h-5 text-violet-500" />
            </div>
            <span
              className={`text-xs font-medium text-center ${isDark ? "text-white/70" : "text-slate-600"}`}
            >
              Ver Performance
            </span>
          </button>

          {/* Ver Faturas */}
          <button
            className={actionBase}
            onClick={() => onNavigate("financeiro")}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? "bg-emerald-500/10" : "bg-emerald-50"
              }`}
            >
              <CircleDollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <span
              className={`text-xs font-medium text-center ${isDark ? "text-white/70" : "text-slate-600"}`}
            >
              Ver Faturas
            </span>
          </button>

          {/* Meus Serviços */}
          <button
            className={actionBase}
            onClick={() => onNavigate("servicos")}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? "bg-blue-500/10" : "bg-blue-50"
              }`}
            >
              <ClipboardList className="w-5 h-5 text-blue-500" />
            </div>
            <span
              className={`text-xs font-medium text-center ${isDark ? "text-white/70" : "text-slate-600"}`}
            >
              Meus Serviços
            </span>
          </button>

          {/* Falar com Suporte */}
          <button
            className={actionBase}
            onClick={() => onNavigate("atendimento")}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? "bg-cyan-500/10" : "bg-cyan-50"
              }`}
            >
              <MessageSquare className="w-5 h-5 text-cyan-500" />
            </div>
            <span
              className={`text-xs font-medium text-center ${isDark ? "text-white/70" : "text-slate-600"}`}
            >
              Falar com Suporte
            </span>
          </button>

          {/* Meu Perfil */}
          <button className={actionBase} onClick={() => onNavigate("perfil")}>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDark ? "bg-zinc-700" : "bg-slate-100"
              }`}
            >
              <Settings
                className={`w-5 h-5 ${isDark ? "text-white/50" : "text-slate-500"}`}
              />
            </div>
            <span
              className={`text-xs font-medium text-center ${isDark ? "text-white/70" : "text-slate-600"}`}
            >
              Meu Perfil
            </span>
          </button>
        </div>
      </div>

      {/* ── 4. Últimas Faturas ────────────────────────────────────────────── */}
      <div
        className={`border rounded-2xl overflow-hidden ${
          isDark
            ? "bg-zinc-900 border-white/[0.07]"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${
            isDark ? "border-white/[0.07]" : "border-slate-100"
          }`}
        >
          <p
            className={`font-semibold text-sm ${isDark ? "text-white/80" : "text-slate-700"}`}
          >
            Últimas Faturas
          </p>
        </div>

        {/* List */}
        {ultimasFaturas.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className={`text-sm ${isDark ? "text-white/30" : "text-slate-400"}`}>
              Nenhuma fatura encontrada.
            </p>
          </div>
        ) : (
          <div>
            {ultimasFaturas.map((fatura, i) => (
              <div
                key={fatura.id ?? i}
                className={`flex items-center gap-3 px-5 py-3 ${
                  i < ultimasFaturas.length - 1
                    ? isDark
                      ? "border-b border-white/[0.05]"
                      : "border-b border-slate-50"
                    : ""
                }`}
              >
                {/* Descrição */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${isDark ? "text-white/80" : "text-slate-700"}`}
                  >
                    {fatura.descricao ?? fatura.categoriaNome ?? "Fatura"}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${isDark ? "text-white/30" : "text-slate-400"}`}
                  >
                    {formatDate(fatura.dataVencimento)}
                  </p>
                </div>

                {/* Status */}
                <StatusBadge status={fatura.status} />

                {/* Valor */}
                <p
                  className={`text-sm font-semibold tabular-nums flex-shrink-0 ${isDark ? "text-white/80" : "text-slate-700"}`}
                >
                  {formatCurrency(fatura.valorBruto)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Footer link */}
        <div
          className={`px-5 py-3 border-t ${isDark ? "border-white/[0.05]" : "border-slate-50"}`}
        >
          <button
            onClick={() => onNavigate("financeiro")}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              isDark
                ? "text-blue-400 hover:text-blue-300"
                : "text-blue-600 hover:text-blue-700"
            }`}
          >
            Ver todas as faturas
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
