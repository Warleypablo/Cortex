import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Maximize, Minimize, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRelatorioMensal } from "./relatorio-mensal/useRelatorioMensal";
import SlideCapa from "./relatorio-mensal/SlideCapa";
import SlideQRCode from "./relatorio-mensal/SlideQRCode";
import SlideNovosAniversariantes from "./relatorio-mensal/SlideNovosAniversariantes";
import SlideAniversarioEmpresa from "./relatorio-mensal/SlideAniversarioEmpresa";
import SlideKRs from "./relatorio-mensal/SlideKRs";
import SlideTurboCommerce from "./relatorio-mensal/SlideTurboCommerce";
import SlideCapaCommerce from "./relatorio-mensal/SlideCapaCommerce";
import SlideCapaComercial from "./relatorio-mensal/SlideCapaComercial";
import SlideCapaTech from "./relatorio-mensal/SlideCapaTech";
import SlideRankingClosers from "./relatorio-mensal/SlideRankingClosers";
import SlideRankingSDRs from "./relatorio-mensal/SlideRankingSDRs";
import SlideGraficoContratos from "./relatorio-mensal/SlideGraficoContratos";

import SlideTurboMetrics from "./relatorio-mensal/SlideTurboMetrics";
import SlideRankingSquads from "./relatorio-mensal/SlideRankingSquads";
import SlideSquadDetails from "./relatorio-mensal/SlideSquadDetails";
import SlideAreaTech from "./relatorio-mensal/SlideAreaTech";
import SlideNovaSede from "./relatorio-mensal/SlideNovaSede";
import SlideCapaNovoEscritorio from "./relatorio-mensal/SlideCapaNovoEscritorio";
import SlideEncerramento from "./relatorio-mensal/SlideEncerramento";
import SlideFraseEncerramento from "./relatorio-mensal/SlideFraseEncerramento";
import novaSedeEtapa1 from "@assets/nova-sede-etapa-1.jpeg";
import novaSedeEtapa2 from "@assets/nova-sede-etapa-2.jpeg";

const TOTAL_SLIDES = 22;

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function getDefaultMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value: val, label });
  }
  return options;
}

