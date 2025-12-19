import { useState } from "react";
import { SiGoogle } from "react-icons/si";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { Input } from "@/components/ui/input";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

function GlassFilter() {
  return (
    <svg className="hidden">
      <defs>
        <filter
          id="container-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="70"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

export default function Login() {
  const [isHovered, setIsHovered] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [showExternalLogin, setShowExternalLogin] = useState(false);
  const [externalEmail, setExternalEmail] = useState('');
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState('');
  
  // Mostra botão de dev login apenas em desenvolvimento
  const isDevelopment = import.meta.env.DEV;

  const handleGoogleLogin = () => {
    window.location.href = "/auth/google";
  };
  
  const handleDevLogin = async () => {
    setIsDevLoading(true);
    try {
      const response = await fetch("/auth/dev-login", { method: "POST" });
      if (response.ok) {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Dev login failed:", error);
    } finally {
      setIsDevLoading(false);
    }
  };
  
  const handleExternalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setExternalError('');
    setExternalLoading(true);
    
    try {
      const response = await fetch("/auth/external-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: externalEmail })
      });
      
      if (response.ok) {
        window.location.href = "/investors-report";
      } else {
        const data = await response.json();
        setExternalError(data.message || "Email não autorizado");
      }
    } catch (error) {
      console.error("External login failed:", error);
      setExternalError("Erro ao fazer login. Tente novamente.");
    } finally {
      setExternalLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col min-h-screen bg-black relative overflow-hidden">
      <WebGLShader />
      <GlassFilter />
      
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.5)_0%,_rgba(0,0,0,0.2)_100%)]" />

      <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative w-full max-w-md"
        >
          <div 
            className="absolute top-0 left-0 z-0 h-full w-full rounded-2xl 
              shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(255,255,255,0.1),inset_-3px_-3px_0.5px_-3px_rgba(255,255,255,0.1),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.08),inset_-1px_-1px_1px_-0.5px_rgba(255,255,255,0.08),inset_0_0_6px_6px_rgba(255,255,255,0.03),inset_0_0_2px_2px_rgba(255,255,255,0.02),0_0_20px_rgba(255,255,255,0.05)]"
          />
          <div
            className="absolute top-0 left-0 isolate -z-10 h-full w-full overflow-hidden rounded-2xl"
            style={{ backdropFilter: 'url("#container-glass")' }}
          />
          
          <div className="relative backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 space-y-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="flex justify-center"
            >
              <img 
                src={turboLogo} 
                alt="Turbo Partners" 
                className="h-12 w-auto"
              />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-2"
            >
              <h1 className="text-[2.25rem] font-bold leading-[1.1] tracking-tight text-white">
                Turbo Cortex
              </h1>
              <p className="text-lg text-white/50 font-light">
                Plataforma de Gestão Interna
              </p>
            </motion.div>

            <AnimatePresence mode="wait">
              {!showExternalLogin ? (
                <motion.div
                  key="main-login"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 pt-2"
                >
                  <p className="text-white/40 text-sm">
                    Acesso exclusivo para colaboradores
                  </p>

                  <button
                    onClick={handleGoogleLogin}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="backdrop-blur-md w-full flex items-center justify-center gap-3 bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.1] rounded-full py-3.5 px-4 transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    data-testid="button-google-login"
                  >
                    <SiGoogle className="w-5 h-5" />
                    <span className="font-medium">Entrar com Google</span>
                  </button>
                  
                  <div className="flex items-center gap-4 my-2">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-white/30 text-xs uppercase tracking-wider">ou</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                  
                  <button
                    onClick={() => setShowExternalLogin(true)}
                    className="backdrop-blur-md w-full flex items-center justify-center gap-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-full py-3 px-4 transition-all duration-300 hover:border-orange-500/40"
                    data-testid="button-external-login"
                  >
                    <Mail className="w-5 h-5" />
                    <span className="font-medium">Login Externo</span>
                  </button>
                  
                  {isDevelopment && (
                    <button
                      onClick={handleDevLogin}
                      disabled={isDevLoading}
                      className="w-full flex items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-full py-2.5 px-4 transition-all duration-300 text-sm"
                      data-testid="button-dev-login"
                    >
                      <span>{isDevLoading ? "Entrando..." : "Entrar como Admin (Dev)"}</span>
                    </button>
                  )}
                  
                  <div className="pt-4">
                    <p className="text-xs text-white/40">
                      Autenticação segura via Google OAuth 2.0
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="external-login"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 pt-2"
                >
                  <button
                    onClick={() => {
                      setShowExternalLogin(false);
                      setExternalError('');
                      setExternalEmail('');
                    }}
                    className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
                    data-testid="button-back-login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar</span>
                  </button>
                  
                  <div className="space-y-2">
                    <h3 className="text-white font-medium">Acesso para Investidores</h3>
                    <p className="text-white/40 text-sm">
                      Digite seu email autorizado para acessar os relatórios
                    </p>
                  </div>
                  
                  <form onSubmit={handleExternalLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={externalEmail}
                        onChange={(e) => setExternalEmail(e.target.value)}
                        className="bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30 rounded-full px-4 py-3 h-auto focus:border-orange-500/50 focus:ring-orange-500/20"
                        required
                        data-testid="input-external-email"
                      />
                      {externalError && (
                        <p className="text-red-400 text-sm px-2" data-testid="text-external-error">
                          {externalError}
                        </p>
                      )}
                    </div>
                    
                    <button
                      type="submit"
                      disabled={externalLoading || !externalEmail}
                      className="backdrop-blur-md w-full flex items-center justify-center gap-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full py-3.5 px-4 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-submit-external"
                    >
                      {externalLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="font-medium">Entrando...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-5 h-5" />
                          <span className="font-medium">Entrar</span>
                        </>
                      )}
                    </button>
                  </form>
                  
                  <p className="text-xs text-white/30 text-center pt-2">
                    Acesso limitado aos relatórios de investidores
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="text-white/30 text-xs mt-8"
        >
          © 2025 Turbo Partners. Todos os direitos reservados.
        </motion.p>
      </div>
    </div>
  );
}
