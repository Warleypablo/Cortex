import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Loader2,
  XCircle,
  Clock,
  FileText,
  Presentation,
} from "lucide-react";
import type { AutoReportJob } from "./types";

interface AutoReportJobsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: AutoReportJob[];
  onRetryJob: (clienteNome: string) => void;
}

function getStatusIcon(status: AutoReportJob["status"]) {
  switch (status) {
    case "concluido":
      return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    case "processando":
      return <Loader2 className="w-4 h-4 animate-spin shrink-0" />;
    case "erro":
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case "pendente":
    default:
      return <Clock className="w-4 h-4 shrink-0" />;
  }
}

export default function AutoReportJobsDrawer({
  open,
  onOpenChange,
  jobs,
  onRetryJob,
}: AutoReportJobsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[400px]" side="right">
        <SheetHeader>
          <SheetTitle>Jobs Recentes</SheetTitle>
          <SheetDescription>
            {jobs.length} {jobs.length === 1 ? "job" : "jobs"} no historico
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Clock className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum relatorio gerado ainda
              </p>
            </div>
          ) : (
            <div className="space-y-2 pr-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-lg border space-y-2"
                  data-testid={`job-${job.id}`}
                >
                  {/* Top row: icon + name + time */}
                  <div className="flex items-center gap-2">
                    {getStatusIcon(job.status)}
                    <span className="font-medium text-sm truncate flex-1">
                      {job.clienteNome}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(job.criadoEm).toLocaleString("pt-BR")}
                    </span>
                  </div>

                  {/* Concluido: download link */}
                  {job.status === "concluido" && job.downloadUrl && (
                    <a
                      href={job.downloadUrl}
                      download={job.fileName}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      data-testid={`link-download-${job.id}`}
                    >
                      {job.fileName?.endsWith(".pptx") ? (
                        <>
                          <Presentation className="w-3 h-3" />
                          Baixar PPTX
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          Baixar PDF
                        </>
                      )}
                    </a>
                  )}

                  {/* Erro: message + retry */}
                  {job.status === "erro" && (
                    <>
                      {job.mensagem && (
                        <p className="text-xs text-destructive">
                          {job.mensagem}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRetryJob(job.clienteNome)}
                      >
                        Tentar Novamente
                      </Button>
                    </>
                  )}

                  {/* Processando */}
                  {job.status === "processando" && (
                    <p className="text-xs text-muted-foreground">
                      Processando...
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
