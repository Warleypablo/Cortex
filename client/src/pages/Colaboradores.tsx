import { useState, useMemo } from "react";
import type { Colaborador } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock data
const mockColaboradores: Colaborador[] = [
  {
    id: "1",
    nome: "Ana Silva",
    cargo: "Gerente de Performance",
    squad: "Performance",
    email: "ana.silva@turbopartners.com",
    telefone: "(11) 98765-4321",
    status: "Ativo",
    dataAdmissao: "2023-01-15",
  },
  {
    id: "2",
    nome: "Carlos Mendes",
    cargo: "Analista de Mídia",
    squad: "Performance",
    email: "carlos.mendes@turbopartners.com",
    telefone: "(11) 98765-4322",
    status: "Ativo",
    dataAdmissao: "2023-03-20",
  },
  {
    id: "3",
    nome: "Beatriz Costa",
    cargo: "Social Media Manager",
    squad: "Comunicação",
    email: "beatriz.costa@turbopartners.com",
    telefone: "(11) 98765-4323",
    status: "Ativo",
    dataAdmissao: "2023-02-10",
  },
  {
    id: "4",
    nome: "Daniel Oliveira",
    cargo: "Designer Gráfico",
    squad: "Comunicação",
    email: "daniel.oliveira@turbopartners.com",
    telefone: "(11) 98765-4324",
    status: "Ativo",
    dataAdmissao: "2023-04-05",
  },
  {
    id: "5",
    nome: "Eduardo Santos",
    cargo: "Desenvolvedor Full Stack",
    squad: "Tech",
    email: "eduardo.santos@turbopartners.com",
    telefone: "(11) 98765-4325",
    status: "Ativo",
    dataAdmissao: "2023-01-25",
  },
  {
    id: "6",
    nome: "Fernanda Lima",
    cargo: "UX/UI Designer",
    squad: "Tech",
    email: "fernanda.lima@turbopartners.com",
    telefone: "(11) 98765-4326",
    status: "Ativo",
    dataAdmissao: "2023-05-12",
  },
  {
    id: "7",
    nome: "Gabriel Rocha",
    cargo: "Copywriter",
    squad: "Comunicação",
    email: "gabriel.rocha@turbopartners.com",
    status: "Inativo",
    dataAdmissao: "2022-11-30",
  },
  {
    id: "8",
    nome: "Helena Ferreira",
    cargo: "Analista de SEO",
    squad: "Performance",
    email: "helena.ferreira@turbopartners.com",
    telefone: "(11) 98765-4328",
    status: "Ativo",
    dataAdmissao: "2023-06-01",
  },
];

const squadColors = {
  Performance: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Comunicação: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Tech: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

function getInitials(nome: string) {
  return nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Colaboradores() {
  const [searchQuery, setSearchQuery] = useState("");
  const [squadFilter, setSquadFilter] = useState<string>("all");

  const filteredColaboradores = useMemo(() => {
    let filtered = mockColaboradores;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (col) =>
          col.nome.toLowerCase().includes(query) ||
          col.cargo.toLowerCase().includes(query) ||
          col.email.toLowerCase().includes(query)
      );
    }

    if (squadFilter !== "all") {
      filtered = filtered.filter((col) => col.squad === squadFilter);
    }

    return filtered;
  }, [searchQuery, squadFilter]);

  const ativos = filteredColaboradores.filter((c) => c.status === "Ativo").length;

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Colaboradores</h1>
          <p className="text-muted-foreground">
            Gerencie os colaboradores da sua equipe
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome, cargo ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-colaboradores"
              />
            </div>

            <Select value={squadFilter} onValueChange={setSquadFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-squad-filter">
                <SelectValue placeholder="Todas as squads" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as squads</SelectItem>
                <SelectItem value="Performance">Performance</SelectItem>
                <SelectItem value="Comunicação">Comunicação</SelectItem>
                <SelectItem value="Tech">Tech</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="default" data-testid="button-add-colaborador">
              <Plus className="w-4 h-4 mr-2" />
              Novo Colaborador
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {filteredColaboradores.length}{" "}
              {filteredColaboradores.length === 1 ? "colaborador" : "colaboradores"} •{" "}
              {ativos} {ativos === 1 ? "ativo" : "ativos"}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Squad</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredColaboradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum colaborador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredColaboradores.map((colaborador) => (
                    <TableRow
                      key={colaborador.id}
                      className="hover-elevate cursor-pointer"
                      data-testid={`row-colaborador-${colaborador.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={colaborador.foto} />
                            <AvatarFallback>{getInitials(colaborador.nome)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium" data-testid={`text-nome-${colaborador.id}`}>
                              {colaborador.nome}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm" data-testid={`text-cargo-${colaborador.id}`}>
                          {colaborador.cargo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={squadColors[colaborador.squad]}
                          data-testid={`badge-squad-${colaborador.id}`}
                        >
                          {colaborador.squad}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{colaborador.email}</span>
                          </div>
                          {colaborador.telefone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{colaborador.telefone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={colaborador.status === "Ativo" ? "default" : "secondary"}
                          data-testid={`badge-status-${colaborador.id}`}
                        >
                          {colaborador.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {new Date(colaborador.dataAdmissao).toLocaleDateString("pt-BR")}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
