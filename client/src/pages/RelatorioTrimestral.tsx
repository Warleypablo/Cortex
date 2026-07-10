import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Minimize, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRelatorioTrimestral } from "./relatorio-trimestral/useRelatorioTrimestral";
import { getTrimestreOptions, getDefaultTrimestre } from "./relatorio-trimestral/trimestre-options";
import SlideCapaTrimestre from "./relatorio-trimestral/SlideCapaTrimestre";
import SlideCapaSecao from "./relatorio-trimestral/SlideCapaSecao";
import SlideMantra from "./relatorio-trimestral/SlideMantra";
import SlideQrTrimestre from "./relatorio-trimestral/SlideQrTrimestre";
import SlideVendasTrimestre from "./relatorio-trimestral/SlideVendasTrimestre";
import SlideVisaoTrimestre from "./relatorio-trimestral/SlideVisaoTrimestre";
import SlideVisaoPontualTrimestre from "./relatorio-trimestral/SlideVisaoPontualTrimestre";
import SlideClosersTrimestre from "./relatorio-trimestral/SlideClosersTrimestre";
import SlideSdrsTrimestre from "./relatorio-trimestral/SlideSdrsTrimestre";
import SlideTurboTrimestre from "./relatorio-trimestral/SlideTurboTrimestre";
import SlideOperadoresSquadTrimestre from "./relatorio-trimestral/SlideOperadoresSquadTrimestre";
import SlideSquadTrimestre from "./relatorio-trimestral/SlideSquadTrimestre";
import SlidePontualTrimestre from "./relatorio-trimestral/SlidePontualTrimestre";
import SlideTechTrimestre from "./relatorio-trimestral/SlideTechTrimestre";
import SlideTechPipelineTrimestre from "./relatorio-trimestral/SlideTechPipelineTrimestre";
import SlideNpsTrimestre from "./relatorio-trimestral/SlideNpsTrimestre";
import SlideFaturadoTrimestre from "./relatorio-trimestral/SlideFaturadoTrimestre";
import SlideEncerramentoTrimestre from "./relatorio-trimestral/SlideEncerramentoTrimestre";
import SlideEvolucaoTrimestre from "./relatorio-trimestral/SlideEvolucaoTrimestre";
import SlidePremiacaoTrimestre from "./relatorio-trimestral/SlidePremiacaoTrimestre";

const SLIDE_BASE_W = 1280;
const SLIDE_BASE_H = 720;

// Slides de tópico da seção Premiações: só a categoria — os nomes dos premiados
// são citados no palco, não vão para a tela.
const PREMIACOES: ReadonlyArray<{ titulo: string; subtitulo?: string }> = [
  { titulo: "Guardiões da Cultura" },
  { titulo: "Destaques", subtitulo: "Colaboradores" },
  { titulo: "Destaques", subtitulo: "Líderes" },
  { titulo: "Colaborador Turbinado" },
];

