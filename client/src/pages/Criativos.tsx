import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X, ArrowUpDown, TrendingUp, Rocket, ExternalLink } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CriativoData {
  id: string;
  adName: string;
  link: string;
  dataCriacao: string;
  status: string;
  investimento: number;
  ctr: number | null;
  cpm: number | null;
  leads: number;
  cpl: number | null;
  mql: number;
  percMql: number | null;
  cpmql: number | null;
  ra: number;
  percRa: number | null;
  cpra: number | null;
  percRaMql: number | null;
  rr: number;
  percRr: number | null;
  cprr: number | null;
  ganhosAceleracao: number | null;
  ganhosPontuais: number | null;
  cacAceleracao: number | null;
  leadTimeClienteUnico: number | null;
  clientesUnicos: number;
  percRrCliente: number | null;
  cacUnico: number | null;
}

function parseNumber(value: string): number | null {
  if (!value || value === '-' || value === '') return null;
  const cleaned = value.replace('R$', '').replace(/\./g, '').replace(',', '.').replace('%', '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const rawData: CriativoData[] = [
  { id: "120227781212760450", adName: "TP546 - vv-crators-Roberto-natural-tech-simples3-sabe-uma-coisa - adc81 - 18.06", link: "https://fb.me/209oHee6ZIx1qGJ", dataCriacao: "19/06/2025", status: "Ativo", investimento: 23976, ctr: 0.87, cpm: 85, leads: 200, cpl: 120, mql: 49, percMql: 25, cpmql: 489.31, ra: 29, percRa: 15, cpra: 827, percRaMql: 51.72, rr: 22, percRr: 75.86, cprr: 1089.82, ganhosAceleracao: 4, ganhosPontuais: 2, cacAceleracao: 5994.01, leadTimeClienteUnico: 28, clientesUnicos: 4, percRrCliente: 18, cacUnico: 5994 },
  { id: "120234676163910450", adName: "TP724 - vv - REELS 2 - HOOK1 - - 03.09 — Cópia", link: "https://fb.me/31GoHtoi1MwpSJ5", dataCriacao: "02/10/2025", status: "Ativo", investimento: 10347, ctr: 1.35, cpm: 107, leads: 120, cpl: 86, mql: 23, percMql: 19, cpmql: 449.86, ra: 14, percRa: 12, cpra: 739, percRaMql: 64.29, rr: 8, percRr: 57.14, cprr: 1293.34, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120232961198100450", adName: "TP731 - vv-creators-criativo_invisível- hook 4 - - 03.09", link: "https://fb.me/1YaJ6mq0SjpgvZj", dataCriacao: "03/09/2025", status: "Ativo", investimento: 5836, ctr: 1.21, cpm: 70, leads: 172, cpl: 34, mql: 22, percMql: 13, cpmql: 265.26, ra: 10, percRa: 6, cpra: 584, percRaMql: 40, rr: 6, percRr: 60, cprr: 972.61, ganhosAceleracao: null, ganhosPontuais: 1, cacAceleracao: null, leadTimeClienteUnico: 6, clientesUnicos: 1, percRrCliente: 17, cacUnico: 5836 },
  { id: "120232960242590450", adName: "TP724 - vv - REELS 2 - HOOK1 - - 03.09", link: "https://fb.me/22Erryo7fsWQN4Z", dataCriacao: "03/09/2025", status: "Pausado", investimento: 5792, ctr: 1.66, cpm: 102, leads: 79, cpl: 73, mql: 12, percMql: 15, cpmql: 482.70, ra: 5, percRa: 6, cpra: 1158, percRaMql: 60, rr: 6, percRr: 120, cprr: 965.40, ganhosAceleracao: 1, ganhosPontuais: null, cacAceleracao: 5792.39, leadTimeClienteUnico: 37, clientesUnicos: 1, percRrCliente: 17, cacUnico: 5792 },
  { id: "120231071762480450", adName: "TP672 - vv-creators-esther-caixinhas-1x-h3-faz-sentido - - 04.08", link: "https://fb.me/1OB36NLOiTBFbbi", dataCriacao: "04/08/2025", status: "Pausado", investimento: 5179, ctr: 1.11, cpm: 54, leads: 105, cpl: 49, mql: 8, percMql: 8, cpmql: 647.34, ra: 6, percRa: 6, cpra: 863, percRaMql: 33.33, rr: 6, percRr: 100, cprr: 863.12, ganhosAceleracao: null, ganhosPontuais: 1, cacAceleracao: null, leadTimeClienteUnico: 16, clientesUnicos: 1, percRrCliente: 17, cacUnico: 5179 },
  { id: "120234885862190450", adName: "TP796 - vertical hook 3 body 1 cta 2 - - 06.10", link: "https://fb.me/24ORmoUjJLbaeXQ", dataCriacao: "06/10/2025", status: "Ativo", investimento: 4118, ctr: 1.01, cpm: 105, leads: 64, cpl: 64, mql: 17, percMql: 27, cpmql: 242.21, ra: 15, percRa: 23, cpra: 275, percRaMql: 53.33, rr: 12, percRr: 80, cprr: 343.13, ganhosAceleracao: null, ganhosPontuais: 1, cacAceleracao: null, leadTimeClienteUnico: 25, clientesUnicos: 1, percRrCliente: 8, cacUnico: 4118 },
  { id: "120234887730200450", adName: "TP791 - vertical hook 8 body 1 cta 2 - - 06.10", link: "https://fb.me/1QzUnFbj84acfzz", dataCriacao: "06/10/2025", status: "Ativo", investimento: 3481, ctr: 1.07, cpm: 119, leads: 59, cpl: 59, mql: 13, percMql: 22, cpmql: 267.78, ra: 10, percRa: 17, cpra: 348, percRaMql: 90, rr: 5, percRr: 50, cprr: 696.23, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120236070725110450", adName: "TP859 - HOOK1BODY2CTA1V_generico - - 21.10", link: "https://fb.me/28Y7WKUG0s3nVgC", dataCriacao: "21/10/2025", status: "Pausado", investimento: 2225, ctr: 0.91, cpm: 61, leads: 40, cpl: 56, mql: 4, percMql: 10, cpmql: 556.27, ra: 4, percRa: 10, cpra: 556, percRaMql: 0, rr: 3, percRr: 75, cprr: 741.69, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "773237162108_1", adName: "AD 1 (YouTube - HcGTTPCpoTw)", link: "https://www.youtube.com/watch?v=HcGTTPCpoTw", dataCriacao: "08/09/2025", status: "Ativo", investimento: 1855, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "773237162108_2", adName: "AD 1 (YouTube - Ip1SqCfhrOo)", link: "https://www.youtube.com/watch?v=Ip1SqCfhrOo", dataCriacao: "08/09/2025", status: "Ativo", investimento: 1855, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "773237162108_3", adName: "AD 1 (YouTube - UF2aDwrIWzw)", link: "https://www.youtube.com/watch?v=UF2aDwrIWzw", dataCriacao: "08/09/2025", status: "Ativo", investimento: 1855, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "773237162108_4", adName: "AD 1 (YouTube - hNz4BvtFve8)", link: "https://www.youtube.com/watch?v=hNz4BvtFve8", dataCriacao: "08/09/2025", status: "Ativo", investimento: 1855, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235997280980450", adName: "TP827 - hook 4 body 2 cta 2 - - 20.10", link: "https://fb.me/1YcNSHtZzzdiKlI", dataCriacao: "20/10/2025", status: "Ativo", investimento: 1705, ctr: 0.89, cpm: 97, leads: 25, cpl: 68, mql: 3, percMql: 12, cpmql: 568.18, ra: 3, percRa: 12, cpra: 568, percRaMql: 33.33, rr: 1, percRr: 33.33, cprr: 1704.55, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120237696111590450", adName: "TP906 - HOOK1BODY1minimal - - 13.11", link: "https://fb.me/264MGxwZHGmW18Q", dataCriacao: "13/11/2025", status: "Ativo", investimento: 1671, ctr: 0.64, cpm: 56, leads: 25, cpl: 67, mql: 5, percMql: 20, cpmql: 334.22, ra: 1, percRa: 4, cpra: 1671, percRaMql: 100, rr: 0, percRr: 0, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120237700711180450", adName: "TP910 - HOOK1BODY2minimal - - 13.11", link: "https://fb.me/1QBxh0RZ2vX46gd", dataCriacao: "13/11/2025", status: "Ativo", investimento: 1614, ctr: 0.44, cpm: 37, leads: 30, cpl: 54, mql: 7, percMql: 23, cpmql: 230.52, ra: 4, percRa: 13, cpra: 403, percRaMql: 75, rr: 3, percRr: 75, cprr: 537.88, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120237695786240450", adName: "TP891 - HOOK2BODY1CTA1V - - 13.10", link: "https://fb.me/1ZeTU347fwLKJyv", dataCriacao: "13/11/2025", status: "Ativo", investimento: 1386, ctr: 0.93, cpm: 95, leads: 17, cpl: 82, mql: 4, percMql: 24, cpmql: 346.51, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120233664596540450", adName: "TP546 - vv-crators-Roberto-natural-tech-simples3-sabe-uma-coisa - adc81 - 18.06", link: "https://fb.me/1O89dZbvbfSSxIt", dataCriacao: "15/09/2025", status: "Ativo", investimento: 1349, ctr: 0.71, cpm: 106, leads: 5, cpl: 270, mql: 1, percMql: 20, cpmql: 1349.34, ra: 1, percRa: 20, cpra: 1349, percRaMql: 100, rr: 1, percRr: 100, cprr: 1349.34, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120234676163860450", adName: "TP724 - vv - REELS 2 - HOOK1 - - 03.09 — Cópia", link: "https://fb.me/2m01FhM84Cnu4a7", dataCriacao: "02/10/2025", status: "Pausado", investimento: 1248, ctr: 1.64, cpm: 91, leads: 23, cpl: 54, mql: 0, percMql: 0, cpmql: null, ra: 4, percRa: 17, cpra: 312, percRaMql: 0, rr: 4, percRr: 100, cprr: 311.94, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120236071168450450", adName: "TP863 - hOOK1BODY2CTA2V_generico - - 21.10", link: "https://fb.me/1Qtd7Bw7d0kXgFI", dataCriacao: "21/10/2025", status: "Ativo", investimento: 1174, ctr: 0.64, cpm: 71, leads: 14, cpl: 84, mql: 5, percMql: 36, cpmql: 234.75, ra: 1, percRa: 7, cpra: 1174, percRaMql: 0, rr: 0, percRr: 0, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120236071168460450", adName: "TP864 - HOOK2BODY2CTA2V._generico - - 21.10", link: "https://fb.me/1RfOWfKqOezBZ6a", dataCriacao: "21/10/2025", status: "Pausado", investimento: 894, ctr: 1.22, cpm: 110, leads: 15, cpl: 60, mql: 1, percMql: 7, cpmql: 894.12, ra: 2, percRa: 13, cpra: 447, percRaMql: 0, rr: 1, percRr: 50, cprr: 894.12, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120236070725080450", adName: "TP861 - HOOK3BODY2CTA1Vmp4_generico - - 21.10", link: "https://fb.me/1RfO3jrPSOTAW9u", dataCriacao: "21/10/2025", status: "Pausado", investimento: 749, ctr: 0.96, cpm: 109, leads: 3, cpl: 250, mql: 0, percMql: 0, cpmql: null, ra: 1, percRa: 33, cpra: 749, percRaMql: 0, rr: 1, percRr: 100, cprr: 748.79, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120237699466590450", adName: "TP900 - HOOK3BODYCTA2 - - 13.10", link: "https://fb.me/1YG6yxzna3V4O6Y", dataCriacao: "13/11/2025", status: "Pausado", investimento: 729, ctr: 1.01, cpm: 103, leads: 10, cpl: 73, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120236071168470450", adName: "TP865 - hook3body2cta2V._generico - - 21.10", link: "https://fb.me/2lTFHrDD5XxeL1b", dataCriacao: "21/10/2025", status: "Pausado", investimento: 668, ctr: 0.90, cpm: 82, leads: 12, cpl: 56, mql: 1, percMql: 8, cpmql: 667.65, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120236071168490450", adName: "TP866 - hook4body2cta2V_generico - - 21.10", link: "https://fb.me/2asnGqgqVokp30p", dataCriacao: "21/10/2025", status: "Pausado", investimento: 663, ctr: 1.00, cpm: 82, leads: 9, cpl: 74, mql: 1, percMql: 11, cpmql: 662.69, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235998177240450", adName: "TP832 - hook 9 body 2 cta 2 - - 20.10", link: "https://fb.me/xQjs7W8rD3UbRBc", dataCriacao: "21/10/2025", status: "Pausado", investimento: 646, ctr: 1.00, cpm: 83, leads: 7, cpl: 92, mql: 1, percMql: 14, cpmql: 645.89, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235997280960450", adName: "TP819 - vertical hook 5 body 2 cta 1 - - 20.10", link: "https://fb.me/2nYS8FgVUo55YWZ", dataCriacao: "20/10/2025", status: "Pausado", investimento: 628, ctr: 1.22, cpm: 134, leads: 5, cpl: 126, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120233674480800450", adName: "TP755 - vv-remarketing-esther- insta - 3x - 1h - - 15.09", link: "https://fb.me/2huxVLq3i1ZdFss", dataCriacao: "15/09/2025", status: "Pausado", investimento: 620, ctr: 1.03, cpm: 177, leads: 4, cpl: 155, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120234887297950450", adName: "TP804 - vertical hook 4 body 1 cta 1 - - 06.10", link: "https://fb.me/1QypXp3N6UUaF4o", dataCriacao: "06/10/2025", status: "Pausado", investimento: 606, ctr: 1.13, cpm: 111, leads: 8, cpl: 76, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120237699466640450", adName: "TP905 - hook4body2cta2 - - 13.10", link: "https://fb.me/xFzi1nMcczOosFT", dataCriacao: "13/11/2025", status: "Pausado", investimento: 605, ctr: 0.87, cpm: 128, leads: 3, cpl: 202, mql: 1, percMql: 33, cpmql: 604.75, ra: 1, percRa: 33, cpra: 605, percRaMql: 100, rr: 1, percRr: 100, cprr: 604.75, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120234887298010450", adName: "TP793 - vertical hook 6 body 1 cta 2 - - 06.10", link: "https://fb.me/2kVAn3xhXoIpMHX", dataCriacao: "06/10/2025", status: "Pausado", investimento: 604, ctr: 0.76, cpm: 121, leads: 6, cpl: 101, mql: 1, percMql: 17, cpmql: 604.20, ra: 1, percRa: 17, cpra: 604, percRaMql: 100, rr: 1, percRr: 100, cprr: 604.20, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120235998177250450", adName: "TP821 - vertical hook 7 body 2 cta 1 - - 20.10", link: "https://fb.me/2e2xOoevkjynce7", dataCriacao: "21/10/2025", status: "Pausado", investimento: 586, ctr: 0.83, cpm: 108, leads: 6, cpl: 98, mql: 1, percMql: 17, cpmql: 585.99, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743760450", adName: "TP923 - vv-black-friday-2025-2- HOOK1 - - 14.11", link: "https://fb.me/1YLG1RVvY8Gmut2", dataCriacao: "21/11/2025", status: "Pausado", investimento: 583, ctr: 0.66, cpm: 61, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235996076180450", adName: "TP815 - vertical hook 1 body 2 cta 1 - - 20.10", link: "https://fb.me/22fbxV8vtF5H0Ph", dataCriacao: "20/10/2025", status: "Pausado", investimento: 569, ctr: 0.85, cpm: 108, leads: 3, cpl: 190, mql: 0, percMql: 0, cpmql: null, ra: 1, percRa: 33, cpra: 569, percRaMql: 0, rr: 1, percRr: 100, cprr: 569.24, ganhosAceleracao: 1, ganhosPontuais: 1, cacAceleracao: 569.24, leadTimeClienteUnico: 4, clientesUnicos: 1, percRrCliente: 100, cacUnico: 569 },
  { id: "120234744377130450", adName: "TP780 - CREATORS HOOK 1 REELS - - 03.10", link: "https://fb.me/1REOxCQ0GrosOL6", dataCriacao: "03/10/2025", status: "Pausado", investimento: 553, ctr: 1.20, cpm: 135, leads: 6, cpl: 92, mql: 0, percMql: 0, cpmql: null, ra: 1, percRa: 17, cpra: 553, percRaMql: 0, rr: 0, percRr: 0, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235996076190450", adName: "TP816 - vertical hook 2 body 2 cta 1 - - 20.10", link: "https://fb.me/26AJVdlKITDHKho", dataCriacao: "20/10/2025", status: "Pausado", investimento: 551, ctr: 1.11, cpm: 157, leads: 2, cpl: 276, mql: 0, percMql: 0, cpmql: null, ra: 1, percRa: 50, cpra: 551, percRaMql: 0, rr: 1, percRr: 100, cprr: 551.13, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120233673067160450", adName: "TP749 - vv-remarketing-esther- insta - 1x - 1h - - 15.09", link: "https://fb.me/1XDDXiCfnVrBVST", dataCriacao: "15/09/2025", status: "Pausado", investimento: 524, ctr: 0.80, cpm: 149, leads: 2, cpl: 262, mql: 1, percMql: 50, cpmql: 523.84, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120233674303760450", adName: "TP753 - vv-remarketing-esther- insta - 2x - 2h - - 15.09", link: "https://fb.me/1PgZZWkuKcPgTxs", dataCriacao: "15/09/2025", status: "Pausado", investimento: 520, ctr: 1.04, cpm: 142, leads: 7, cpl: 74, mql: 1, percMql: 14, cpmql: 520.21, ra: 1, percRa: 14, cpra: 520, percRaMql: 100, rr: 1, percRr: 100, cprr: 520.21, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120235996076210450", adName: "TP824 - hook 1 body 2 cta 2 - - 20.10", link: "https://fb.me/2oCVQAiq5aOxG3w", dataCriacao: "20/10/2025", status: "Pausado", investimento: 508, ctr: 0.83, cpm: 110, leads: 2, cpl: 254, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120234887297980450", adName: "TP802 - vertical hook 6 body 1 cta 1 - - 06.10", link: "https://fb.me/2cxv3xCJnKOl5y9", dataCriacao: "06/10/2025", status: "Pausado", investimento: 498, ctr: 0.75, cpm: 107, leads: 2, cpl: 249, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235996076230450", adName: "TP826 - hook 3 body 2 cta 2 - - 20.10", link: "https://fb.me/1YlMOqv5Rf9decA", dataCriacao: "20/10/2025", status: "Pausado", investimento: 490, ctr: 0.92, cpm: 136, leads: 2, cpl: 245, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235998177260450", adName: "TP822 - vertical hook 8 body 2 cta 1 - - 20.10", link: "https://fb.me/21GN8uuWPdL6qle", dataCriacao: "21/10/2025", status: "Pausado", investimento: 472, ctr: 0.77, cpm: 106, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743690450", adName: "TP917 - vv-black-friday-2025-1- body 1- hook1 - - 14.11", link: "https://fb.me/1Y1k1ypoKn7wqD2", dataCriacao: "21/11/2025", status: "Pausado", investimento: 448, ctr: 0.60, cpm: 83, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743720450", adName: "TP922 - vv-black-friday-2025-1- body 2- hook 3 - - 14.11", link: "https://fb.me/2ioUHK9U167NB65", dataCriacao: "21/11/2025", status: "Pausado", investimento: 436, ctr: 0.47, cpm: 128, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235998177210450", adName: "TP830 - hook 7 body 2 cta 2 - - 20.10", link: "https://fb.me/2dHIcJt4b5Tumaj", dataCriacao: "21/10/2025", status: "Pausado", investimento: 412, ctr: 0.89, cpm: 126, leads: 5, cpl: 82, mql: 0, percMql: 0, cpmql: null, ra: 1, percRa: 20, cpra: 412, percRaMql: 0, rr: 0, percRr: 0, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235996076200450", adName: "TP817 - vertical hook 3 body 2 cta 1 - - 20.10", link: "https://fb.me/2fJNLZGvz678WKt", dataCriacao: "20/10/2025", status: "Ativo", investimento: 396, ctr: 0.57, cpm: 84, leads: 6, cpl: 66, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743730450", adName: "TP919 - vv-black-friday-2025-1- body 1- hook3 - - 14.11", link: "https://fb.me/2641ITRv1UrTkPX", dataCriacao: "21/11/2025", status: "Pausado", investimento: 358, ctr: 0.83, cpm: 78, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120234887297990450", adName: "TP795 - vertical hook 4 body 1 cta 2 - - 06.10", link: "https://fb.me/1Q0GLEBIfhx7gMd", dataCriacao: "06/10/2025", status: "Pausado", investimento: 354, ctr: 1.57, cpm: 113, leads: 11, cpl: 32, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235998177230450", adName: "TP831 - hook 8 body 2 cta 2 - - 20.10", link: "https://fb.me/22MgVHNRWAndSZI", dataCriacao: "21/10/2025", status: "Pausado", investimento: 354, ctr: 0.78, cpm: 92, leads: 1, cpl: 354, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743710450", adName: "TP924 - vv-black-friday-2025-2- HOOK2 - - 14.11", link: "https://fb.me/21DILUGEWzsXBM4", dataCriacao: "21/11/2025", status: "Pausado", investimento: 315, ctr: 0.65, cpm: 62, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120236070725090450", adName: "TP862 - HOOK4body2cta1V_generico - - 21.10", link: "https://fb.me/2cEWV1TNEYBIuWD", dataCriacao: "21/10/2025", status: "Ativo", investimento: 304, ctr: 0.93, cpm: 134, leads: 3, cpl: 101, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743750450", adName: "TP921 - vv-black-friday-2025-1- body 2- hook 2 - - 14.11", link: "https://fb.me/2gxPR0z6Zu1QRJS", dataCriacao: "21/11/2025", status: "Pausado", investimento: 289, ctr: 0.53, cpm: 73, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "756359602987_1", adName: "Anúncio #2 - 3 Metricas (YouTube)", link: "https://www.youtube.com/watch?v=lVOifVaz5-Y", dataCriacao: "04/06/2025", status: "Ativo", investimento: 240, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "756359602987_2", adName: "Anúncio #2 - 3 Metricas (YouTube)", link: "https://www.youtube.com/watch?v=w_u6dYLfM40", dataCriacao: "04/06/2025", status: "Ativo", investimento: 240, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235997280950450", adName: "TP818 - vertical hook 4 body 2 cta 1 - - 20.10", link: "https://fb.me/2dT6vTnPG8esICD", dataCriacao: "20/10/2025", status: "Pausado", investimento: 199, ctr: 1.00, cpm: 95, leads: 4, cpl: 50, mql: 0, percMql: 0, cpmql: null, ra: 1, percRa: 25, cpra: 199, percRaMql: 100, rr: 2, percRr: 200, cprr: 99.38, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120234744115470450", adName: "TP782 - CREATORS HOOK 3 REELS - - 03.10", link: "https://fb.me/1YrzMc8gTtDuDXq", dataCriacao: "03/10/2025", status: "Pausado", investimento: 197, ctr: 1.45, cpm: 151, leads: 2, cpl: 99, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743780450", adName: "TP920 - vv-black-friday-2025-1- body 2- hook 1 - - 14.11", link: "https://fb.me/1QOdlFUw05AcDS7", dataCriacao: "21/11/2025", status: "Pausado", investimento: 190, ctr: 0.81, cpm: 102, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235996076220450", adName: "TP825 - hook 2 body 2 cta 2 - - 20.10", link: "https://fb.me/227RwX9JwtHmLCS", dataCriacao: "20/10/2025", status: "Pausado", investimento: 177, ctr: 0.93, cpm: 117, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120237695786230450", adName: "TP890 - hook1body1cta1V - - 13.10", link: "https://fb.me/22jcaXcNxWIa9bU", dataCriacao: "13/11/2025", status: "Ativo", investimento: 166, ctr: 0.64, cpm: 71, leads: 1, cpl: 166, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120237699466620450", adName: "TP902 - hOOK1BODY2CTA2 - - 13.10", link: "https://fb.me/1R8MeF5DEoKrXsp", dataCriacao: "13/11/2025", status: "Ativo", investimento: 164, ctr: 0.90, cpm: 105, leads: 1, cpl: 164, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120233787942130450", adName: "TP774 - vv-creators-esther-hook3-estudio - - 17.09", link: "https://fb.me/1ZCM2fNvI2o2Suq", dataCriacao: "17/09/2025", status: "Pausado", investimento: 155, ctr: 1.12, cpm: 133, leads: 2, cpl: 77, mql: 0, percMql: 0, cpmql: null, ra: 1, percRa: 50, cpra: 155, percRaMql: 0, rr: 1, percRr: 100, cprr: 154.58, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: 0, cacUnico: null },
  { id: "120233674303770450", adName: "TP754 - vv-remarketing-esther- insta - 2x - 3h - - 15.09", link: "https://fb.me/26YHzEd82aK8fU6", dataCriacao: "15/09/2025", status: "Pausado", investimento: 140, ctr: 1.25, cpm: 175, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 1, percRa: null, cpra: 140, percRaMql: 0, rr: 0, percRr: 0, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120237696152130450", adName: "TP895 - HOOK2BODY2CTA1V - - 13.10", link: "https://fb.me/2kusIpqEPso7jgT", dataCriacao: "13/11/2025", status: "Ativo", investimento: 124, ctr: 1.13, cpm: 87, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "756367601719_1", adName: "Anúncio #1 Pag Alta Conversão (YouTube)", link: "https://www.youtube.com/watch?v=lVOifVaz5-Y", dataCriacao: "04/06/2025", status: "Ativo", investimento: 119, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "756367601719_2", adName: "Anúncio #1 Pag Alta Conversão (YouTube)", link: "https://www.youtube.com/watch?v=w_u6dYLfM40", dataCriacao: "04/06/2025", status: "Ativo", investimento: 119, ctr: null, cpm: null, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120235997280990450", adName: "TP828 - hook 5 body 2 cta 2 - - 20.10", link: "https://fb.me/24XweWiHCFZZxMV", dataCriacao: "20/10/2025", status: "Ativo", investimento: 118, ctr: 0.73, cpm: 107, leads: 1, cpl: 118, mql: 0, percMql: 0, cpmql: null, ra: 0, percRa: 0, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120238257743790450", adName: "TP918 - vv-black-friday-2025-1- body 1- hook2 - - 14.11", link: "https://fb.me/220GR4Mk8TWnjSZ", dataCriacao: "21/11/2025", status: "Pausado", investimento: 117, ctr: 0.65, cpm: 85, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
  { id: "120237764689040450", adName: "TP915 - vv-esther-creators-remarketing - 2x - - 14.11", link: "https://fb.me/1QxCsKwXPQLE7L8", dataCriacao: "14/11/2025", status: "Ativo", investimento: 107, ctr: 0.90, cpm: 137, leads: 0, cpl: null, mql: 0, percMql: null, cpmql: null, ra: 0, percRa: null, cpra: null, percRaMql: null, rr: 0, percRr: null, cprr: null, ganhosAceleracao: null, ganhosPontuais: null, cacAceleracao: null, leadTimeClienteUnico: null, clientesUnicos: 0, percRrCliente: null, cacUnico: null },
];

const statusOptions = ["Todos", "Ativo", "Pausado"];

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return '-';
  return `${value.toFixed(2)}%`;
}

function getHeatmapColor(value: number | null, min: number, max: number, invert: boolean = false): string {
  if (value === null || max === min) return "transparent";
  const ratio = (value - min) / (max - min);
  const adjustedRatio = invert ? 1 - ratio : ratio;
  
  if (adjustedRatio < 0.2) {
    return invert ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.15)";
  } else if (adjustedRatio < 0.4) {
    return invert ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.25)";
  } else if (adjustedRatio < 0.6) {
    return "rgba(234, 179, 8, 0.2)";
  } else if (adjustedRatio < 0.8) {
    return invert ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)";
  } else {
    return invert ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)";
  }
}

