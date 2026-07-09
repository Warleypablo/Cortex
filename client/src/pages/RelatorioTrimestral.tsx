import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Minimize, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRelatorioTrimestral } from "./relatorio-trimestral/useRelatorioTrimestral";
import { getTrimestreOptions, getDefaultTrimestre } from "./relatorio-trimestral/trimestre-options";
import SlideCapaTrimestre from "./relatorio-trimestral/SlideCapaTrimestre";
import SlideMantra from "./relatorio-trimestral/SlideMantra";
import SlideRankingClosers from "./relatorio-mensal/SlideRankingClosers";
import SlideTurboMetrics from "./relatorio-mensal/SlideTurboMetrics";
import SlideRankingSquads from "./relatorio-mensal/SlideRankingSquads";
import SlideSquadSingle from "./relatorio-mensal/SlideSquadSingle";
import SlidePontual from "./relatorio-mensal/SlidePontual";
import SlideAreaTech from "./relatorio-mensal/SlideAreaTech";
import SlideNPS from "./relatorio-mensal/SlideNPS";
import SlideFaturamentoYtd from "./relatorio-mensal/SlideFaturamentoYtd";
import SlideGraficoContratos from "./relatorio-mensal/SlideGraficoContratos";
import SlideFraseEncerramento from "./relatorio-mensal/SlideFraseEncerramento";
import SlideVisaoTrimestre from "./relatorio-trimestral/SlideVisaoTrimestre";
import SlideEvolucaoTrimestre from "./relatorio-trimestral/SlideEvolucaoTrimestre";

const SLIDE_BASE_W = 1280;
const SLIDE_BASE_H = 720;

type TrimSlot =
  | { type: "mantra" } | { type: "capa" } | { type: "visao" } | { type: "vendas" } | { type: "evolucao" }
  | { type: "closers" } | { type: "turbo" } | { type: "squads-ranking" }
  | { type: "squad"; squadIndex: number } | { type: "pontual" } | { type: "tech" }
  | { type: "nps" } | { type: "faturamento" } | { type: "encerramento" };

function useSlideScale(containerRef: React.RefObject<HTMLDivElement | null>, enabled: boolean, reservedHeight = 0) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!enabled) { setScale(1); return; }
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight - reservedHeight;
      setScale(Math.min(vw / SLIDE_BASE_W, vh / SLIDE_BASE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, enabled, reservedHeight]);
  return scale;
}

