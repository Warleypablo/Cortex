import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plane, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface QuemEstaForaItem {
  id: number;
  nome: string;
  email: string | null;
  dataFim: string;
}

interface QuemEstaForaWidgetProps {
  userPhotos: Record<string, string>;
}

function getInitials(nome: string) {
  const parts = nome.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.substring(0, 2).toUpperCase() || "??";
}

export function QuemEstaForaWidget({ userPhotos }: QuemEstaForaWidgetProps) {
  const { data: items, isLoading } = useQuery<QuemEstaForaItem[]>({
    queryKey: ["/api/unavailability-requests/today"],
    staleTime: 5 * 60 * 1000,
  });

  const lista = items ?? [];

  return (
    <Card data-testid="card-quem-esta-fora" className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 min-w-0">
            <Plane className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Fora hoje</span>
            {lista.length > 0 && (
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {lista.length}
              </Badge>
            )}
          </CardTitle>
          <Link href="/gg/calendario-ferias">
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              data-testid="button-ver-calendario-ferias"
              title="Ver calendário de férias"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto pr-2">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground text-center py-8">
              Ninguém está fora hoje 🎉
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((item) => {
              const email = item.email?.toLowerCase().trim();
              const photo = email ? userPhotos[email] : undefined;
              const dataRetorno = format(parseISO(item.dataFim), "dd/MM", { locale: ptBR });

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid={`fora-item-${item.id}`}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={photo || undefined} alt={item.nome} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {getInitials(item.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      volta em {dataRetorno}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
