import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, ArrowLeft, Shield, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0,2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
}

export default function LoginCliente() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [cnpj, setCnpj] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch("/auth/client-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj, password }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.client) {
          queryClient.setQueryData(["/api/auth/client-me"], data.client);
        }
        setLocation("/portal-cliente");
      } else {
        const data = await response.json();
        setError(data.message || "CNPJ não encontrado. Verifique e tente novamente.");
      }
    } catch {
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      {/* Background subtle gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.06)_0%,_transparent_60%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-zinc-900 border border-white/[0.08] rounded-2xl p-8 space-y-7 shadow-2xl">
          {/* Logo + título */}
          <div className="text-center space-y-4">
            <img src={turboLogo} alt="Turbo Partners" className="h-9 w-auto mx-auto" />
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-white">Área do Cliente</h1>
              <p className="text-sm text-white/40">
                Acesse sua área exclusiva com seu CNPJ
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                CNPJ da Empresa
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(maskCnpj(e.target.value));
                    if (error) setError('');
                  }}
                  className="bg-zinc-800/60 border-white/[0.1] text-white placeholder:text-white/20 rounded-xl pl-10 pr-4 py-3 h-auto focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-sm"
                  required
                  autoFocus
                  data-testid="input-cnpj"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="bg-zinc-800/60 border-white/[0.1] text-white placeholder:text-white/20 rounded-xl pl-10 pr-12 py-3 h-auto focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 text-sm"
                  required
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs px-1"
                data-testid="text-error"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading || cnpj.replace(/\D/g, '').length !== 14 || !password}
              className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-medium transition-colors"
              data-testid="button-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Acessar Área do Cliente</span>
                </>
              )}
            </button>
          </form>

          {/* Rodapé */}
          <div className="pt-1 border-t border-white/[0.06] flex items-center justify-between">
            <button
              onClick={() => setLocation("/login")}
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao login</span>
            </button>
            <p className="text-white/20 text-xs">Turbo Partners</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