export default function RelatorioTrimestral() {
  const [selectedTri, setSelectedTri] = useState(() => getDefaultTrimestre(new Date()));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const triOptions = useMemo(() => getTrimestreOptions(new Date(), 6), []);

  const presentationScale = useSlideScale(presentationRef, isPresentationMode);
  const editorScale = useSlideScale(slideAreaRef, !isPresentationMode, 60);

  const { data, isLoading, error } = useRelatorioTrimestral(selectedTri);

  const slots = useMemo<TrimSlot[]>(() => {
    const base: TrimSlot[] = [
      { type: "mantra" }, { type: "capa" }, { type: "visao" }, { type: "vendas" }, { type: "evolucao" },
      { type: "closers" }, { type: "turbo" }, { type: "squads-ranking" },
    ];
    const squads: TrimSlot[] = (data?.squadDetails ?? []).map((_, i) => ({ type: "squad", squadIndex: i }));
    const tail: TrimSlot[] = [
      { type: "pontual" }, { type: "tech" }, { type: "nps" }, { type: "faturamento" }, { type: "encerramento" },
    ];
    return [...base, ...squads, ...tail];
  }, [data]);
  const totalSlides = slots.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1)); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setCurrentSlide((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Escape") setIsPresentationMode(false);
      else if (e.key === "Home") setCurrentSlide(0);
      else if (e.key === "End") setCurrentSlide(totalSlides - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalSlides]);

  useEffect(() => { setCurrentSlide((s) => Math.min(s, Math.max(totalSlides - 1, 0))); }, [totalSlides]);

  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setIsPresentationMode(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    if (isPresentationMode && presentationRef.current) {
      presentationRef.current.requestFullscreen?.().catch(() => {});
    }
  }, [isPresentationMode]);

  const exportPdf = useCallback(async () => {
    if (!slideRef.current || !data) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const prev = currentSlide;
      for (let i = 0; i < totalSlides; i++) {
        setCurrentSlide(i);
        // 1200ms: espera as animações de entrada (stagger ~1s no Visão do Trimestre)
        // terminarem antes do screenshot — senão o PDF captura tiles semi-transparentes.
        await new Promise((r) => setTimeout(r, 1200));
        const canvas = await html2canvas(slideRef.current!, { scale: 2, useCORS: true, backgroundColor: "#09090b", logging: false });
        if (i > 0) pdf.addPage();
        const imgH = pageW * (canvas.height / canvas.width);
        const yOff = Math.max(0, (pageH - imgH) / 2);
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, yOff, pageW, Math.min(imgH, pageH));
      }
      pdf.save(`reporte-trimestral-${selectedTri}.pdf`);
      setCurrentSlide(prev);
    } catch (err) { console.error("Erro ao exportar PDF:", err); }
    finally { setIsExporting(false); }
  }, [data, currentSlide, selectedTri, totalSlides]);

  const renderSlide = () => {
    if (!data) return null;
    const slot = slots[currentSlide];
    if (!slot) return null;
    switch (slot.type) {
      case "mantra":       return <SlideMantra />;
      case "capa":         return <SlideCapaTrimestre data={data} />;
      case "visao":        return <SlideVisaoTrimestre data={data} />;
      case "vendas":       return <SlideGraficoContratos dados={data.contratosMes} mesLabel={data.label} />;
      case "evolucao":     return <SlideEvolucaoTrimestre trend={data.trend} />;
      case "closers":      return <SlideRankingClosers ranking={data.rankingClosers} topPontual={data.topPontual} />;
      case "turbo":        return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.label} chartMode="quarter" />;
      case "squads-ranking": return <SlideRankingSquads ranking={data.rankingSquads} />;
      case "squad":        return <SlideSquadSingle details={data.squadDetails.slice(0, slot.squadIndex + 1)} mesLabel={data.label} />;
      case "pontual":      return <SlidePontual pontualData={data.pontualData} mesLabel={data.label} />;
      case "tech":         return <SlideAreaTech techData={data.techData} mesLabel={data.label} />;
      case "nps":          return <SlideNPS mesLabel={data.label} />;
      case "faturamento":  return <SlideFaturamentoYtd data={data.faturamentoYtd} mesLabel={data.label} />;
      case "encerramento": return <SlideFraseEncerramento />;
      default:             return null;
    }
  };

  if (isPresentationMode && data) {
    return (
      <div ref={presentationRef} className="fixed inset-0 z-50 bg-black flex items-center justify-center cursor-pointer"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (e.clientX - rect.left < rect.width * 0.3) setCurrentSlide((s) => Math.max(s - 1, 0));
          else setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1));
        }}>
        <div ref={slideRef} className="overflow-hidden relative"
          style={{ width: SLIDE_BASE_W, height: SLIDE_BASE_H, transform: `scale(${presentationScale})`, transformOrigin: "center center" }}>
          {/* key remonta o slide a cada troca → transição de entrada */}
          <div key={`${selectedTri}-${currentSlide}`} className="w-full h-full animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none">
            {renderSlide()}
          </div>
          {!isExporting && (
            <div
              className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300 z-20"
              style={{ width: `${((currentSlide + 1) / Math.max(totalSlides, 1)) * 100}%` }}
            />
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center gap-3 py-3 bg-gradient-to-t from-black/80 to-transparent">
            <span className="text-white/50 text-xs">{currentSlide + 1}/{totalSlides}</span>
            <button onClick={(e) => { e.stopPropagation(); setIsPresentationMode(false); if (document.fullscreenElement) document.exitFullscreen?.(); }} className="text-white/50 hover:text-white ml-4">
              <Minimize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-foreground">Reporte Trimestral</h1>
          <Select value={selectedTri} onValueChange={(v) => { setSelectedTri(v); setCurrentSlide(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {triOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}{data?.parcial && o.value === selectedTri ? " *" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data?.parcial && (
            <span className="text-xs text-amber-500 font-medium">
              * Trimestre em andamento — parcial (meses: {data.mesesComputados.join(", ")})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPresentationMode(true)} disabled={!data || isLoading}>
            <Play className="h-4 w-4 mr-1" /> Apresentar
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={isExporting || isLoading}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {isExporting ? "Exportando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      <div ref={slideAreaRef} className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 relative">
        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /> Carregando dados...</div>
        ) : error ? (
          <div className="text-red-500">Erro ao carregar dados: {(error as Error).message}</div>
        ) : data ? (
          <>
            <div ref={slideRef} className="rounded-xl overflow-hidden shadow-2xl border border-zinc-800 relative"
              style={{ width: SLIDE_BASE_W, height: SLIDE_BASE_H, transform: `scale(${editorScale})`, transformOrigin: "center center" }}>
              {/* key remonta o slide a cada troca → transição de entrada */}
              <div key={`${selectedTri}-${currentSlide}`} className="w-full h-full animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none">
                {renderSlide()}
              </div>
              {!isExporting && (
                <div
                  className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300 z-20"
                  style={{ width: `${((currentSlide + 1) / Math.max(totalSlides, 1)) * 100}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-4 mt-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentSlide((s) => Math.max(s - 1, 0))} disabled={currentSlide === 0}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-1.5">
                {slots.map((_, i) => (
                  <button key={i} onClick={() => setCurrentSlide(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentSlide ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`} />
                ))}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1))} disabled={currentSlide === totalSlides - 1}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <span className="text-xs text-muted-foreground ml-2">{currentSlide + 1}/{totalSlides}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