type TrimSlot =
  | { type: "mantra" } | { type: "qr" } | { type: "capa" } | { type: "visao" } | { type: "visao-pontual" } | { type: "vendas" } | { type: "evolucao" }
  | { type: "capa-comercial" } | { type: "capa-operacao" } | { type: "capa-tech" } | { type: "capa-premiacoes" }
  | { type: "closers" } | { type: "sdrs" } | { type: "turbo" } | { type: "squads-ranking" }
  | { type: "squad"; squadIndex: number } | { type: "pontual" } | { type: "tech" } | { type: "tech-pipeline" }
  | { type: "nps" } | { type: "faturamento" } | { type: "premiacao"; premiacaoIndex: number }
  | { type: "encerramento" } | { type: "qa" };

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
    // Abertura executiva → COMERCIAL → OPERAÇÃO → TECH → financeiro → ritual de fechamento → Q&A
    // O QR entra logo após o Mantra: a plateia escaneia cedo e manda perguntas
    // durante o reporte; o slide de Q&A no fim é onde elas são respondidas.
    const abertura: TrimSlot[] = [
      { type: "mantra" }, { type: "qr" }, { type: "capa" }, { type: "visao" }, { type: "visao-pontual" }, { type: "evolucao" },
    ];
    const comercial: TrimSlot[] = [
      { type: "capa-comercial" }, { type: "vendas" }, { type: "closers" }, { type: "sdrs" },
    ];
    const squads: TrimSlot[] = (data?.squadDetails ?? []).map((_, i) => ({ type: "squad", squadIndex: i }));
    const operacao: TrimSlot[] = [
      { type: "capa-operacao" }, { type: "turbo" }, { type: "squads-ranking" }, ...squads,
      { type: "pontual" }, { type: "nps" },
    ];
    const tech: TrimSlot[] = [{ type: "capa-tech" }, { type: "tech" }, { type: "tech-pipeline" }];
    // Premiações celebram o time depois que os números fecham, e antes do ritual
    // de encerramento — o Q&A segue por último, que é pra onde o QR da abertura aponta.
    const premiacoes: TrimSlot[] = [
      { type: "capa-premiacoes" },
      ...PREMIACOES.map((_, i): TrimSlot => ({ type: "premiacao", premiacaoIndex: i })),
    ];
    const fechamento: TrimSlot[] = [
      { type: "faturamento" }, ...premiacoes, { type: "encerramento" }, { type: "qa" },
    ];
    return [...abertura, ...comercial, ...operacao, ...tech, ...fechamento];
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
        // 1600ms: espera as animações de entrada + count-ups (a linha de 4 tiles do
        // Visão termina ~1,5s) antes do screenshot — senão o PDF captura pela metade.
        await new Promise((r) => setTimeout(r, 1600));
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
      case "qr":           return <SlideQrTrimestre variant="abertura" />;
      case "capa":         return <SlideCapaTrimestre data={data} />;
      case "capa-comercial": return <SlideCapaSecao numero="01" titulo="Comercial" subtitulo="Contratos fechados · Ranking closers" accent="#38bdf8" accentSoft="rgba(56,189,248,0.12)" label={data.label} />;
      case "capa-operacao":  return <SlideCapaSecao numero="02" titulo="Operação" subtitulo="Turbo Commerce · Squads · Pontual · NPS" accent="#34d399" accentSoft="rgba(52,211,153,0.12)" label={data.label} />;
      case "capa-tech":      return <SlideCapaSecao numero="03" titulo="Tech" subtitulo="Projetos · Receita · Pipeline" accent="#a78bfa" accentSoft="rgba(167,139,250,0.12)" label={data.label} />;
      case "capa-premiacoes": return <SlideCapaSecao numero="04" titulo="Premiações" subtitulo="Guardiões da Cultura · Destaques · Colaborador Turbinado" accent="#fbbf24" accentSoft="rgba(251,191,36,0.12)" label={data.label} />;
      case "visao":        return <SlideVisaoTrimestre data={data} />;
      case "visao-pontual": return <SlideVisaoPontualTrimestre data={data} />;
      case "vendas":       return <SlideVendasTrimestre dados={data.contratosMes} label={data.label} qoqVendas={data.trend.qoq.vendas} />;
      case "evolucao":     return <SlideEvolucaoTrimestre trend={data.trend} />;
      case "closers":      return <SlideClosersTrimestre ranking={data.rankingClosers} topPontual={data.topPontual} label={data.label} />;
      case "sdrs":         return <SlideSdrsTrimestre ranking={data.rankingSDRs} topReunioes={data.topReunioes} label={data.label} />;
      case "turbo":        return <SlideTurboTrimestre metrics={data.turboMetrics} label={data.label} />;
      case "squads-ranking": return <SlideOperadoresSquadTrimestre squads={data.operadoresPorSquad} label={data.label} />;
      case "squad":        return <SlideSquadTrimestre details={data.squadDetails.slice(0, slot.squadIndex + 1)} mesLabel={data.label} />;
      case "pontual":      return <SlidePontualTrimestre pontualData={data.pontualData} label={data.label} />;
      case "tech":         return <SlideTechTrimestre techData={data.techData} label={data.label} />;
      case "tech-pipeline": return <SlideTechPipelineTrimestre pipeline={data.techPipeline} label={data.label} />;
      case "nps":          return <SlideNpsTrimestre label={data.label} />;
      case "faturamento":  return <SlideFaturadoTrimestre faturado={data.faturado} label={data.label} />;
      case "premiacao": {
        const p = PREMIACOES[slot.premiacaoIndex];
        if (!p) return null;
        return <SlidePremiacaoTrimestre titulo={p.titulo} subtitulo={p.subtitulo} indice={slot.premiacaoIndex + 1} total={PREMIACOES.length} label={data.label} />;
      }
      case "encerramento": return <SlideEncerramentoTrimestre label={data.label} />;
      case "qa":           return <SlideQrTrimestre variant="qa" />;
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
