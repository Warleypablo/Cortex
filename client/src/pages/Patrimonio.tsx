import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Package, ArrowDownNarrowWide, ArrowUpNarrowWide, ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface PatrimonioDb {
  id: number;
  numeroAtivo: string | null;
  ativo: string | null;
  marca: string | null;
  estadoConservacao: string | null;
  responsavelAtual: string | null;
  valorPago: string | null;
  valorMercado: string | null;
  valorVenda: string | null;
  descricao: string | null;
}

type SortNumericType = "asc" | "desc";
type SortAlphaType = "none" | "asc" | "desc";

export default function Patrimonio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filterTipoBem, setFilterTipoBem] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [sortNumeric, setSortNumeric] = useState<SortNumericType>("asc");
  const [sortAlpha, setSortAlpha] = useState<SortAlphaType>("none");

  const { data: patrimonios, isLoading, error } = useQuery<PatrimonioDb[]>({
    queryKey: ["/api/patrimonio"],
  });

  const uniqueTiposBem = useMemo(() => {
    if (!patrimonios) return [];
    const tipos = new Set<string>();
    patrimonios.forEach(p => {
      if (p.ativo) tipos.add(p.ativo);
    });
    return Array.from(tipos).sort();
  }, [patrimonios]);

  const uniqueEstados = useMemo(() => {
    if (!patrimonios) return [];
    const estados = new Set<string>();
    patrimonios.forEach(p => {
      if (p.estadoConservacao) estados.add(p.estadoConservacao);
    });
    return Array.from(estados).sort();
  }, [patrimonios]);

  const filteredAndSortedPatrimonios = useMemo(() => {
    if (!patrimonios) return [];
    
    let result = [...patrimonios];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.numeroAtivo?.toLowerCase().includes(query) ||
        p.ativo?.toLowerCase().includes(query) ||
        p.marca?.toLowerCase().includes(query) ||
        p.responsavelAtual?.toLowerCase().includes(query) ||
        p.descricao?.toLowerCase().includes(query)
      );
    }
    
    if (filterTipoBem !== "todos") {
      result = result.filter(p => p.ativo === filterTipoBem);
    }
    
    if (filterEstado !== "todos") {
      result = result.filter(p => p.estadoConservacao === filterEstado);
    }
    
    if (sortAlpha !== "none") {
      result.sort((a, b) => {
        const nameA = a.responsavelAtual || "";
        const nameB = b.responsavelAtual || "";
        
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        
        if (sortAlpha === "asc") {
          return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        } else {
          return nameB.localeCompare(nameA, 'pt-BR', { sensitivity: 'base' });
        }
      });
    } else {
      result.sort((a, b) => {
        const numA = a.numeroAtivo || "";
        const numB = b.numeroAtivo || "";
        if (sortNumeric === "asc") {
          return numA.localeCompare(numB, undefined, { numeric: true });
        } else {
          return numB.localeCompare(numA, undefined, { numeric: true });
        }
      });
    }
    
    return result;
  }, [patrimonios, searchQuery, filterTipoBem, filterEstado, sortNumeric, sortAlpha]);

  const totalPages = Math.ceil(filteredAndSortedPatrimonios.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPatrimonios = filteredAndSortedPatrimonios.slice(startIndex, endIndex);

  const handleNumericSort = () => {
    setSortNumeric(prev => prev === "asc" ? "desc" : "asc");
  };

  const handleAlphaSort = () => {
    if (sortAlpha === "none") {
      setSortAlpha("asc");
    } else if (sortAlpha === "asc") {
      setSortAlpha("desc");
    } else {
      setSortAlpha("none");
    }
  };

  const getEstadoColor = (estado: string | null) => {
    if (!estado) return "";
    const estadoLower = estado.toLowerCase();
    if (estadoLower.includes("bom") || estadoLower.includes("novo") || estadoLower.includes("ótimo")) {
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    }
    if (estadoLower.includes("regular") || estadoLower.includes("médio") || estadoLower.includes("medio")) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    }
    if (estadoLower.includes("ruim") || estadoLower.includes("péssimo") || estadoLower.includes("pessimo")) {
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "-";
    const num = parseFloat(value);
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="error-patrimonio">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
            <CardDescription>Não foi possível carregar os dados do patrimônio.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight" data-testid="title-patrimonio">Patrimônio</h1>
              <p className="text-muted-foreground">
                Gerencie os bens e ativos da empresa
              </p>
            </div>
            <Package className="w-8 h-8 text-primary" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle>Listagem de Patrimônio</CardTitle>
                <CardDescription>
                  Total de {filteredAndSortedPatrimonios.length} {filteredAndSortedPatrimonios.length === 1 ? "item" : "itens"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[250px] relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por número, bem, marca, responsável ou modelo..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9"
                    data-testid="input-search-patrimonio"
                  />
                </div>
                
                <Select
                  value={filterTipoBem}
                  onValueChange={(value) => {
                    setFilterTipoBem(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-filter-tipo-bem">
                    <SelectValue placeholder="Tipo de Bem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Bens</SelectItem>
                    {uniqueTiposBem.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filterEstado}
                  onValueChange={(value) => {
                    setFilterEstado(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-filter-estado">
                    <SelectValue placeholder="Estado de Conservação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Estados</SelectItem>
                    {uniqueEstados.map(estado => (
                      <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNumericSort}
                    disabled={sortAlpha !== "none"}
                    data-testid="button-sort-numeric"
                    title={
                      sortAlpha !== "none" 
                        ? "Ordenação alfabética está ativa" 
                        : sortNumeric === "asc" 
                        ? "Ordenar por número decrescente" 
                        : "Ordenar por número crescente"
                    }
                  >
                    {sortNumeric === "asc" ? (
                      <ArrowDownNarrowWide className="h-4 w-4" />
                    ) : (
                      <ArrowUpNarrowWide className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant={sortAlpha === "none" ? "outline" : "default"}
                    size="icon"
                    onClick={handleAlphaSort}
                    data-testid="button-sort-alpha"
                    title={
                      sortAlpha === "none" 
                        ? "Ordenar alfabeticamente" 
                        : sortAlpha === "asc" 
                        ? "Ordenar alfabeticamente reverso" 
                        : "Voltar para ordenação padrão"
                    }
                  >
                    {sortAlpha === "asc" ? (
                      <ArrowDownAZ className="h-4 w-4" />
                    ) : sortAlpha === "desc" ? (
                      <ArrowUpZA className="h-4 w-4" />
                    ) : (
                      <ArrowDownAZ className="h-4 w-4 opacity-50" />
                    )}
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12" data-testid="loading-patrimonio">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="max-h-[calc(100vh-400px)] overflow-y-auto overflow-x-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-20 shadow-sm">
                          <TableRow className="bg-background border-b">
                            <TableHead className="min-w-[120px]" data-testid="header-numero">Num. Patrimônio</TableHead>
                            <TableHead className="min-w-[200px]" data-testid="header-bem">Qual é o Bem</TableHead>
                            <TableHead className="min-w-[150px]" data-testid="header-marca">Marca</TableHead>
                            <TableHead className="min-w-[180px]" data-testid="header-modelo">Modelo</TableHead>
                            <TableHead className="min-w-[140px]" data-testid="header-estado">Estado</TableHead>
                            <TableHead className="min-w-[180px]" data-testid="header-responsavel">Responsável</TableHead>
                            <TableHead className="min-w-[140px]" data-testid="header-valor-pago">Valor Pago</TableHead>
                            <TableHead className="min-w-[140px]" data-testid="header-valor-mercado">Valor Mercado</TableHead>
                            <TableHead className="min-w-[140px]" data-testid="header-valor-venda">Valor Venda</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedPatrimonios.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                Nenhum patrimônio encontrado.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedPatrimonios.map((item) => (
                              <TableRow 
                                key={item.id} 
                                className="hover-elevate"
                                data-testid={`patrimonio-row-${item.id}`}
                              >
                                <TableCell className="font-medium" data-testid={`numero-${item.id}`}>
                                  {item.numeroAtivo || "-"}
                                </TableCell>
                                <TableCell data-testid={`bem-${item.id}`}>
                                  {item.ativo || "-"}
                                </TableCell>
                                <TableCell data-testid={`marca-${item.id}`}>
                                  {item.marca || "-"}
                                </TableCell>
                                <TableCell data-testid={`modelo-${item.id}`}>
                                  <span className="text-sm text-muted-foreground">
                                    {item.descricao || "-"}
                                  </span>
                                </TableCell>
                                <TableCell data-testid={`estado-${item.id}`}>
                                  {item.estadoConservacao ? (
                                    <Badge 
                                      variant="outline" 
                                      className={getEstadoColor(item.estadoConservacao)}
                                    >
                                      {item.estadoConservacao}
                                    </Badge>
                                  ) : (
                                    "-"
                                  )}
                                </TableCell>
                                <TableCell data-testid={`responsavel-${item.id}`}>
                                  {item.responsavelAtual || "-"}
                                </TableCell>
                                <TableCell className="font-semibold" data-testid={`valor-pago-${item.id}`}>
                                  {formatCurrency(item.valorPago)}
                                </TableCell>
                                <TableCell className="font-semibold" data-testid={`valor-mercado-${item.id}`}>
                                  {formatCurrency(item.valorMercado)}
                                </TableCell>
                                <TableCell className="font-semibold" data-testid={`valor-venda-${item.id}`}>
                                  {formatCurrency(item.valorVenda)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Itens por página:</span>
                        <Select
                          value={itemsPerPage.toString()}
                          onValueChange={(value) => {
                            setItemsPerPage(Number(value));
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="w-[100px]" data-testid="select-items-per-page">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            data-testid="button-first-page"
                          >
                            Primeira
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            data-testid="button-prev-page"
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            data-testid="button-next-page"
                          >
                            Próxima
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            data-testid="button-last-page"
                          >
                            Última
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
