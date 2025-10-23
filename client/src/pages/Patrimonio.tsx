import { useState, useMemo } from "react";
import type { Patrimonio } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, DollarSign, Laptop, Armchair, Car, Building2, LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// Mock data
const mockPatrimonio: Patrimonio[] = [
  {
    id: "1",
    tipo: "Notebook Dell XPS 15",
    nome: "DEV-NB-001",
    categoria: "Equipamentos",
    valor: 8500,
    responsavel: "Eduardo Santos",
    status: "Ativo",
    dataAquisicao: "2023-02-15",
    descricao: "Notebook para desenvolvimento - i7 11th Gen, 32GB RAM, 1TB SSD",
  },
  {
    id: "2",
    tipo: "MacBook Pro M2",
    nome: "DESIGN-MB-002",
    categoria: "Equipamentos",
    valor: 15000,
    responsavel: "Fernanda Lima",
    status: "Ativo",
    dataAquisicao: "2023-03-20",
    descricao: "MacBook Pro 14\" para design - M2 Pro, 16GB, 512GB",
  },
  {
    id: "3",
    tipo: "Mesa de Reunião",
    nome: "MOVEL-MR-001",
    categoria: "Móveis",
    valor: 2800,
    responsavel: "Escritório Sede",
    status: "Ativo",
    dataAquisicao: "2023-01-10",
    descricao: "Mesa de reunião para 8 pessoas - madeira maciça",
  },
  {
    id: "4",
    tipo: "Cadeira Ergonômica Herman Miller",
    nome: "MOVEL-CE-003",
    categoria: "Móveis",
    valor: 4200,
    responsavel: "Ana Silva",
    status: "Ativo",
    dataAquisicao: "2023-02-01",
    descricao: "Cadeira ergonômica Aeron - tamanho M",
  },
  {
    id: "5",
    tipo: "Toyota Corolla 2022",
    nome: "VEI-001",
    categoria: "Veículos",
    valor: 125000,
    responsavel: "Frota Corporativa",
    status: "Ativo",
    dataAquisicao: "2022-11-15",
    descricao: "Veículo corporativo - Altis Hybrid Premium",
  },
  {
    id: "6",
    tipo: "Monitor LG UltraWide 34\"",
    nome: "EQUIP-MON-007",
    categoria: "Equipamentos",
    valor: 3200,
    responsavel: "Carlos Mendes",
    status: "Ativo",
    dataAquisicao: "2023-04-10",
    descricao: "Monitor ultrawide para análise de dados",
  },
  {
    id: "7",
    tipo: "Impressora HP LaserJet",
    nome: "EQUIP-IMP-001",
    categoria: "Equipamentos",
    valor: 2100,
    responsavel: "Escritório Sede",
    status: "Manutenção",
    dataAquisicao: "2022-08-20",
    descricao: "Impressora multifuncional laser colorida",
  },
  {
    id: "8",
    tipo: "Sala Comercial - Ed. Corporate",
    nome: "IMOVEL-SC-001",
    categoria: "Imóveis",
    valor: 850000,
    responsavel: "Administração",
    status: "Ativo",
    dataAquisicao: "2022-06-01",
    descricao: "Sala comercial 120m² - 12º andar",
  },
];

const statusColors = {
  Ativo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Manutenção: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Inativo: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const categoriaIcons = {
  Equipamentos: Laptop,
  Móveis: Armchair,
  Veículos: Car,
  Imóveis: Building2,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function Patrimonio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredPatrimonio = useMemo(() => {
    let filtered = mockPatrimonio;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.nome.toLowerCase().includes(query) ||
          item.tipo.toLowerCase().includes(query) ||
          item.responsavel.toLowerCase().includes(query)
      );
    }

    if (categoriaFilter !== "all") {
      filtered = filtered.filter((item) => item.categoria === categoriaFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    return filtered;
  }, [searchQuery, categoriaFilter, statusFilter]);

  const totalValor = filteredPatrimonio.reduce((sum, item) => sum + item.valor, 0);

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-3xl font-semibold mb-2">Patrimônio</h1>
              <p className="text-muted-foreground">Gerencie o patrimônio da empresa</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Valor Total</div>
              <div className="text-2xl font-semibold text-primary" data-testid="text-total-valor">
                {formatCurrency(totalValor)}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome, tipo ou responsável..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-patrimonio"
              />
            </div>

            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-categoria-filter">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                <SelectItem value="Móveis">Móveis</SelectItem>
                <SelectItem value="Veículos">Veículos</SelectItem>
                <SelectItem value="Imóveis">Imóveis</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="Todos status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Manutenção">Manutenção</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="default" data-testid="button-add-patrimonio">
              <Plus className="w-4 h-4 mr-2" />
              Novo Item
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {filteredPatrimonio.length}{" "}
              {filteredPatrimonio.length === 1 ? "item" : "itens"} encontrados
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">Visualização:</span>
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {filteredPatrimonio.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum item encontrado
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPatrimonio.map((item) => (
                <Card
                  key={item.id}
                  className="hover-elevate cursor-pointer"
                  data-testid={`card-patrimonio-${item.id}`}
                >
                  <CardHeader className="gap-1 space-y-0 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const IconComponent = categoriaIcons[item.categoria];
                          return <IconComponent className="w-5 h-5 text-primary" />;
                        })()}
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          data-testid={`badge-categoria-${item.id}`}
                        >
                          {item.categoria}
                        </Badge>
                      </div>
                      <Badge
                        variant="secondary"
                        className={statusColors[item.status]}
                        data-testid={`badge-status-${item.id}`}
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-2" data-testid={`text-tipo-${item.id}`}>
                      {item.tipo}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Identificação</div>
                        <div className="text-sm font-medium" data-testid={`text-nome-${item.id}`}>
                          {item.nome}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Valor</div>
                        <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                          <DollarSign className="w-3 h-3" />
                          <span data-testid={`text-valor-${item.id}`}>
                            {formatCurrency(item.valor)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Responsável</div>
                        <div className="text-sm" data-testid={`text-responsavel-${item.id}`}>
                          {item.responsavel}
                        </div>
                      </div>

                      {item.descricao && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Descrição</div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {item.descricao}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t border-border">
                        <div className="text-xs text-muted-foreground">
                          Aquisição:{" "}
                          {new Date(item.dataAquisicao).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Identificação</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aquisição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatrimonio.map((item) => {
                    const IconComponent = categoriaIcons[item.categoria];
                    return (
                      <TableRow
                        key={item.id}
                        className="hover-elevate cursor-pointer"
                        data-testid={`row-patrimonio-${item.id}`}
                      >
                        <TableCell className="font-medium">{item.tipo}</TableCell>
                        <TableCell>{item.nome}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4 text-primary" />
                            <Badge variant="secondary" className="text-xs">
                              {item.categoria}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
                          {formatCurrency(item.valor)}
                        </TableCell>
                        <TableCell>{item.responsavel}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[item.status]}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(item.dataAquisicao).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
