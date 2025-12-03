import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, PartyPopper, Sparkles, X, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WonDeal {
  id: number;
  title: string;
  closerName: string;
  opportunity: number;
  contractType: string;
}

interface DealCelebrationProps {
  websocketUrl?: string;
  autoClose?: number;
}

export function DealCelebration({ 
  websocketUrl = `wss://${window.location.host}/ws/deals`,
  autoClose = 15000
}: DealCelebrationProps) {
  const [currentDeal, setCurrentDeal] = useState<WonDeal | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const playSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playNote = (frequency: number, startTime: number, duration: number, volume: number = 0.3) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      
      // Victory fanfare melody (like a celebration jingle)
      // C major chord arpeggio going up
      playNote(523.25, now, 0.15, 0.4);        // C5
      playNote(659.25, now + 0.1, 0.15, 0.4);  // E5
      playNote(783.99, now + 0.2, 0.15, 0.4);  // G5
      playNote(1046.5, now + 0.3, 0.4, 0.5);   // C6 (longer, louder)
      
      // Second part - higher notes
      playNote(1174.66, now + 0.5, 0.15, 0.35); // D6
      playNote(1318.51, now + 0.6, 0.15, 0.35); // E6
      playNote(1567.98, now + 0.7, 0.5, 0.5);   // G6 (triumphant ending)
      
      // Add some sparkle notes
      playNote(2093.0, now + 0.4, 0.1, 0.2);   // C7 sparkle
      playNote(2637.02, now + 0.75, 0.15, 0.2); // E7 sparkle
      
      console.log("[DealCelebration] Playing celebration sound!");
    } catch (error) {
      console.log("Could not play celebration sound:", error);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/deals`;
      
      console.log("[DealCelebration] Connecting to:", wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[DealCelebration] Connected!");
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[DealCelebration] Received message:", message);

          if (message.type === "NEW_DEAL_WON") {
            setCurrentDeal(message.data);
            playSound();
          }
        } catch (error) {
          console.error("[DealCelebration] Error parsing message:", error);
        }
      };

      ws.onclose = () => {
        console.log("[DealCelebration] Disconnected, will reconnect...");
        setIsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = (error) => {
        console.error("[DealCelebration] WebSocket error:", error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("[DealCelebration] Connection error:", error);
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [playSound]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  useEffect(() => {
    if (currentDeal && autoClose > 0) {
      const timer = setTimeout(() => {
        setCurrentDeal(null);
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [currentDeal, autoClose]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const confettiColors = ['#FFD700', '#00FFFF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  return (
    <>
      <AnimatePresence>
        {currentDeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
            data-testid="celebration-overlay"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 50 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: confettiColors[i % confettiColors.length],
                    left: `${Math.random() * 100}%`,
                    top: '-20px',
                  }}
                  initial={{ y: -20, opacity: 1, rotate: 0 }}
                  animate={{
                    y: window.innerHeight + 100,
                    opacity: [1, 1, 0],
                    rotate: Math.random() * 720 - 360,
                    x: Math.random() * 200 - 100,
                  }}
                  transition={{
                    duration: 3 + Math.random() * 2,
                    delay: Math.random() * 0.5,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white/60 hover:text-white hover:bg-white/10"
              onClick={() => setCurrentDeal(null)}
              data-testid="close-celebration"
            >
              <X className="w-6 h-6" />
            </Button>

            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className="relative"
            >
              <div className="absolute -inset-20 bg-gradient-to-r from-yellow-500/20 via-cyan-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse" />
              
              <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-10 border-2 border-yellow-500/50 shadow-2xl max-w-lg mx-4">
                <motion.div
                  className="absolute -top-8 left-1/2 -translate-x-1/2"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full p-4 shadow-lg shadow-yellow-500/50">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                </motion.div>

                <div className="flex justify-center gap-3 mt-6 mb-4">
                  <motion.div
                    animate={{ rotate: [-15, 15, -15] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <PartyPopper className="w-8 h-8 text-pink-400" />
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >
                    <Sparkles className="w-8 h-8 text-yellow-400" />
                  </motion.div>
                  <motion.div
                    animate={{ rotate: [15, -15, 15] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <PartyPopper className="w-8 h-8 text-cyan-400" />
                  </motion.div>
                </div>

                <motion.h1
                  className="text-3xl font-black text-center bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent mb-2"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  NOVO CONTRATO!
                </motion.h1>

                <p className="text-slate-400 text-center text-sm mb-6">
                  Contrato Recorrente Fechado
                </p>

                <div className="bg-slate-800/50 rounded-2xl p-6 mb-6">
                  <h2 className="text-xl font-bold text-white text-center mb-4 line-clamp-2">
                    {currentDeal.title}
                  </h2>

                  <div className="flex items-center justify-center gap-2 mb-4">
                    <DollarSign className="w-8 h-8 text-green-400" />
                    <motion.span
                      className="text-4xl font-black text-green-400"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.3 }}
                    >
                      {formatCurrency(currentDeal.opportunity)}
                    </motion.span>
                  </div>

                  <p className="text-lg text-center text-slate-300">
                    Fechado por{" "}
                    <span className="font-bold text-cyan-400">
                      {currentDeal.closerName}
                    </span>
                  </p>
                </div>

                <motion.div
                  className="text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <p className="text-slate-500 text-sm">
                    Parabéns pelo excelente trabalho! 🎉
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} 
               title={isConnected ? 'WebSocket conectado' : 'WebSocket desconectado'} />
        </div>
      )}
    </>
  );
}

export function useDealCelebrationTrigger() {
  const triggerTest = async () => {
    try {
      const response = await fetch('/api/deals/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.json();
    } catch (error) {
      console.error('Error triggering test:', error);
      throw error;
    }
  };

  return { triggerTest };
}
