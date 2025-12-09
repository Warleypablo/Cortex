import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X, ArrowUpDown, TrendingUp, Rocket } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const mockData = [
  { id: 1, anuncio: "1386 - [ASS] - [VENDA ATIVA] - [VID] - Conversão", status: "Ativo", plataforma: "Facebook", produto: "Assessoria", estrategia: "Conversão", investimento: 465895, impressoes: 10511987, frequencia: 1.25, cpm: 44, ctr: 0.96, cliques: 100827, cliquesLeads: 0.74, leads: 74, leadMql: 59, mql: 44, cpmql: 10580, mqlRm: 2, rm: 1, mqlRr: 5, rr: 2 },
  { id: 2, anuncio: "1129 - [ASS] - [FLÁVIO AUGUSTO] - [VID] - Awareness", status: "Ativo", plataforma: "Facebook", produto: "Assessoria", estrategia: "Awareness", investimento: 184043, impressoes: 4039876, frequencia: 1.19, cpm: 46, ctr: 0.66, cliques: 26822, cliquesLeads: 0.49, leads: 131, leadMql: 59, mql: 77, cpmql: 2357, mqlRm: 0, rm: 0, mqlRr: 16, rr: 12 },
  { id: 3, anuncio: "483 - VIDEO - BRENDA - FRASE - AGÊNCIA", status: "Ativo", plataforma: "Instagram", produto: "Consultoria", estrategia: "Conversão", investimento: 135967, impressoes: 3132904, frequencia: 1.19, cpm: 43, ctr: 0.60, cliques: 18730, cliquesLeads: 0.20, leads: 37, leadMql: 65, mql: 24, cpmql: 4981, mqlRm: 4, rm: 1, mqlRr: 25, rr: 6 },
  { id: 4, anuncio: "1114 - [ASS] - [FLÁVIO AUGUSTO] - [VID] - Lead Gen", status: "Pausado", plataforma: "Facebook", produto: "Assessoria", estrategia: "Lead Gen", investimento: 16281, impressoes: 409180, frequencia: 1.13, cpm: 40, ctr: 0.60, cliques: 2462, cliquesLeads: 0.04, leads: 1, leadMql: 100, mql: 1, cpmql: 15947, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 5, anuncio: "634 - VIDEO - FERNANDO MIRANDA - Depoimento", status: "Ativo", plataforma: "Instagram", produto: "Consultoria", estrategia: "Awareness", investimento: 15283, impressoes: 325070, frequencia: 1.07, cpm: 47, ctr: 0.61, cliques: 1974, cliquesLeads: 0.61, leads: 12, leadMql: 100, mql: 12, cpmql: 1274, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 6, anuncio: "1387 - [ASS] - [COMO UMA EMPRESA...] - Conversão", status: "Ativo", plataforma: "Facebook", produto: "Assessoria", estrategia: "Conversão", investimento: 13267, impressoes: 382041, frequencia: 1.10, cpm: 35, ctr: 0.74, cliques: 2830, cliquesLeads: 0.39, leads: 11, leadMql: 64, mql: 7, cpmql: 1483, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 7, anuncio: "1403 - [ASS] - [AUTORIDADE V4] - [VID] - Branding", status: "Ativo", plataforma: "Facebook", produto: "Assessoria", estrategia: "Branding", investimento: 10378, impressoes: 281307, frequencia: 1.07, cpm: 37, ctr: 0.72, cliques: 2019, cliquesLeads: 0.55, leads: 11, leadMql: 64, mql: 7, cpmql: 1483, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 8, anuncio: "1404 - [ASS] - [AUTORIDADE V4] - [VID] - Retargeting", status: "Pausado", plataforma: "Facebook", produto: "Assessoria", estrategia: "Retargeting", investimento: 10172, impressoes: 213050, frequencia: 1.27, cpm: 48, ctr: 1.20, cliques: 2552, cliquesLeads: 0.24, leads: 6, leadMql: 83, mql: 5, cpmql: 611, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 9, anuncio: "1638 - [ASS] - [ESTRATÉGIA DE MARK...] - Conversão", status: "Ativo", plataforma: "Instagram", produto: "Curso", estrategia: "Conversão", investimento: 7608, impressoes: 93683, frequencia: 1.48, cpm: 81, ctr: 1.51, cliques: 1413, cliquesLeads: 0.50, leads: 7, leadMql: 100, mql: 7, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 10, anuncio: "1707 - [ASS] - [EMPRESÁRIO SEM TE...] - Lead Gen", status: "Ativo", plataforma: "Facebook", produto: "Assessoria", estrategia: "Lead Gen", investimento: 7558, impressoes: 110530, frequencia: 1.37, cpm: 68, ctr: 1.48, cliques: 1637, cliquesLeads: 0.55, leads: 9, leadMql: 89, mql: 8, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 11, anuncio: "1708 - [ASS] - [EMPRESÁRIO SEM TE...] - Awareness", status: "Ativo", plataforma: "Instagram", produto: "Assessoria", estrategia: "Awareness", investimento: 7527, impressoes: 72253, frequencia: 1.46, cpm: 104, ctr: 3.42, cliques: 2474, cliquesLeads: 0.61, leads: 15, leadMql: 87, mql: 13, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 12, anuncio: "1634 - [ASS] - [EMPRESÁRIO NÃO SA...] - Conversão", status: "Arquivado", plataforma: "Facebook", produto: "Assessoria", estrategia: "Conversão", investimento: 6762, impressoes: 143215, frequencia: 1.20, cpm: 47, ctr: 1.10, cliques: 1582, cliquesLeads: 0.51, leads: 8, leadMql: 88, mql: 7, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 13, anuncio: "1635 - [ASS] - [CLIENTE NÃO SABE O...] - Lead Gen", status: "Ativo", plataforma: "Google Ads", produto: "Consultoria", estrategia: "Lead Gen", investimento: 6749, impressoes: 180805, frequencia: 1.17, cpm: 37, ctr: 1.34, cliques: 2423, cliquesLeads: 0.41, leads: 10, leadMql: 70, mql: 7, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 14, rr: 1 },
  { id: 14, anuncio: "1636 - [ASS] - [EMPRESÁRIO NÃO SA...] - Retargeting", status: "Pausado", plataforma: "Facebook", produto: "Assessoria", estrategia: "Retargeting", investimento: 6706, impressoes: 177810, frequencia: 1.16, cpm: 38, ctr: 1.65, cliques: 2930, cliquesLeads: 0.27, leads: 8, leadMql: 80, mql: 8, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 15, anuncio: "1402 - [ASS] - [MARKETING E VENDA...] - Branding", status: "Ativo", plataforma: "Instagram", produto: "Curso", estrategia: "Branding", investimento: 6287, impressoes: 122877, frequencia: 1.37, cpm: 51, ctr: 1.86, cliques: 2287, cliquesLeads: 0.13, leads: 3, leadMql: 67, mql: 2, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 16, anuncio: "1506 - [ASS] - [THIAGO NIGRO] - [VID] - Conversão", status: "Ativo", plataforma: "Facebook", produto: "Assessoria", estrategia: "Conversão", investimento: 6269, impressoes: 107889, frequencia: 1.30, cpm: 58, ctr: 1.98, cliques: 2131, cliquesLeads: 0.23, leads: 5, leadMql: 100, mql: 5, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 20, rr: 1 },
  { id: 17, anuncio: "1388 - [ASS] - [] - [VID] - [Mentores] - Awareness", status: "Arquivado", plataforma: "Instagram", produto: "Consultoria", estrategia: "Awareness", investimento: 5027, impressoes: 114292, frequencia: 1.16, cpm: 44, ctr: 0.78, cliques: 893, cliquesLeads: 0.22, leads: 2, leadMql: 100, mql: 2, cpmql: 2454, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 18, anuncio: "1401 - [ASS] - [ENTREGÁVEIS] - [VID] - Lead Gen", status: "Ativo", plataforma: "Google Ads", produto: "Curso", estrategia: "Lead Gen", investimento: 3476, impressoes: 54886, frequencia: 1.33, cpm: 63, ctr: 2.58, cliques: 1415, cliquesLeads: 0.57, leads: 8, leadMql: 50, mql: 4, cpmql: 0, mqlRm: 25, rm: 1, mqlRr: 25, rr: 1 },
  { id: 19, anuncio: "1399 - [ASS] - [ENTREGÁVEIS] - [VID] - Conversão", status: "Pausado", plataforma: "Facebook", produto: "Assessoria", estrategia: "Conversão", investimento: 3386, impressoes: 89282, frequencia: 1.49, cpm: 38, ctr: 2.13, cliques: 1898, cliquesLeads: 0.16, leads: 3, leadMql: 67, mql: 2, cpmql: 0, mqlRm: 0, rm: 0, mqlRr: 0, rr: 0 },
  { id: 20, anuncio: "1400 - [ASS] - [MULTIPLICAR CAPTAÇ...] - Branding", status: "Ativo", plataforma: "Instagram", produto: "Assessoria", estrategia: "Branding", investimento: 2233, impressoes: 67467, frequencia: 1.41, cpm: 33, ctr: 0.96, cliques: 647, cliquesLeads: 0.15, leads: 1, leadMql: 100, mql: 1, cpmql: 0, mqlRm: 100, rm: 1, mqlRr: 100, rr: 1 },
];

