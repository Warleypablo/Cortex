import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Colaborador } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Calendar, Briefcase, Award, Loader2, MapPin, Building2, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const squadColors: Record<string, string> = {
  "Performance": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Vendas": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Comunicação": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Tech": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "Commerce": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function getInitials(nome: string) {
  if (!nome) return "??";
  return nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

export default function Colaboradores() {
  const [searchQuery, setSearchQuery] = useState("");
  const [squadFilter, setSquadFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: colaboradores = [], isLoading } = useQuery<Colaborador[]>({
    queryKey: ["/api/colaboradores"],
  });

  const uniqueSquads = useMemo(() => {
    const squads = new Set(colaboradores.map((c) => c.squad).filter(Boolean));
    return Array.from(squads).sort();
  }, [colaboradores]);

  const filteredColaboradores = useMemo(() => {
    let filtered = colaboradores;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (col) =>
          col.nome?.toLowerCase().includes(query) ||
          col.cargo?.toLowerCase().includes(query) ||
          col.emailTurbo?.toLowerCase().includes(query) ||
          col.cpf?.includes(query) ||
          col.setor?.toLowerCase().includes(query)
      );
    }

    if (squadFilter !== "all") {
      filtered = filtered.filter((col) => col.squad === squadFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((col) => col.status === statusFilter);
    }

    return filtered;
  }, [colaboradores, searchQuery, squadFilter, statusFilter]);

  const ativos = filteredColaboradores.filter((c) => c.status === "Ativo").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="loading-colaboradores" />
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Colaboradores</h1>
          <p className="text-muted-foreground">
            Gerencie os colaboradores da sua equipe ({colaboradores.length} total)
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[300px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome, cargo, email, CPF..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-colaboradores"
              />
            </div>

            <Select value={squadFilter} onValueChange={setSquadFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-squad-filter">
                <SelectValue placeholder="Todas as squads" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as squads</SelectItem>
                {uniqueSquads.map((squad) => (
                  <SelectItem key={squad} value={squad!}>
                    {squad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {filteredColaboradores.length}{" "}
              {filteredColaboradores.length === 1 ? "colaborador" : "colaboradores"} •{" "}
              {ativos} {ativos === 1 ? "ativo" : "ativos"}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[80px]">ID</TableHead>
                  <TableHead className="min-w-[220px]">Colaborador</TableHead>
                  <TableHead className="min-w-[180px]">Cargo / Nível</TableHead>
                  <TableHead className="min-w-[140px]">Squad</TableHead>
                  <TableHead className="min-w-[140px]">Setor</TableHead>
                  <TableHead className="min-w-[280px]">Contatos</TableHead>
                  <TableHead className="min-w-[120px]">CPF</TableHead>
                  <TableHead className="min-w-[140px]">CNPJ</TableHead>
                  <TableHead className="min-w-[180px]">PIX</TableHead>
                  <TableHead className="min-w-[200px]">Localização</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Admissão</TableHead>
                  <TableHead className="min-w-[120px]">Demissão</TableHead>
                  <TableHead className="min-w-[200px]">Motivo Demissão</TableHead>
                  <TableHead className="min-w-[140px]">Proporcional</TableHead>
                  <TableHead className="min-w-[120px]">Tempo Turbo</TableHead>
                  <TableHead className="min-w-[140px]">Último Aumento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredColaboradores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={17} className="text-center py-8 text-muted-foreground">
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
                        <div className="text-sm text-muted-foreground font-mono" data-testid={`text-id-${colaborador.id}`}>
                          {colaborador.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(colaborador.nome)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium" data-testid={`text-nome-${colaborador.id}`}>
                              {colaborador.nome}
                            </div>
                            {colaborador.aniversario && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1" data-testid={`text-aniversario-${colaborador.id}`}>
                                <Calendar className="w-3 h-3" />
                                {formatDate(colaborador.aniversario)}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium flex items-center gap-1.5" data-testid={`text-cargo-${colaborador.id}`}>
                            <Briefcase className="w-3 h-3 text-muted-foreground" />
                            {colaborador.cargo || "-"}
                          </div>
                          {colaborador.nivel && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5" data-testid={`text-nivel-${colaborador.id}`}>
                              <Award className="w-3 h-3" />
                              {colaborador.nivel}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {colaborador.squad ? (
                          <Badge
                            variant="secondary"
                            className={squadColors[colaborador.squad] || "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"}
                            data-testid={`badge-squad-${colaborador.id}`}
                          >
                            {colaborador.squad}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground" data-testid={`text-setor-${colaborador.id}`}>
                          {colaborador.setor || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          {colaborador.emailTurbo && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-3 h-3 text-primary" />
                              <span className="text-muted-foreground truncate max-w-[220px]" title={colaborador.emailTurbo} data-testid={`text-email-turbo-${colaborador.id}`}>
                                {colaborador.emailTurbo}
                              </span>
                            </div>
                          )}
                          {colaborador.emailPessoal && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground truncate max-w-[220px]" title={colaborador.emailPessoal} data-testid={`text-email-pessoal-${colaborador.id}`}>
                                {colaborador.emailPessoal}
                              </span>
                            </div>
                          )}
                          {colaborador.telefone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground" data-testid={`text-telefone-${colaborador.id}`}>{colaborador.telefone}</span>
                            </div>
                          )}
                          {!colaborador.emailTurbo && !colaborador.emailPessoal && !colaborador.telefone && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground font-mono" data-testid={`text-cpf-${colaborador.id}`}>
                          {colaborador.cpf || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground font-mono" data-testid={`text-cnpj-${colaborador.id}`}>
                          {colaborador.cnpj || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {colaborador.pix && (
                            <>
                              <CreditCard className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground truncate max-w-[160px]" title={colaborador.pix} data-testid={`text-pix-${colaborador.id}`}>
                                {colaborador.pix}
                              </span>
                            </>
                          )}
                          {!colaborador.pix && <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.estado && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground font-medium" data-testid={`text-estado-${colaborador.id}`}>{colaborador.estado}</span>
                            </div>
                          )}
                          {colaborador.endereco && (
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={colaborador.endereco} data-testid={`text-endereco-${colaborador.id}`}>
                              {colaborador.endereco}
                            </div>
                          )}
                          {!colaborador.estado && !colaborador.endereco && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={colaborador.status === "Ativo" ? "default" : "secondary"}
                          data-testid={`badge-status-${colaborador.id}`}
                        >
                          {colaborador.status || "Desconhecido"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground" data-testid={`text-admissao-${colaborador.id}`}>
                          {formatDate(colaborador.admissao)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.demissao ? (
                            <>
                              <div className="text-sm text-muted-foreground" data-testid={`text-demissao-${colaborador.id}`}>
                                {formatDate(colaborador.demissao)}
                              </div>
                              {colaborador.tipoDemissao && (
                                <div className="text-xs text-muted-foreground" data-testid={`text-tipo-demissao-${colaborador.id}`}>
                                  {colaborador.tipoDemissao}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.motivoDemissao ? (
                            <div className="text-sm text-muted-foreground max-w-[180px] truncate" title={colaborador.motivoDemissao} data-testid={`text-motivo-demissao-${colaborador.id}`}>
                              {colaborador.motivoDemissao}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {(colaborador.proporcional || colaborador.proporcionalCaju) ? (
                            <>
                              {colaborador.proporcional && (
                                <div className="text-sm text-muted-foreground" data-testid={`text-proporcional-${colaborador.id}`}>
                                  R$ {Number(colaborador.proporcional).toFixed(2)}
                                </div>
                              )}
                              {colaborador.proporcionalCaju && (
                                <div className="text-xs text-muted-foreground" data-testid={`text-proporcional-caju-${colaborador.id}`}>
                                  Caju: R$ {Number(colaborador.proporcionalCaju).toFixed(2)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground" data-testid={`text-meses-turbo-${colaborador.id}`}>
                          {colaborador.mesesDeTurbo ? `${colaborador.mesesDeTurbo} ${colaborador.mesesDeTurbo === 1 ? "mês" : "meses"}` : "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {colaborador.ultimoAumento ? (
                            <>
                              <div className="text-sm text-muted-foreground" data-testid={`text-ultimo-aumento-${colaborador.id}`}>
                                {formatDate(colaborador.ultimoAumento)}
                              </div>
                              {colaborador.mesesUltAumento !== null && colaborador.mesesUltAumento !== undefined && (
                                <div className="text-xs text-muted-foreground" data-testid={`text-meses-ult-aumento-${colaborador.id}`}>
                                  há {colaborador.mesesUltAumento} {colaborador.mesesUltAumento === 1 ? "mês" : "meses"}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
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
