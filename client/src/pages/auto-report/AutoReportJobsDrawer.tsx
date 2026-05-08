import { useState, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Loader2,
  XCircle,
  Clock,
  Presentation,
  Inbox,
  Clipboard,
  ExternalLink,
  Download,
} from 'lucide-react';
import {
  isToday,
  isYesterday,
  isThisWeek,
  formatDistanceToNow,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AutoReportJob } from './types';

type TimeFilter = 'hoje' | 'semana' | 'tudo';

interface AutoReportJobsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: AutoReportJob[];
  onRetryJob: (clienteNome: string) => void;
}

function getStatusBorderClass(status: AutoReportJob['status']): string {
  switch (status) {
    case 'concluido':
      return 'border-l-emerald-500';
    case 'processando':
      return 'border-l-amber-500';
    case 'erro':
      return 'border-l-red-500';
    case 'pendente':
    default:
      return 'border-l-gray-300 dark:border-l-zinc-700';
  }
}

function getStatusIcon(status: AutoReportJob['status']) {
  switch (status) {
    case 'concluido':
      return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
    case 'processando':
      return <Loader2 className="w-4 h-4 text-amber-500 animate-spin shrink-0" />;
    case 'erro':
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'pendente':
    default:
      return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

function groupJobsByDay(jobs: AutoReportJob[]): {
  hoje: AutoReportJob[];
  ontem: AutoReportJob[];
  semana: AutoReportJob[];
  antigos: AutoReportJob[];
} {
  const groups = {
    hoje: [] as AutoReportJob[],
    ontem: [] as AutoReportJob[],
    semana: [] as AutoReportJob[],
    antigos: [] as AutoReportJob[],
  };
  jobs.forEach((job) => {
    const date = new Date(job.criadoEm);
    if (isToday(date)) groups.hoje.push(job);
    else if (isYesterday(date)) groups.ontem.push(job);
    else if (isThisWeek(date, { weekStartsOn: 1 })) groups.semana.push(job);
    else groups.antigos.push(job);
  });
  return groups;
}

function applyTimeFilter(jobs: AutoReportJob[], filter: TimeFilter): AutoReportJob[] {
  if (filter === 'tudo') return jobs;
  return jobs.filter((j) => {
    const date = new Date(j.criadoEm);
    if (filter === 'hoje') return isToday(date);
    if (filter === 'semana') return isThisWeek(date, { weekStartsOn: 1 });
    return true;
  });
}

interface JobCardProps {
  job: AutoReportJob;
  onRetryJob: (clienteNome: string) => void;
  onCopyLink: (url: string, clienteNome: string) => void;
}

function JobCard({ job, onRetryJob, onCopyLink }: JobCardProps) {
  const borderClass = getStatusBorderClass(job.status);
  const date = new Date(job.criadoEm);
  const relTime = formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  const isPptx = job.fileName?.endsWith('.pptx');
  const pulseClass = job.status === 'processando' ? 'animate-pulse' : '';

  return (
    <div
      className={`p-3 rounded-r-lg bg-muted/30 dark:bg-zinc-900/40 border-l-[3px] ${borderClass} ${pulseClass}`}
      data-testid={`job-${job.id}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {getStatusIcon(job.status)}
        <span className="font-semibold text-sm truncate flex-1">{job.clienteNome}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{relTime}</span>
      </div>

      {job.categoria && (
        <p className="text-xs text-muted-foreground mb-2 ml-6 capitalize">
          {job.categoria.replace(/_/g, ' ')}
        </p>
      )}

      {job.status === 'concluido' && job.presentationUrl && !isPptx && (
        <div className="flex items-center gap-2 ml-6">
          <Button
            size="sm"
            onClick={() => onCopyLink(job.presentationUrl!, job.clienteNome)}
            className="gap-1.5"
            data-testid={`btn-copy-${job.id}`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Copiar Link
          </Button>
          <a
            href={job.presentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Abrir Slides
          </a>
        </div>
      )}

      {job.status === 'concluido' && job.downloadUrl && !isPptx && !job.presentationUrl && (
        <div className="ml-6">
          <Button asChild size="sm" className="gap-1.5">
            <a href={job.downloadUrl} download={job.fileName}>
              <Download className="w-3.5 h-3.5" />
              Baixar PDF
            </a>
          </Button>
        </div>
      )}

      {job.status === 'concluido' && isPptx && job.downloadUrl && (
        <div className="ml-6">
          <Button asChild size="sm" className="gap-1.5">
            <a href={job.downloadUrl} download={job.fileName}>
              <Presentation className="w-3.5 h-3.5" />
              Baixar PPTX
            </a>
          </Button>
        </div>
      )}

      {job.status === 'erro' && (
        <div className="ml-6 space-y-2">
          {job.mensagem && (
            <p className="text-xs text-red-600 dark:text-red-400">{job.mensagem}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRetryJob(job.clienteNome)}
            data-testid={`btn-retry-${job.id}`}
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {job.status === 'processando' && (
        <p className="text-xs text-muted-foreground ml-6">Processando...</p>
      )}
    </div>
  );
}

export default function AutoReportJobsDrawer({
  open,
  onOpenChange,
  jobs,
  onRetryJob,
}: AutoReportJobsDrawerProps) {
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('hoje');

  const filteredJobs = useMemo(() => applyTimeFilter(jobs, timeFilter), [jobs, timeFilter]);
  const grouped = useMemo(() => groupJobsByDay(filteredJobs), [filteredJobs]);
  const todayCount = useMemo(
    () => jobs.filter((j) => isToday(new Date(j.criadoEm))).length,
    [jobs],
  );

  const handleCopyLink = async (url: string, clienteNome: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copiado',
        description: `${clienteNome} — pronto para colar.`,
      });
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione e copie manualmente.',
        variant: 'destructive',
      });
    }
  };

  const renderGroup = (label: string, jobsInGroup: AutoReportJob[]) => {
    if (jobsInGroup.length === 0) return null;
    return (
      <div key={label} className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground py-1 sticky top-0 bg-background">
          {label}
        </h3>
        {jobsInGroup
          .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
          .map((job) => (
            <JobCard key={job.id} job={job} onRetryJob={onRetryJob} onCopyLink={handleCopyLink} />
          ))}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px] sm:w-[440px]" side="right">
        <SheetHeader>
          <SheetTitle className="text-lg">Jobs Recentes</SheetTitle>
          <SheetDescription>
            {todayCount} {todayCount === 1 ? 'job' : 'jobs'} hoje
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 mt-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
          {(['hoje', 'semana', 'tudo'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={timeFilter === f ? 'default' : 'outline'}
              onClick={() => setTimeFilter(f)}
              data-testid={`time-filter-${f}`}
            >
              {f === 'hoje' ? 'Hoje' : f === 'semana' ? 'Esta semana' : 'Tudo'}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4">
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Inbox className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                Nenhum relatório nessa janela
              </p>
              <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                Selecione clientes na tabela e clique em Gerar.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pr-3">
              {renderGroup('Hoje', grouped.hoje)}
              {renderGroup('Ontem', grouped.ontem)}
              {renderGroup('Esta semana', grouped.semana)}
              {renderGroup('Mais antigos', grouped.antigos)}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