export default function RelatorioMensal() {
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const monthOptions = getMonthOptions();

  const [ano, mes] = selectedMonth.split("-").map(Number);

  const { data, isLoading, error } = useRelatorioMensal(selectedMonth);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentSlide((s) => Math.max(s - 1, 0));
      } else if (e.key === "Escape") {
        setIsPresentationMode(false);
      } else if (e.key === "Home") {
        setCurrentSlide(0);
      } else if (e.key === "End") {
        setCurrentSlide(TOTAL_SLIDES - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fullscreen API for presentation mode
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsPresentationMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const enterPresentation = useCallback(() => {
    setIsPresentationMode(true);
    presentationRef.current?.requestFullscreen?.().catch(() => {
      // Fallscreen not available, still show presentation mode
    });
  }, []);

  const exitPresentation = useCallback(() => {
    setIsPresentationMode(false);
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, []);

  const exportPdf = useCallback(async () => {
    if (!slideRef.current || !data) return;
    setIsExporting(true);

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const prevSlide = currentSlide;

      for (let i = 0; i < TOTAL_SLIDES; i++) {
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 400));

        const canvas = await html2canvas(slideRef.current!, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#09090b",
          logging: false,
        });

        if (i > 0) pdf.addPage();
        const imgRatio = canvas.height / canvas.width;
        const imgH = pageW * imgRatio;
        const yOff = Math.max(0, (pageH - imgH) / 2);
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, yOff, pageW, Math.min(imgH, pageH));
      }

      pdf.save(`reporte-mensal-${selectedMonth}.pdf`);
      setCurrentSlide(prevSlide);
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
    } finally {
      setIsExporting(false);
    }
  }, [data, currentSlide, selectedMonth]);

  const slideNames = [
    "Capa", "Q&A", "Novos & Aniversários", "Aniv. Empresa",
    "KRs", "Capa Comercial", "Ranking Closers",
    "Ranking SDRs", "Contratos", "Capa Commerce", "Commerce", "Turbo Metrics", "Ranking Squads", "Squad Details",
    "Capa Tech", "Area Tech", "Capa Novo Escritório", "Sede Gazeta 1ª Etapa", "Sede Gazeta 2ª Etapa",
    "Vamos com Turbo!", "Frase", "Q&A"
  ];

  const renderSlide = () => {
    if (!data) return null;
    switch (currentSlide) {
      case 0: return <SlideCapa mesLabel={data.mesLabel} />;
      case 1: return <SlideQRCode />;
      case 2: return <SlideNovosAniversariantes novos={data.novosColaboradores} aniversariantes={data.aniversariantes} mesLabel={data.mesLabel} />;
      case 3: return <SlideAniversarioEmpresa aniversarios={data.aniversariosEmpresa} />;
      case 4: return <SlideKRs objectives={data.okrObjectives} />;
      case 5: return <SlideCapaComercial />;
      case 6: return <SlideRankingClosers ranking={data.rankingClosers} topPontual={data.topPontual} />;
      case 7: return <SlideRankingSDRs ranking={data.rankingSDRs} topReunioes={data.topReunioes} />;
      case 8: return <SlideGraficoContratos dados={data.contratosMes} mesLabel={data.mesDadosLabel} />;
      case 9: return <SlideCapaCommerce />;
      case 10: return <SlideTurboCommerce ano={ano} mes={mes} okrObjectives={data.okrObjectives} mrrAtivo={data.turboMetrics.mrrAtivo} />;
      case 11: return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 12: return <SlideRankingSquads ranking={data.rankingSquads} />;
      case 13: return <SlideSquadDetails details={data.squadDetails} mesLabel={data.mesDadosLabel} />;
      case 14: return <SlideCapaTech />;
      case 15: return <SlideAreaTech techData={data.techData} mesLabel={data.mesDadosLabel} />;
      case 16: return <SlideCapaNovoEscritorio />;
      case 17: return <SlideNovaSede imageSrc={novaSedeEtapa1} titulo="Nova Sede Gazeta — 1ª Etapa" subtitulo="Organização de espaços Fonte Hub (com saída Takeat - 15/03) • Até 71 posições" />;
      case 18: return <SlideNovaSede imageSrc={novaSedeEtapa2} titulo="Nova Sede Gazeta — 2ª Etapa" subtitulo="Organização de espaços Fonte Hub (com saída AEP - 01/05) • 98 posições" />;
      case 19: return <SlideEncerramento />;
      case 20: return <SlideFraseEncerramento />;
      case 21: return <SlideQRCode />;
      default: return null;
    }
  };

  // Presentation mode (fullscreen, click to advance)
  if (isPresentationMode && data) {
    return (
      <div
        ref={presentationRef}
        className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center cursor-pointer"
        onClick={(e) => {
          // Click left half = back, right half = forward
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width * 0.3) {
            setCurrentSlide((s) => Math.max(s - 1, 0));
          } else {
            setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
          }
        }}
      >
        {/* Slide fullscreen */}
        <div ref={slideRef} className="w-full h-full">
          {renderSlide()}
        </div>

        {/* Minimal bottom bar (appears on hover) */}
        <div className="absolute bottom-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center justify-center gap-3 py-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentSlide ? "bg-white w-6" : "bg-white/30 w-1.5 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
            <span className="text-white/50 text-xs ml-3">
              {currentSlide + 1}/{TOTAL_SLIDES}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); exitPresentation(); }}
              className="text-white/50 hover:text-white ml-4"
            >
              <Minimize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-foreground">Reporte Mensal</h1>
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setCurrentSlide(0); }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={enterPresentation} disabled={!data || isLoading}>
            <Play className="h-4 w-4 mr-1" /> Apresentar
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={isExporting || isLoading}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            {isExporting ? "Exportando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* Slide area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 relative">
        {isLoading ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando dados...
          </div>
        ) : error ? (
          <div className="text-red-500">Erro ao carregar dados: {(error as Error).message}</div>
        ) : data ? (
          <>
            {/* Slide container */}
            <div
              ref={slideRef}
              className="w-full max-w-5xl aspect-[16/9] rounded-xl overflow-hidden shadow-2xl border border-zinc-800 relative"
            >
              {renderSlide()}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-4 mt-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentSlide((s) => Math.max(s - 1, 0))}
                disabled={currentSlide === 0}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === currentSlide ? "bg-primary w-6" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    title={slideNames[i]}
                  />
                ))}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1))}
                disabled={currentSlide === TOTAL_SLIDES - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              <span className="text-xs text-muted-foreground ml-2">
                {currentSlide + 1}/{TOTAL_SLIDES} - {slideNames[currentSlide]}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
