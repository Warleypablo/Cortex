const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Último mês FECHADO em relação a `hoje` (default: mês anterior ao atual). */
export function mesDefault(hoje: Date = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function labelMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES_PT[m - 1]} ${ano}`;
}

export interface ParamsMes {
  mes: string;
  deAte: { de: string; ate: string };
  dataInicioFim: { dataInicio: string; dataFim: string };
  mesInicioFim: { mesInicio: string; mesFim: string };
  startEndDate: { startDate: string; endDate: string };
}

export function paramsParaMes(mes: string): ParamsMes {
  const [ano, m] = mes.split("-").map(Number);
  const ultimoDia = new Date(ano, m, 0).getDate(); // dia 0 do mês seguinte = último dia deste mês
  const dd = String(ultimoDia).padStart(2, "0");
  return {
    mes,
    deAte: { de: mes, ate: mes },
    dataInicioFim: { dataInicio: mes, dataFim: mes },
    mesInicioFim: { mesInicio: mes, mesFim: mes },
    startEndDate: { startDate: `${mes}-01`, endDate: `${mes}-${dd}` },
  };
}

export function mesesOptions(hoje: Date = new Date(), n = 12): { value: string; label: string }[] {
  const base = mesDefault(hoje); // começa no mês fechado
  const [ano, m] = base.split("-").map(Number);
  const opts: { value: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(ano, m - 1 - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: labelMes(value) });
  }
  return opts;
}