export default function Criativos() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [adStatus, setAdStatus] = useState("Todos");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const filteredData = useMemo(() => {
    let data = [...rawData];
    
    if (searchTerm) {
      data = data.filter(item => 
        item.adName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (adStatus !== "Todos") {
      data = data.filter(item => item.status === adStatus);
    }
    
    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return data;
  }, [searchTerm, adStatus, sortConfig]);

  const totals = useMemo(() => {
    return {
      investimento: filteredData.reduce((acc, item) => acc + item.investimento, 0),
      leads: filteredData.reduce((acc, item) => acc + item.leads, 0),
      mql: filteredData.reduce((acc, item) => acc + item.mql, 0),
      ra: filteredData.reduce((acc, item) => acc + item.ra, 0),
      rr: filteredData.reduce((acc, item) => acc + item.rr, 0),
      clientesUnicos: filteredData.reduce((acc, item) => acc + item.clientesUnicos, 0),
    };
  }, [filteredData]);

  const ranges = useMemo(() => {
    const validInvestimento = filteredData.map(d => d.investimento);
    const validCpm = filteredData.map(d => d.cpm).filter((v): v is number => v !== null);
    const validCtr = filteredData.map(d => d.ctr).filter((v): v is number => v !== null);
    const validCpmql = filteredData.map(d => d.cpmql).filter((v): v is number => v !== null);
    const validPercMql = filteredData.map(d => d.percMql).filter((v): v is number => v !== null);
    const validPercRr = filteredData.map(d => d.percRr).filter((v): v is number => v !== null);
    
    return {
      investimento: { min: Math.min(...validInvestimento), max: Math.max(...validInvestimento) },
      cpm: { min: validCpm.length ? Math.min(...validCpm) : 0, max: validCpm.length ? Math.max(...validCpm) : 0 },
      ctr: { min: validCtr.length ? Math.min(...validCtr) : 0, max: validCtr.length ? Math.max(...validCtr) : 0 },
      cpmql: { min: validCpmql.length ? Math.min(...validCpmql) : 0, max: validCpmql.length ? Math.max(...validCpmql) : 0 },
      percMql: { min: validPercMql.length ? Math.min(...validPercMql) : 0, max: validPercMql.length ? Math.max(...validPercMql) : 0 },
      percRr: { min: validPercRr.length ? Math.min(...validPercRr) : 0, max: validPercRr.length ? Math.max(...validPercRr) : 0 },
    };
  }, [filteredData]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Rocket className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Growth | Criativos</h1>
            <p className="text-sm text-muted-foreground">Plano de Mídia 2025 Turbo - Análise de Criativos</p>
          </div>
          <Badge variant="outline" className="ml-2 bg-green-500/10 text-green-600 border-green-500/30">
            <TrendingUp className="w-3 h-3 mr-1" />
            Safra
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-date-range">
                <CalendarIcon className="w-4 h-4" />
                {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })}
                {" - "}
                {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ad Name:</span>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar anúncio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-[250px]"
              data-testid="input-search-ad"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchTerm("")}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={adStatus} onValueChange={setAdStatus}>
            <SelectTrigger className="w-[120px]" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Total Investido:</span>
            <span className="font-bold text-primary">{formatCurrency(totals.investimento)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Leads:</span>
            <span className="font-semibold">{totals.leads}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">MQL:</span>
            <span className="font-semibold">{totals.mql}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">RR:</span>
            <span className="font-semibold">{totals.rr}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Clientes:</span>
            <span className="font-semibold">{totals.clientesUnicos}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Performance de Criativos
              <Badge variant="secondary" className="ml-2">{filteredData.length} anúncios</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[320px]">
                      <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => handleSort('adName')}>
                        Criativo
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap w-[80px]">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('investimento')}>
                        Investimento
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">CTR</TableHead>
                    <TableHead className="text-right whitespace-nowrap">CPM</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('leads')}>
                        Leads
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">CPL</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('mql')}>
                        MQL
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">% MQL</TableHead>
                    <TableHead className="text-right whitespace-nowrap">CPMQL</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('ra')}>
                        RA
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">% RA</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('rr')}>
                        RR
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">% RR</TableHead>
                    <TableHead className="text-right whitespace-nowrap">CPRR</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleSort('clientesUnicos')}>
                        Clientes
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-center whitespace-nowrap w-[50px]">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30" data-testid={`row-criativo-${row.id}`}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium max-w-[320px]">
                        <div className="truncate" title={row.adName}>{row.adName}</div>
                        <div className="text-xs text-muted-foreground">{row.dataCriacao}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={row.status === 'Ativo' ? 'default' : 'secondary'}
                          className={row.status === 'Ativo' ? 'bg-green-500/20 text-green-600 border-green-500/30' : 'bg-gray-500/20 text-gray-500'}
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell 
                        className="text-right font-semibold"
                        style={{ backgroundColor: getHeatmapColor(row.investimento, ranges.investimento.min, ranges.investimento.max, false) }}
                      >
                        {formatCurrency(row.investimento)}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: getHeatmapColor(row.ctr, ranges.ctr.min, ranges.ctr.max, false) }}
                      >
                        {row.ctr !== null ? `${row.ctr.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: getHeatmapColor(row.cpm, ranges.cpm.min, ranges.cpm.max, true) }}
                      >
                        {row.cpm !== null ? formatCurrency(row.cpm) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.leads > 0 ? row.leads : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.cpl !== null ? formatCurrency(row.cpl) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {row.mql > 0 ? row.mql : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: getHeatmapColor(row.percMql, ranges.percMql.min, ranges.percMql.max, false) }}
                      >
                        {row.percMql !== null ? `${row.percMql}%` : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: getHeatmapColor(row.cpmql, ranges.cpmql.min, ranges.cpmql.max, true) }}
                      >
                        {row.cpmql !== null ? formatCurrency(row.cpmql) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.ra > 0 ? row.ra : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.percRa !== null ? `${row.percRa}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {row.rr > 0 ? row.rr : '-'}
                      </TableCell>
                      <TableCell 
                        className="text-right"
                        style={{ backgroundColor: getHeatmapColor(row.percRr, ranges.percRr.min, ranges.percRr.max, false) }}
                      >
                        {row.percRr !== null ? `${row.percRr.toFixed(2)}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.cprr !== null ? formatCurrency(row.cprr) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {row.clientesUnicos > 0 ? row.clientesUnicos : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <a 
                          href={row.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted"
                          data-testid={`link-criativo-${row.id}`}
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-muted/50 z-10">TOTAL</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.investimento)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{totals.leads}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right">{totals.mql}</TableCell>
                    <TableCell className="text-right">{totals.leads > 0 ? `${((totals.mql / totals.leads) * 100).toFixed(0)}%` : '-'}</TableCell>
                    <TableCell className="text-right">{totals.mql > 0 ? formatCurrency(totals.investimento / totals.mql) : '-'}</TableCell>
                    <TableCell className="text-right">{totals.ra}</TableCell>
                    <TableCell className="text-right">{totals.leads > 0 ? `${((totals.ra / totals.leads) * 100).toFixed(0)}%` : '-'}</TableCell>
                    <TableCell className="text-right text-green-600">{totals.rr}</TableCell>
                    <TableCell className="text-right">{totals.ra > 0 ? `${((totals.rr / totals.ra) * 100).toFixed(0)}%` : '-'}</TableCell>
                    <TableCell className="text-right">{totals.rr > 0 ? formatCurrency(totals.investimento / totals.rr) : '-'}</TableCell>
                    <TableCell className="text-right">{totals.clientesUnicos}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
