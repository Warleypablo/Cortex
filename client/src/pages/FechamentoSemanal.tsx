import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import turboLogo from "@assets/logo-branca.png";

import SlideCapaSemana from "@/components/fechamento-semanal/SlideCapaSemana";
import SlideMRR from "@/components/fechamento-semanal/SlideMRR";
import SlideChurn from "@/components/fechamento-semanal/SlideChurn";
import SlideInadimplencia from "@/components/fechamento-semanal/SlideInadimplencia";
import SlideRankingClosers from "@/components/fechamento-semanal/SlideRankingClosers";
import SlideRankingSDRs from "@/components/fechamento-semanal/SlideRankingSDRs";
import SlideNovosContratos from "@/components/fechamento-semanal/SlideNovosContratos";
import SlideSaudeSquads from "@/components/fechamento-semanal/SlideSaudeSquads";

export interface SlideProps {
  semanaInicio: string;
  semanaFim: string;
}

const SLIDES = [
  { id: "capa", label: "Capa", component: SlideCapaSemana },
  { id: "mrr", label: "MRR", component: SlideMRR },
  { id: "churn", label: "Churn", component: SlideChurn },
  { id: "inadimplencia", label: "Inadimplência", component: SlideInadimplencia },
  { id: "closers", label: "Closers", component: SlideRankingClosers },
  { id: "sdrs", label: "SDRs", component: SlideRankingSDRs },
  { id: "novos", label: "Novos Contratos", component: SlideNovosContratos },
  { id: "squads", label: "Squads", component: SlideSaudeSquads },
];

export default function FechamentoSemanal() {
  usePageTitle("Fechamento Semanal");

  const [baseDate, setBaseDate] = useState(() => new Date());
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPresenting, setIsPresenting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const semanaInicio = format(
    startOfWeek(baseDate, { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const semanaFim = format(
    endOfWeek(baseDate, { weekStartsOn: 1 }),
    "yyyy-MM-dd"
  );
  const semanaLabel = `${format(startOfWeek(baseDate, { weekStartsOn: 1 }), "dd MMM", { locale: ptBR })} – ${format(endOfWeek(baseDate, { weekStartsOn: 1 }), "dd MMM yyyy", { locale: ptBR })}`;

  const goNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setDirection(1);
      setCurrentSlide((s) => s + 1);
    }
  }, [currentSlide]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((s) => s - 1);
    }
  }, [currentSlide]);

  const enterPresentation = () => {
    setIsPresenting(true);
    containerRef.current?.requestFullscreen?.();
  };

  const exitPresentation = () => {
    setIsPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPresenting) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") exitPresentation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPresenting, goNext, goPrev]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setIsPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const slideProps: SlideProps = { semanaInicio, semanaFim };
  const CurrentSlideComponent = SLIDES[currentSlide].component;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  if (!isPresenting) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Fechamento Semanal</h1>
              <p className="text-zinc-400 mt-1">Selecione a semana e inicie a apresentação</p>
            </div>
            <img src={turboLogo} alt="Turbo" className="h-8 opacity-80" />
          </div>

          {/* Seletor de semana */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-3">Semana selecionada</p>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={() => setBaseDate((d) => subWeeks(d, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-semibold flex-1 text-center">{semanaLabel}</span>
              <Button
                variant="outline"
                size="icon"
                className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                onClick={() => setBaseDate((d) => addWeeks(d, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de slides */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-4">Slides ({SLIDES.length})</p>
            <div className="grid grid-cols-2 gap-2">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { setCurrentSlide(i); setIsPresenting(true); containerRef.current?.requestFullscreen?.(); }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                >
                  <span className="text-zinc-500 text-sm w-5">{i + 1}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-6 text-lg rounded-xl"
            onClick={() => { setCurrentSlide(0); enterPresentation(); }}
          >
            <Play className="h-5 w-5 mr-2" />
            Apresentar
          </Button>
        </div>
      </div>
    );
  }

  // Modo apresentação
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-zinc-950 text-white overflow-hidden select-none"
      style={{ zIndex: 9999 }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 py-4 bg-gradient-to-b from-zinc-950/80 to-transparent">
        <span className="text-zinc-400 text-sm font-medium">{semanaLabel}</span>
        <img src={turboLogo} alt="Turbo" className="h-7 opacity-70" />
        <button
          onClick={exitPresentation}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Slide content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <CurrentSlideComponent {...slideProps} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Botões de navegação laterais */}
      {currentSlide > 0 && (
        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800/60 hover:bg-zinc-700 text-white transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {currentSlide < SLIDES.length - 1 && (
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800/60 hover:bg-zinc-700 text-white transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Barra de progresso inferior */}
      <div className="absolute bottom-6 left-0 right-0 z-10 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => { setDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentSlide ? "bg-white w-6" : "bg-zinc-600 hover:bg-zinc-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
