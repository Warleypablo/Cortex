import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import DiscResultado, { type DiscResultadoData } from "@/components/disc/DiscResultado";
import { DISC_ARQUETIPOS, FATORES, type Fator } from "@shared/disc";

interface MapaItem {
  userId: string;
  colaboradorId: number | null;
  nome: string;
  foto: string | null;
  squad: string | null;
  setor: string | null;
  dominante: Fator;
  secundario: Fator;
  criadoEm: string;
}
interface MapaResponse {
  distribuicao: Record<Fator, number>;
  total: number;
  feitos: MapaItem[];
  pendentes: { colaboradorId: number; nome: string; squad: string | null }[];
}

const FATOR_COR: Record<Fator, string> = { D: "#ef4444", I: "#f59e0b", S: "#22c55e", C: "#3b82f6" };

export default function DiscMapa() {
  const { setPageInfo } = usePageInfo();
  usePageTitle("Mapa DISC do Time");
  const [fSquad, setFSquad] = useState<string>("todos");
  const [fSetor, setFSetor] = useState<string>("todos");
  const [fPerfil, setFPerfil] = useState<string>("todos");
  const [detalhe, setDetalhe] = useState<string | null>(null); // userId

  useEffect(() => {
    setPageInfo("Mapa DISC do Time", "Perfis comportamentais da equipe");
  }, [setPageInfo]);

  const { data, isLoading } = useQuery<MapaResponse>({ queryKey: ["/api/gg/disc/mapa"] });

  const { data: detalheData } = useQuery<DiscResultadoData>({
    queryKey: ["/api/gg/disc/resultado", detalhe],
    queryFn: async () => {
      const res = await fetch(`/api/gg/disc/resultado/${detalhe}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!detalhe,
  });

  const squads = useMemo(() => {
    const s = new Set<string>();
    data?.feitos.forEach((f) => f.squad && s.add(f.squad));
    return Array.from(s).sort();
  }, [data]);

  const setores = useMemo(() => {
    const s = new Set<string>();
    data?.feitos.forEach((f) => f.setor && s.add(f.setor));
    return Array.from(s).sort();
  }, [data]);

  const filtrados = useMemo(() => {
    return (data?.feitos ?? []).filter(
      (f) =>
        (fSetor === "todos" || f.setor === fSetor) &&
        (fSquad === "todos" || f.squad === fSquad) &&
        (fPerfil === "todos" || f.dominante === fPerfil),
    );
  }, [data, fSetor, fSquad, fPerfil]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const total = data?.total ?? 0;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Distribuição */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {FATORES.map((f) => {
          const n = data?.distribuicao[f] ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          return (
            <Card key={f} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white font-bold"
                    style={{ backgroundColor: FATOR_COR[f] }}>{f}</span>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{n}</div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">
                      {DISC_ARQUETIPOS[f].nome} · {pct}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={fSetor} onValueChange={setFSetor}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as áreas</SelectItem>
            {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fSquad} onValueChange={setFSquad}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Squad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os squads</SelectItem>
            {squads.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPerfil} onValueChange={setFPerfil}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os perfis</SelectItem>
            {FATORES.map((f) => (
              <SelectItem key={f} value={f}>{DISC_ARQUETIPOS[f].nome} ({f})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de quem fez */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
        <CardHeader><CardTitle className="text-base text-gray-900 dark:text-white">
          Fizeram o teste ({filtrados.length})
        </CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Squad</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((f) => (
                <TableRow
                  key={f.userId}
                  className="cursor-pointer"
                  onClick={() => setDetalhe(f.userId)}
                  data-testid={`disc-linha-${f.userId}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={f.foto ?? undefined} />
                        <AvatarFallback>{f.nome.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-gray-900 dark:text-white">{f.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-zinc-400">{f.setor ?? "—"}</TableCell>
                  <TableCell className="text-gray-600 dark:text-zinc-400">{f.squad ?? "—"}</TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: FATOR_COR[f.dominante], color: "white" }}>
                      {DISC_ARQUETIPOS[f.dominante].nome}
                    </Badge>
                    <span className="ml-1 text-xs text-gray-400 dark:text-zinc-500">
                      / {DISC_ARQUETIPOS[f.secundario].nome}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500 dark:text-zinc-400 text-sm">
                    {f.criadoEm ? new Date(f.criadoEm).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pendentes */}
      {(data?.pendentes.length ?? 0) > 0 && (
        <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700">
          <CardHeader><CardTitle className="text-base text-gray-900 dark:text-white">
            Ainda não fizeram ({data?.pendentes.length})
          </CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data?.pendentes.map((p) => (
                <Badge key={p.colaboradorId} variant="outline" className="text-gray-600 dark:text-zinc-300">
                  {p.nome}{p.squad ? ` · ${p.squad}` : ""}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drawer/modal de detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Resultado DISC</DialogTitle></DialogHeader>
          {detalheData ? (
            <DiscResultado data={detalheData} />
          ) : (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
