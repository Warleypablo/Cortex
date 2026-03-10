import { useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { useClientAuth, ClientAuthProvider } from "@/contexts/ClientAuthContext";
import { useTheme } from "@/components/ThemeProvider";
import {
  Loader2, LogOut, Sun, Moon, AlertCircle, Lock, Eye, EyeOff,
  LayoutDashboard, BarChart3, CircleDollarSign, Briefcase, MessageSquare, Settings, X,
} from "lucide-react";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

import { PortalChat } from "@/components/portal/PortalChat";

const PortalDashboard = lazy(() => import("@/components/portal/PortalDashboard").then(m => ({ default: m.PortalDashboard })));
const PortalPerformance = lazy(() => import("@/pages/PortalPerformance"));
const PortalFinanceiro = lazy(() => import("@/components/portal/PortalFinanceiro").then(m => ({ default: m.PortalFinanceiro })));
const PortalServicos = lazy(() => import("@/components/portal/PortalServicos").then(m => ({ default: m.PortalServicos })));
const PortalPerfil = lazy(() => import("@/components/portal/PortalPerfil").then(m => ({ default: m.PortalPerfil })));

type Module = "dashboard" | "relatorios" | "financeiro" | "servicos" | "atendimento" | "perfil";

const MODULES: Array<{ id: Module; label: string; Icon: React.ElementType }> = [
  { id: "dashboard",   label: "Home",         Icon: LayoutDashboard },
  { id: "relatorios",  label: "Performance",  Icon: BarChart3 },
  { id: "financeiro",  label: "Financeiro",   Icon: CircleDollarSign },
  { id: "servicos",    label: "Serviços",     Icon: Briefcase },
  { id: "atendimento", label: "Atendimento",  Icon: MessageSquare },
  { id: "perfil",      label: "Perfil",       Icon: Settings },
];

function ForcePasswordChange({ onSuccess }: { onSuccess: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("A nova senha deve ter no mínimo 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem"); return; }
    if (currentPassword === newPassword) { setError("A nova senha deve ser diferente da atual"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/client-change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erro ao alterar senha"); return; }
      onSuccess();
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${isDark ? "bg-zinc-950" : "bg-gray-50"}`}>
      <div className={`w-full max-w-sm rounded-2xl p-8 space-y-6 shadow-2xl border ${isDark ? "bg-zinc-900 border-white/[0.08]" : "bg-white border-gray-200"}`}>
        <div className="text-center space-y-2">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
            <Lock className={`w-7 h-7 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
          </div>
          <h2 className={`text-xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Troca de Senha Obrigatória</h2>
          <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>Por segurança, defina uma nova senha para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Senha Atual", value: currentPassword, set: setCurrentPassword, show: showCurrentPassword, toggle: () => setShowCurrentPassword(!showCurrentPassword), autoFocus: true },
            { label: "Nova Senha", value: newPassword, set: setNewPassword, show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword), placeholder: "Mínimo 6 caracteres" },
            { label: "Confirmar Nova Senha", value: confirmPassword, set: setConfirmPassword },
          ].map(({ label, value, set, show, toggle, placeholder, autoFocus }) => (
            <div key={label} className="space-y-1.5">
              <label className={`text-xs font-medium uppercase tracking-wider ${isDark ? "text-white/50" : "text-gray-500"}`}>{label}</label>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-white/30" : "text-gray-400"}`} />
                <input
                  type={show ? "text" : "password"}
                  value={value}
                  onChange={(e) => { set(e.target.value); setError(""); }}
                  placeholder={placeholder}
                  className={`w-full rounded-xl pl-10 ${toggle ? "pr-12" : "pr-4"} py-3 text-sm border focus:outline-none focus:ring-1 ${isDark ? "bg-zinc-800/60 border-white/[0.1] text-white placeholder:text-white/20 focus:border-blue-500/50 focus:ring-blue-500/20" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20"}`}
                  required
                  autoFocus={autoFocus}
                />
                {toggle && (
                  <button type="button" onClick={toggle} className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${isDark ? "text-white/30 hover:text-white/60" : "text-gray-400 hover:text-gray-600"} transition-colors`}>
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          {error && <p className="text-red-400 text-xs px-1">{error}</p>}
          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-medium transition-colors"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Alterando...</span></> : <span>Definir Nova Senha</span>}
          </button>
        </form>
      </div>
    </div>
  );
}

function PortalClienteContent() {
  const [, setLocation] = useLocation();
  const { client, isLoading, isAuthenticated, mustChangePassword, clearMustChangePassword, logout } = useClientAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [activeModule, setActiveModule] = useState<Module>("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen gap-3 ${isDark ? "bg-zinc-950" : "bg-slate-50"}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? "text-white/40" : "text-slate-400"}`} />
        <p className={`text-sm ${isDark ? "text-white/30" : "text-slate-400"}`}>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated || !client) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-screen gap-4 px-4 ${isDark ? "bg-zinc-950" : "bg-slate-50"}`}>
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className={`font-semibold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>Sessão não encontrada</h2>
          <p className={`text-sm ${isDark ? "text-white/40" : "text-slate-500"}`}>Sua sessão expirou ou o login não foi concluído corretamente.</p>
          <button onClick={() => setLocation("/loginclientes")} className="w-full py-3 px-6 bg-white/10 hover:bg-white/15 text-white rounded-full text-sm transition-colors mt-2">
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  if (mustChangePassword) {
    return <ForcePasswordChange onSuccess={clearMustChangePassword} />;
  }

  const initials = (client.nome ?? "C").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  const isAtivo = client.ativo === true || client.ativo === "true" || client.ativo === "1" || String(client.ativo ?? "").toLowerCase() === "ativo";

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-zinc-950 text-white" : "bg-slate-50 text-slate-900"}`}>
      {/* Header */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-10 transition-colors duration-300 ${isDark ? "border-white/[0.06] bg-zinc-900/80" : "border-slate-200 bg-white/80"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={turboLogo} alt="Turbo Partners" className={`h-6 w-auto transition-all duration-300 ${isDark ? "opacity-90" : "brightness-0 opacity-80"}`} />
            <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
            <span className={`text-xs font-medium tracking-wide ${isDark ? "text-white/40" : "text-slate-500"}`}>Área do Cliente</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className={`flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${isDark ? "text-white/35 hover:text-white/70 hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`} title={isDark ? "Ativar modo claro" : "Ativar modo escuro"}>
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button onClick={logout} className={`flex items-center gap-1.5 transition-colors text-sm px-3 py-1.5 rounded-lg ${isDark ? "text-white/35 hover:text-white/70 hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Hero */}
        <div className={`relative overflow-hidden rounded-2xl border px-6 py-6 transition-colors duration-300 ${isDark ? "bg-zinc-900 border-white/[0.07]" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/[0.07] via-transparent to-transparent" />
          <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/30 to-blue-800/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-blue-300/90">{initials}</span>
              </div>
              <div>
                <h1 className={`text-lg sm:text-xl font-bold leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>Olá, {client.nome ?? "Cliente"} 👋</h1>
                <p className={`text-xs mt-0.5 ${isDark ? "text-white/35" : "text-slate-500"}`}>Bem-vindo à sua área exclusiva.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isAtivo ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : isDark ? "bg-zinc-700/50 text-zinc-400 border border-zinc-600/30" : "bg-slate-100 text-slate-400 border border-slate-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAtivo ? "bg-emerald-400" : "bg-zinc-500"}`} />
                {isAtivo ? "Ativo" : "Inativo"}
              </span>
              <p className={`text-[11px] font-mono hidden sm:block ${isDark ? "text-white/20" : "text-slate-400"}`}>{client.cnpj ?? ""}</p>
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className={`flex gap-1 p-1 border rounded-xl overflow-x-auto ${isDark ? "bg-zinc-900/60 border-white/[0.07]" : "bg-slate-100 border-slate-200"}`}>
          {MODULES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveModule(id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                activeModule === id
                  ? isDark ? "bg-white/[0.09] text-white shadow-sm" : "bg-white text-slate-900 shadow-sm"
                  : isDark ? "text-white/30 hover:text-white/55 hover:bg-white/[0.04]" : "text-slate-400 hover:text-slate-600 hover:bg-white/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${activeModule === id ? "opacity-80" : "opacity-40"}`} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Module content */}
        <Suspense fallback={
          <div className={`flex items-center justify-center py-16 gap-2 ${isDark ? "text-white/30" : "text-slate-400"}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        }>
          {activeModule === "dashboard" && <PortalDashboard onNavigate={setActiveModule} />}
          {activeModule === "relatorios" && <PortalPerformance />}
          {activeModule === "financeiro" && <PortalFinanceiro />}
          {activeModule === "servicos" && <PortalServicos />}
          {activeModule === "atendimento" && <PortalChat clientId={client.id} variant="page" />}
          {activeModule === "perfil" && <PortalPerfil client={client} />}
        </Suspense>

        <p className={`text-center text-[11px] pb-4 ${isDark ? "text-white/15" : "text-slate-300"}`}>
          Turbo Partners · Área do Cliente · Dados protegidos
        </p>
      </main>

      {/* FAB chat — only when NOT in atendimento */}
      {activeModule !== "atendimento" && (
        <>
          {chatOpen && (
            <PortalChat
              clientId={client.id}
              variant="floating"
              onClose={() => setChatOpen(false)}
              onUnreadCountChange={setUnreadCount}
            />
          )}
          <button
            onClick={() => setChatOpen((o) => !o)}
            className={`fixed bottom-5 right-5 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-50 ${
              chatOpen
                ? isDark ? "bg-zinc-700 hover:bg-zinc-600 border border-white/[0.10] shadow-black/40" : "bg-slate-200 hover:bg-slate-300 border border-slate-300 shadow-slate-300/30"
                : "bg-blue-600 hover:bg-blue-500 border border-blue-400/20 shadow-blue-600/30"
            }`}
            title="Atendimento"
          >
            {chatOpen
              ? <X className={`w-5 h-5 ${isDark ? "text-white/70" : "text-slate-500"}`} />
              : <MessageSquare className="w-5 h-5 text-white" />
            }
            {!chatOpen && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-blue-600">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}

export default function PortalCliente() {
  return (
    <ClientAuthProvider>
      <PortalClienteContent />
    </ClientAuthProvider>
  );
}
