import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

/** Card de erro padrão (borda/fundo vermelho) usado pelas seções do Painel Executivo
   quando uma query falha. Extraído das cópias idênticas em SecaoCapacity/SecaoChurn/
   SecaoLtLtv/SecaoEntregas. */
export function ErroCard({ mensagem }: { mensagem: string }) {
  return (
    <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40">
      <CardContent className="flex items-center gap-2 py-4 text-sm text-red-700 dark:text-red-300">
        <AlertTriangle className="h-4 w-4" /> {mensagem}
      </CardContent>
    </Card>
  );
}

/** Card com título fixo (+ sub opcional) que troca o conteúdo por skeleton/erro sem
   desmontar as seções vizinhas. Extraído da versão mais completa (SecaoEntregas, com a
   prop `sub`) — SecaoChurn (como `BlocoTabela`), SecaoLtLtv e SecaoPerformance tinham
   cópias sem `sub`. `skeletonClassName` preserva a altura de skeleton que cada seção já
   usava antes da unificação (h-40/h-48/h-64 divergiam entre as cópias). */
export function BlocoCard({
  titulo,
  sub,
  isLoading,
  isError,
  skeletonClassName = "h-48 w-full",
  children,
}: {
  titulo: string;
  sub?: string;
  isLoading: boolean;
  isError: boolean;
  skeletonClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{titulo}</h3>
          {sub && <span className="text-xs text-gray-400 dark:text-zinc-500">{sub}</span>}
        </div>
        {isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> Falha ao carregar.</div>
        ) : isLoading ? (
          <Skeleton className={skeletonClassName} />
        ) : children}
      </CardContent>
    </Card>
  );
}

/** Formata Lifetime em meses (null-safe). Extraído de SecaoLtLtv/SecaoPerformance. */
export function formatLt(v: number | null | undefined): string {
  return v != null ? `${v}m` : "—";
}

/** Iniciais (1-2 letras) para avatar sem foto. Extraído de SecaoEntregas/SecaoPerformance. */
export function getInitials(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Avatar circular pequeno (foto ou iniciais) usado nos rankings de operador.
   Extraído de SecaoEntregas/SecaoPerformance. */
export function AvatarPequeno({ fotoUrl, nome }: { fotoUrl: string | null; nome: string }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-[10px] font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
      {fotoUrl ? (
        <img src={fotoUrl} alt={nome} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        getInitials(nome)
      )}
    </div>
  );
}
