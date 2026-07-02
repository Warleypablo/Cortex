// Resumo diário de métricas para líderes via WhatsApp.
// Spec: docs/superpowers/specs/2026-07-02-resumo-lideres-whatsapp-design.md

export interface MetricasResumo {
  mrrAtivo: number;
  entregaPontual: number;
  churn: number;
  churnPct: number; // 0-100
  emCancelamento: number;
  crossR: number;
  crossP: number; // pontual bruto
  crossPAmortizado: number; // crossP / 5
  crossTotal: number; // crossR + crossPAmortizado
  netChurn: number; // churn - crossTotal
  netChurnPct: number; // 0-100
  mrrInicioMes: number;
}

export function formatarMoedaBR(valor: number): string {
  return (
    "R$ " +
    valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function formatarPercentBR(valor: number): string {
  return (
    valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
  );
}

export function formatarMensagemResumo(
  m: MetricasResumo,
  agora: { dataFmt: string; horaFmt: string },
): string {
  return `Bom dia líderes!!!
Atualizações sobre nossas métricas principais, dia ${agora.dataFmt}, ${agora.horaFmt}.

MRR: ${formatarMoedaBR(m.mrrAtivo)}
Entrega Pontual: ${formatarMoedaBR(m.entregaPontual)}

Churn: ${formatarMoedaBR(m.churn)} - *${formatarPercentBR(m.churnPct)}*
Em cancelamento: ${formatarMoedaBR(m.emCancelamento)}

Cross R: ${formatarMoedaBR(m.crossR)}
Cross P: ${formatarMoedaBR(m.crossP)} / 5 = ${formatarMoedaBR(m.crossPAmortizado)}
Total: ${formatarMoedaBR(m.crossR)} + ${formatarMoedaBR(m.crossPAmortizado)} = ${formatarMoedaBR(m.crossTotal)}

Net Churn: ${formatarMoedaBR(m.netChurn)} - *${formatarPercentBR(m.netChurnPct)}*

*OBS 1: Bora buscar mais cross*
*OBS 2: Bora reter*
*OBS 3: Não sai mais ninguém*`;
}

export function agoraSaoPaulo(date: Date = new Date()): {
  dataRef: string;
  dataFmt: string;
  hora: number;
  horaFmt: string;
  diaSemana: number; // 0=dom ... 6=sáb
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hora = parseInt(get("hour"), 10) % 24; // hour12:false pode devolver "24" à meia-noite
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(date);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    dataRef: `${get("year")}-${get("month")}-${get("day")}`,
    dataFmt: `${get("day")}/${get("month")}`,
    hora,
    horaFmt: `${hora}h`,
    diaSemana: weekdayMap[weekday] ?? 0,
  };
}