const statusOptions = ["Todos", "Ativo", "Pausado", "Arquivado"];
const plataformaOptions = ["Todos", "Facebook", "Instagram", "Google Ads"];
const estrategiaOptions = ["Todos", "Conversão", "Awareness", "Lead Gen", "Retargeting", "Branding"];
const produtoOptions = ["Todos", "Assessoria", "Consultoria", "Curso"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function getHeatmapColor(value: number, min: number, max: number, invert: boolean = false): string {
  if (max === min) return "transparent";
  const ratio = (value - min) / (max - min);
  const adjustedRatio = invert ? 1 - ratio : ratio;
  
  if (adjustedRatio < 0.2) {
    return invert ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.1)";
  } else if (adjustedRatio < 0.4) {
    return invert ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)";
  } else if (adjustedRatio < 0.6) {
    return "rgba(234, 179, 8, 0.2)";
  } else if (adjustedRatio < 0.8) {
    return invert ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)";
  } else {
    return invert ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)";
  }
}

export default function Criativos() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [adStatus, setAdStatus] = useState("Todos");
  const [plataforma, setPlataforma] = useState("Todos");
  const [estrategia, setEstrategia] = useState("Todos");
  const [produto, setProduto] = useState("Todos");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filteredData = useMemo(() => {
    let data = [...mockData];
    
    if (searchTerm) {
      data = data.filter(item => 
        item.anuncio.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (adStatus !== "Todos") {
      data = data.filter(item => item.status === adStatus);
    }
    
    if (plataforma !== "Todos") {
      data = data.filter(item => item.plataforma === plataforma);
    }
    
    if (estrategia !== "Todos") {
      data = data.filter(item => item.estrategia === estrategia);
    }
    
    if (produto !== "Todos") {
      data = data.filter(item => item.produto === produto);
    }
    
    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return data;
  }, [searchTerm, adStatus, plataforma, estrategia, produto, sortConfig]);

  const totals = useMemo(() => {
    return {
      investimento: filteredData.reduce((acc, item) => acc + item.investimento, 0),
      impressoes: filteredData.reduce((acc, item) => acc + item.impressoes, 0),
      cliques: filteredData.reduce((acc, item) => acc + item.cliques, 0),
      leads: filteredData.reduce((acc, item) => acc + item.leads, 0),
      mql: filteredData.reduce((acc, item) => acc + item.mql, 0),
      rm: filteredData.reduce((acc, item) => acc + item.rm, 0),
      rr: filteredData.reduce((acc, item) => acc + item.rr, 0),
    };
  }, [filteredData]);

  const ranges = useMemo(() => {
    return {
      investimento: { min: Math.min(...filteredData.map(d => d.investimento)), max: Math.max(...filteredData.map(d => d.investimento)) },
      cpm: { min: Math.min(...filteredData.map(d => d.cpm)), max: Math.max(...filteredData.map(d => d.cpm)) },
      ctr: { min: Math.min(...filteredData.map(d => d.ctr)), max: Math.max(...filteredData.map(d => d.ctr)) },
      cpmql: { min: Math.min(...filteredData.map(d => d.cpmql)), max: Math.max(...filteredData.map(d => d.cpmql)) },
      leadMql: { min: Math.min(...filteredData.map(d => d.leadMql)), max: Math.max(...filteredData.map(d => d.leadMql)) },
      mqlRm: { min: Math.min(...filteredData.map(d => d.mqlRm)), max: Math.max(...filteredData.map(d => d.mqlRm)) },
      mqlRr: { min: Math.min(...filteredData.map(d => d.mqlRr)), max: Math.max(...filteredData.map(d => d.mqlRr)) },
    };
  }, [filteredData]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Rocket className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Growth | Criativos</h1>
            <p className="text-sm text-muted-foreground">Análise de performance de anúncios</p>
          </div>
          <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-600 border-green-500/30">
            <TrendingUp className="w-3 h-3 mr-1" />
            Safra
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-range">
                <CalendarIcon className="w-4 h-4" />
                {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })}
                {" - "}
                {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ad Name:</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar anúncio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-[200px]"
              data-testid="input-search-ad"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchTerm("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ad Status:</span>
          <Select value={adStatus} onValueChange={setAdStatus}>
            <SelectTrigger className="w-[120px]" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Plataforma:</span>
          <Select value={plataforma} onValueChange={setPlataforma}>
            <SelectTrigger className="w-[130px]" data-testid="select-plataforma">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plataformaOptions.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Estratégia:</span>
          <Select value={estrategia} onValueChange={setEstrategia}>
            <SelectTrigger className="w-[130px]" data-testid="select-estrategia">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {estrategiaOptions.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Produto:</span>
          <Select value={produto} onValueChange={setProduto}>
            <SelectTrigger className="w-[130px]" data-testid="select-produto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {produtoOptions.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Performance de Anúncio (Visão de Safra)
              <Badge variant="secondary" className="ml-2">{filteredData.length} anúncios</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[280px]">
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => handleSort('anuncio')}>
                        Anúncio
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('investimento')}>
                        Investimento
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('impressoes')}>
                        Impressões
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">Frequência</TableHead>
                    <TableHead className="text-right whitespace-nowrap">CPM</TableHead>
                    <TableHead className="text-right whitespace-nowrap">CTR</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('cliques')}>
                        Cliques
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">Cliques&gt;Leads</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('leads')}>
                        Leads
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">Lead&gt;MQL</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('mql')}>
                        MQL
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">CPMQL</TableHead>
                    <TableHead className="text-right whitespace-nowrap">MQL&gt;RM</TableHead>
                    <TableHead className="text-right whitespace-nowrap">RM</TableHead>
                    <TableHead className="text-right whitespace-nowrap">MQL&gt;RR</TableHead>
                    <TableHead className="text-right whitespace-nowrap">RR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30" data-testid={`row-anuncio-${row.id}`}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium max-w-[280px] truncate" title={row.anuncio}>
                        {row.anuncio}
                      </TableCell>
                      <TableCell 
                        className="text-right font-semibold"
                        style={{ backgroundColor: getHeatmapColor(row.investimento, ranges.investimento.min, ranges.investimento.max, false) }}
                      >
                        {formatCurrency(row.investimento)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.impressoes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.frequencia.toFixed(2)}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: getHeatmapColor(row.cpm, ranges.cpm.min, ranges.cpm.max, true) }}
                      >
                        {formatCurrency(row.cpm)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(row.ctr)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.cliques)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatPercent(row.cliquesLeads)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.leads}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: getHeatmapColor(row.leadMql, ranges.leadMql.min, ranges.leadMql.max, false) }}
                      >
                        {row.leadMql}%
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.mql}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: row.cpmql > 0 ? getHeatmapColor(row.cpmql, ranges.cpmql.min, ranges.cpmql.max, true) : 'transparent' }}
                      >
                        {row.cpmql > 0 ? formatCurrency(row.cpmql) : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: row.mqlRm > 0 ? getHeatmapColor(row.mqlRm, ranges.mqlRm.min, ranges.mqlRm.max, false) : 'transparent' }}
                      >
                        {row.mqlRm > 0 ? `${row.mqlRm}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.rm > 0 ? row.rm : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: row.mqlRr > 0 ? getHeatmapColor(row.mqlRr, ranges.mqlRr.min, ranges.mqlRr.max, false) : 'transparent' }}
                      >
                        {row.mqlRr > 0 ? `${row.mqlRr}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.rr > 0 ? row.rr : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  <TableRow className="bg-muted/70 font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-muted/70 z-10">Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.investimento)}</TableCell>
                    <TableCell className="text-right">{formatNumber(totals.impressoes)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{formatNumber(totals.cliques)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{totals.leads}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{totals.mql}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{totals.rm}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">{totals.rr}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
