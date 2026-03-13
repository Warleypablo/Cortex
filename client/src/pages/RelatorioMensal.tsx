import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Minimize, Play, Plus, Trash2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRelatorioMensal } from "./relatorio-mensal/useRelatorioMensal";
import { useCustomSlides, type CustomSlide } from "./relatorio-mensal/useCustomSlides";
import { useUpload } from "@/hooks/use-upload";
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
import SlideCustom from "./relatorio-mensal/SlideCustom";
import novaSedeEtapa1 from "@assets/nova-sede-etapa-1.jpeg";
import novaSedeEtapa2 from "@assets/nova-sede-etapa-2.jpeg";

const FIXED_SLIDE_NAMES = [
  "Capa", "Q&A", "Novos & Aniversários", "Aniv. Empresa",
  "KRs", "Capa Comercial", "Ranking Closers",
  "Ranking SDRs", "Contratos", "Capa Commerce", "Turbo Metrics", "Commerce", "Ranking Squads", "Squad Details",
  "Capa Tech", "Area Tech", "Capa Novo Escritório", "Sede Gazeta 1ª Etapa", "Sede Gazeta 2ª Etapa",
  "Vamos com Turbo!", "Frase", "Q&A"
];

const STATIC_SLIDES = FIXED_SLIDE_NAMES.length; // 22

type SlotEntry = { type: "fixed"; fixedIndex: number; name: string } | { type: "custom"; data: CustomSlide };

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

function buildSlotArray(customSlides: CustomSlide[]): SlotEntry[] {
  const slots: SlotEntry[] = [];
  for (let i = 0; i < STATIC_SLIDES; i++) {
    slots.push({ type: "fixed", fixedIndex: i, name: FIXED_SLIDE_NAMES[i] });
    // Insert custom slides that go after fixed slide i
    const customs = customSlides
      .filter((c) => c.posicao === i)
      .sort((a, b) => a.ordem - b.ordem);
    for (const c of customs) {
      slots.push({ type: "custom", data: c });
    }
  }
  return slots;
}

export default function RelatorioMensal() {
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newPosition, setNewPosition] = useState("0");
  const [newImageUrl, setNewImageUrl] = useState("");
  const slideRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const monthOptions = getMonthOptions();

  const [ano, mes] = selectedMonth.split("-").map(Number);

  const { data, isLoading, error } = useRelatorioMensal(selectedMonth);
  const { customSlides, createSlide, deleteSlide } = useCustomSlides(selectedMonth);
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => setNewImageUrl(response.objectPath),
  });

  const slots = useMemo(() => buildSlotArray(customSlides), [customSlides]);
  const totalSlides = slots.length;

  const slideNames = useMemo(
    () => slots.map((s) => s.type === "fixed" ? s.name : (s.data.titulo || "Slide Custom")),
    [slots]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentSlide((s) => Math.max(s - 1, 0));
      } else if (e.key === "Escape") {
        setIsPresentationMode(false);
      } else if (e.key === "Home") {
        setCurrentSlide(0);
      } else if (e.key === "End") {
        setCurrentSlide(totalSlides - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalSlides]);

  // Clamp currentSlide when totalSlides changes
  useEffect(() => {
    setCurrentSlide((s) => Math.min(s, Math.max(totalSlides - 1, 0)));
  }, [totalSlides]);

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
      // Fullscreen not available, still show presentation mode
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

      for (let i = 0; i < totalSlides; i++) {
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
  }, [data, currentSlide, selectedMonth, totalSlides]);

  const renderFixedSlide = (fixedIndex: number) => {
    if (!data) return null;
    switch (fixedIndex) {
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
      case 10: return <SlideTurboMetrics metrics={data.turboMetrics} mesLabel={data.mesDadosLabel} />;
      case 11: return <SlideTurboCommerce ano={ano} mes={mes} okrObjectives={data.okrObjectives} mrrAtivo={data.turboMetrics.mrrAtivo} pontualCommerceQtr={data.turboMetrics.pontualCommerceQtr} />;
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

  const renderSlide = () => {
    if (!data) return null;
    const slot = slots[currentSlide];
    if (!slot) return null;
    if (slot.type === "fixed") {
      return renderFixedSlide(slot.fixedIndex);
    }
    return (
      <SlideCustom
        titulo={slot.data.titulo ?? undefined}
        subtitulo={slot.data.subtitulo ?? undefined}
        imageUrl={slot.data.image_url ?? undefined}
      />
    );
  };

  const currentSlotIsCustom = slots[currentSlide]?.type === "custom";
  const currentCustomId = currentSlotIsCustom ? (slots[currentSlide] as { type: "custom"; data: CustomSlide }).data.id : null;

  const handleCreateSlide = async () => {
    if (!newTitle && !newImageUrl) return;
    await createSlide.mutateAsync({
      mes_ano: selectedMonth,
      posicao: parseInt(newPosition),
      titulo: newTitle || undefined,
      subtitulo: newSubtitle || undefined,
      image_url: newImageUrl || undefined,
    });
    setDialogOpen(false);
    setNewTitle("");
    setNewSubtitle("");
    setNewPosition("0");
    setNewImageUrl("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  // Presentation mode (fullscreen, click to advance)
  if (isPresentationMode && data) {
    return (
      <div
        ref={presentationRef}
        className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center cursor-pointer"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width * 0.3) {
            setCurrentSlide((s) => Math.max(s - 1, 0));
          } else {
            setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1));
          }
        }}
      >
        <div ref={slideRef} className="w-full h-full">
          {renderSlide()}
        </div>

        <div className="absolute bottom-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center justify-center gap-3 py-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-1.5">
              {slots.map((slot, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentSlide(i); }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentSlide
                      ? "bg-white w-6"
                      : slot.type === "custom"
                        ? "bg-blue-400/50 w-1.5 hover:bg-blue-400/80"
                        : "bg-white/30 w-1.5 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
            <span className="text-white/50 text-xs ml-3">
              {currentSlide + 1}/{totalSlides}
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
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} disabled={!data || isLoading}>
            <Plus className="h-4 w-4 mr-1" /> Slide
          </Button>
          {currentSlotIsCustom && currentCustomId && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => deleteSlide.mutate(currentCustomId)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
          )}
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
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === currentSlide
                        ? "bg-primary w-6"
                        : slot.type === "custom"
                          ? "bg-blue-400/40 hover:bg-blue-400/60"
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    title={slideNames[i]}
                  />
                ))}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1))}
                disabled={currentSlide === totalSlides - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              <span className="text-xs text-muted-foreground ml-2">
                {currentSlide + 1}/{totalSlides} - {slideNames[currentSlide]}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {/* Dialog para criar custom slide */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Slide Customizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Inserir depois de</Label>
              <Select value={newPosition} onValueChange={setNewPosition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIXED_SLIDE_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{i + 1}. {name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titulo do slide" />
            </div>
            <div className="space-y-2">
              <Label>Subtitulo</Label>
              <Input value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} placeholder="Subtitulo (opcional)" />
            </div>
            <div className="space-y-2">
              <Label>Imagem</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
                  {isUploading ? "Enviando..." : "Upload"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {newImageUrl && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{newImageUrl}</span>
                )}
              </div>
              {newImageUrl && (
                <img src={newImageUrl} alt="Preview" className="mt-2 rounded-lg max-h-32 object-contain" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSlide} disabled={createSlide.isPending || (!newTitle && !newImageUrl)}>
              {createSlide.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
