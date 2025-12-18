import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SiGoogle } from "react-icons/si";
import { motion } from "framer-motion";
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect";
import turboLogo from "@assets/Logo-Turbo-branca_(1)_1766081013390.png";

export default function Login() {
  const [isHovered, setIsHovered] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = "/auth/google";
  };

  return (
    <div className="flex w-full flex-col min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-black"
          colors={[
            [255, 255, 255],
            [255, 255, 255],
          ]}
          dotSize={6}
          showGradient={true}
          reverse={false}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.9)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm space-y-8 text-center"
        >
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
            <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
              Turbo Cortex
            </h1>
            <p className="text-[1.25rem] text-white/50 font-light">
              Plataforma de Gestão Interna
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="space-y-4"
          >
            <p className="text-white/40 text-sm">
              Acesso exclusivo para colaboradores
            </p>

            <button
              onClick={handleGoogleLogin}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="backdrop-blur-[2px] w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full py-3.5 px-4 transition-all duration-300"
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
            <div className="flex items-center gap-4 my-6">
              <div className="h-px bg-white/10 flex-1" />
              <span className="text-white/30 text-xs uppercase tracking-wider">Seguro</span>
              <div className="h-px bg-white/10 flex-1" />
            </div>

            <p className="text-xs text-white/40">
              Autenticação via Google OAuth 2.0
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="text-white/30 text-xs pt-8"
          >
            © 2025 Turbo Partners. Todos os direitos reservados.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
