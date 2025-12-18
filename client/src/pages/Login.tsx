import { useState } from "react";
import { SiGoogle } from "react-icons/si";
import { motion } from "framer-motion";
import { WebGLShader } from "@/components/ui/web-gl-shader";
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

  const handleGoogleLogin = () => {
    window.location.href = "/auth/google";
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

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
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
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <div className="flex items-center gap-4 my-4">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-white/30 text-xs uppercase tracking-wider">Seguro</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <p className="text-xs text-white/40">
                Autenticação via Google OAuth 2.0
              </p>
            </motion.div>
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
