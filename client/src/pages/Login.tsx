import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SiGoogle } from "react-icons/si";
import { motion } from "framer-motion";
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect";
import { Zap } from "lucide-react";

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
            [139, 92, 246],
            [59, 130, 246],
          ]}
          dotSize={4}
          showGradient={true}
          reverse={false}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.8)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 space-y-8">
            <div className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/25"
              >
                <Zap className="w-10 h-10 text-white" strokeWidth={2.5} />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Turbo Cortex
                </h1>
                <p className="text-white/50 mt-2 text-sm">
                  Plataforma de Gestão Interna
                </p>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="space-y-4"
            >
              <p className="text-center text-white/70 text-sm">
                Acesso exclusivo para colaboradores da Turbo Partners
              </p>

              <Button
                onClick={handleGoogleLogin}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-100 text-gray-900 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-white/10"
                data-testid="button-google-login"
              >
                <motion.div
                  className="flex items-center justify-center gap-3"
                  animate={{ scale: isHovered ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <SiGoogle className="w-5 h-5" />
                  <span>Entrar com Google</span>
                </motion.div>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <div className="flex items-center gap-4 my-4">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-white/30 text-xs uppercase tracking-wider">Seguro</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              <p className="text-xs text-center text-white/40">
                Autenticação via Google OAuth 2.0
                <br />
                Seus dados estão protegidos
              </p>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="text-center text-white/30 text-xs mt-6"
          >
            © 2025 Turbo Partners. Todos os direitos reservados.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
