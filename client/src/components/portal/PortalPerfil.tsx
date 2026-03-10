import { useState } from "react";
import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Mail,
  Phone,
  Pencil,
  Check,
  X,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClientUser {
  id: number;
  nome: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  ativo: any;
}

interface Props {
  client: ClientUser;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PortalPerfil({ client }: Props) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const queryClient = useQueryClient();

  // ── Contact edit state ────────────────────────────────────────────────────
  const [editField, setEditField] = useState<"email" | "telefone" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Password change state ─────────────────────────────────────────────────
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function startEdit(field: "email" | "telefone", value: string) {
    setEditField(field);
    setEditValue(value);
    setEditError("");
  }

  function cancelEdit() {
    setEditField(null);
    setEditValue("");
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editField) return;

    setEditSaving(true);
    setEditError("");

    try {
      const res = await fetch("/api/portal-cliente/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [editField]: editValue }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.message || "Erro ao salvar. Tente novamente.");
        return;
      }
      // Update query cache so parent page reflects the new value immediately
      queryClient.setQueryData(["/api/auth/client-me"], (old: any) => {
        if (!old) return old;
        return { ...old, [editField]: editValue };
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/client-me"] });
      setEditField(null);
      setEditValue("");
    } catch {
      setEditError("Erro ao conectar. Tente novamente.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);

    if (newPassword.length < 6) {
      setPwError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("As senhas não coincidem.");
      return;
    }
    if (currentPassword === newPassword) {
      setPwError("A nova senha deve ser diferente da atual.");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/client-change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.message || "Erro ao alterar senha.");
        return;
      }
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Collapse form after a short delay
      setTimeout(() => {
        setShowPasswordForm(false);
        setPwSuccess(false);
      }, 2500);
    } catch {
      setPwError("Erro ao conectar. Tente novamente.");
    } finally {
      setPwSaving(false);
    }
  }

  function handleCancelPasswordForm() {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwError("");
    setPwSuccess(false);
  }

  // ── Shared style helpers ──────────────────────────────────────────────────

  const cardClass = `border rounded-2xl overflow-hidden transition-colors duration-300 ${
    isDark
      ? "bg-zinc-900 border-white/[0.07]"
      : "bg-white border-slate-200 shadow-sm"
  }`;

  const cardHeaderClass = `px-5 py-4 border-b ${
    isDark ? "border-white/[0.05]" : "border-slate-100"
  }`;

  const sectionTitleClass = `text-[11px] font-semibold uppercase tracking-widest ${
    isDark ? "text-white/35" : "text-slate-400"
  }`;

  const divideClass = `divide-y ${
    isDark ? "divide-white/[0.04]" : "divide-slate-100"
  }`;

  const iconBoxClass = `w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
    isDark ? "bg-zinc-800 border-white/[0.06]" : "bg-slate-100 border-slate-200"
  }`;

  const iconClass = `w-3.5 h-3.5 ${isDark ? "text-white/25" : "text-slate-400"}`;

  const labelClass = `text-[10px] uppercase tracking-wider mb-0.5 ${
    isDark ? "text-white/25" : "text-slate-400"
  }`;

  const valueClass = `text-sm font-medium truncate ${
    isDark ? "text-white/75" : "text-slate-700"
  }`;

  const inputClass = `flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 ${
    isDark
      ? "bg-zinc-800 border-white/[0.12] text-white/80 placeholder:text-white/20"
      : "bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-300"
  }`;

  const saveButtonClass =
    "flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-colors disabled:opacity-50";

  const cancelButtonClass = `p-1.5 rounded-lg transition-colors ${
    isDark
      ? "text-white/25 hover:text-white/55 hover:bg-white/5"
      : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
  }`;

  const editButtonClass = `flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors shrink-0 ${
    isDark
      ? "text-white/25 hover:text-white/60 hover:bg-white/5"
      : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
  }`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── 1. Dados da Empresa ─────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className={cardHeaderClass}>
          <h2 className={sectionTitleClass}>Dados da Empresa</h2>
        </div>
        <div className={divideClass}>

          {/* Nome da empresa */}
          <div className="px-5 py-3.5 flex items-center gap-3">
            <div className={iconBoxClass}>
              <Building2 className={iconClass} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={labelClass}>Empresa</p>
              <p className={valueClass}>{client.nome ?? "—"}</p>
            </div>
          </div>

          {/* CNPJ */}
          <div className="px-5 py-3.5 flex items-center gap-3">
            <div className={iconBoxClass}>
              <Building2 className={iconClass} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={labelClass}>CNPJ</p>
              <p className={`text-sm font-mono ${isDark ? "text-white/60" : "text-slate-500"}`}>
                {client.cnpj ?? "—"}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── 2. Contato ──────────────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className={cardHeaderClass}>
          <h2 className={sectionTitleClass}>Contato</h2>
        </div>
        <div className={divideClass}>

          {/* E-mail */}
          <div className="px-5 py-3.5 flex items-start gap-3">
            <div className={`${iconBoxClass} mt-0.5`}>
              <Mail className={iconClass} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] uppercase tracking-wider mb-1 ${isDark ? "text-white/25" : "text-slate-400"}`}>
                E-mail
              </p>
              {editField === "email" ? (
                <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="seu@email.com"
                    className={inputClass}
                    autoFocus
                  />
                  <button type="submit" disabled={editSaving} className={saveButtonClass}>
                    {editSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {!editSaving && "Salvar"}
                  </button>
                  <button type="button" onClick={cancelEdit} className={cancelButtonClass}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm ${
                      client.email
                        ? isDark ? "text-white/65" : "text-slate-600"
                        : isDark ? "text-white/20 italic" : "text-slate-300 italic"
                    }`}
                  >
                    {client.email ?? "Não informado"}
                  </span>
                  <button
                    onClick={() => startEdit("email", client.email ?? "")}
                    className={editButtonClass}
                  >
                    <Pencil className="w-3 h-3" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                </div>
              )}
              {editField === "email" && editError && (
                <p className="text-xs text-red-400 mt-1">{editError}</p>
              )}
            </div>
          </div>

          {/* Telefone */}
          <div className="px-5 py-3.5 flex items-start gap-3">
            <div className={`${iconBoxClass} mt-0.5`}>
              <Phone className={iconClass} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] uppercase tracking-wider mb-1 ${isDark ? "text-white/25" : "text-slate-400"}`}>
                Telefone
              </p>
              {editField === "telefone" ? (
                <form onSubmit={handleSaveEdit} className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className={inputClass}
                    autoFocus
                  />
                  <button type="submit" disabled={editSaving} className={saveButtonClass}>
                    {editSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {!editSaving && "Salvar"}
                  </button>
                  <button type="button" onClick={cancelEdit} className={cancelButtonClass}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm ${
                      client.telefone
                        ? isDark ? "text-white/65" : "text-slate-600"
                        : isDark ? "text-white/20 italic" : "text-slate-300 italic"
                    }`}
                  >
                    {client.telefone ?? "Não informado"}
                  </span>
                  <button
                    onClick={() => startEdit("telefone", client.telefone ?? "")}
                    className={editButtonClass}
                  >
                    <Pencil className="w-3 h-3" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                </div>
              )}
              {editField === "telefone" && editError && (
                <p className="text-xs text-red-400 mt-1">{editError}</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── 3. Segurança ────────────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className={cardHeaderClass}>
          <h2 className={sectionTitleClass}>Segurança</h2>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Trigger row */}
          {!showPasswordForm && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={iconBoxClass}>
                  <Lock className={iconClass} />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-slate-700"}`}>
                    Senha
                  </p>
                  <p className={`text-xs ${isDark ? "text-white/25" : "text-slate-400"}`}>
                    Altere sua senha de acesso
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordForm(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isDark
                    ? "border-white/[0.08] text-white/45 hover:text-white/70 hover:bg-white/[0.04]"
                    : "border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Pencil className="w-3 h-3" />
                Alterar Senha
              </button>
            </div>
          )}

          {/* Password change form */}
          {showPasswordForm && (
            <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "bg-zinc-800/50 border-white/[0.06]" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-white/35" : "text-slate-400"}`}>
                  Alterar Senha
                </p>
                <button
                  type="button"
                  onClick={handleCancelPasswordForm}
                  className={cancelButtonClass}
                  aria-label="Cancelar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Success message */}
              {pwSuccess && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-emerald-500/10 border border-emerald-500/20">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400 font-medium">Senha alterada com sucesso.</p>
                </div>
              )}

              {!pwSuccess && (
                <form onSubmit={handleChangePassword} className="space-y-3">

                  {/* Senha atual */}
                  <div className="space-y-1">
                    <label className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? "text-white/30" : "text-slate-400"}`}>
                      Senha atual
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => { setCurrentPassword(e.target.value); setPwError(""); }}
                        placeholder="••••••••"
                        className={`w-full text-sm border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 ${
                          isDark
                            ? "bg-zinc-800 border-white/[0.12] text-white/80 placeholder:text-white/15"
                            : "bg-white border-slate-200 text-slate-700 placeholder:text-slate-300"
                        }`}
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw((v) => !v)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? "text-white/25 hover:text-white/55" : "text-slate-300 hover:text-slate-500"}`}
                        aria-label={showCurrentPw ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Nova senha */}
                  <div className="space-y-1">
                    <label className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? "text-white/30" : "text-slate-400"}`}>
                      Nova senha
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setPwError(""); }}
                        placeholder="Mínimo 6 caracteres"
                        className={`w-full text-sm border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 ${
                          isDark
                            ? "bg-zinc-800 border-white/[0.12] text-white/80 placeholder:text-white/15"
                            : "bg-white border-slate-200 text-slate-700 placeholder:text-slate-300"
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw((v) => !v)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? "text-white/25 hover:text-white/55" : "text-slate-300 hover:text-slate-500"}`}
                        aria-label={showNewPw ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirmar nova senha */}
                  <div className="space-y-1">
                    <label className={`text-[10px] uppercase tracking-wider font-medium ${isDark ? "text-white/30" : "text-slate-400"}`}>
                      Confirmar nova senha
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPwError(""); }}
                        placeholder="Repita a nova senha"
                        className={`w-full text-sm border rounded-lg px-3 py-2 pr-10 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 ${
                          isDark
                            ? "bg-zinc-800 border-white/[0.12] text-white/80 placeholder:text-white/15"
                            : "bg-white border-slate-200 text-slate-700 placeholder:text-slate-300"
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? "text-white/25 hover:text-white/55" : "text-slate-300 hover:text-slate-500"}`}
                        aria-label={showConfirmPw ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showConfirmPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Error message */}
                  {pwError && (
                    <p className="text-xs text-red-400 px-0.5">{pwError}</p>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    {pwSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Alterando...</span>
                      </>
                    ) : (
                      <span>Salvar nova senha</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── 4. Preferências ─────────────────────────────────────────────────── */}
      <div className={cardClass}>
        <div className={cardHeaderClass}>
          <h2 className={sectionTitleClass}>Preferências</h2>
        </div>
        <div className={divideClass}>

          {/* Theme toggle row */}
          <div className="px-5 py-3.5 flex items-center gap-3">
            <div className={iconBoxClass}>
              <Settings className={iconClass} />
            </div>
            <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
              <div>
                <p className={`text-sm font-medium ${isDark ? "text-white/70" : "text-slate-700"}`}>
                  {isDark ? "Modo escuro" : "Modo claro"}
                </p>
                <p className={`text-xs ${isDark ? "text-white/25" : "text-slate-400"}`}>
                  Aparência da interface
                </p>
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Alternar tema"
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  isDark
                    ? "border-white/[0.08] text-white/45 hover:text-white/70 hover:bg-white/[0.04]"
                    : "border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5" />
                    <span>Modo claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5" />
                    <span>Modo escuro</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
