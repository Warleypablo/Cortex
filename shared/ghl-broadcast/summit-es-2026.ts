/**
 * Plano de broadcasts do Creator Summit ES 2026 (evento: seg 03/08/2026, Brizz, Vitória/ES).
 * Fonte: Planejamento_Broadcasts_Creator_Summit_ES.docx (v2, 06/07/2026).
 *
 * Campanha FECHADA de 4 semanas — as copies viram templates aprovados na Meta,
 * então o plano vive versionado aqui (não é editável no painel). A aba Summit ES
 * do CRM Marketing renderiza este arquivo: mudou o plano → atualiza aqui.
 *
 * Estrutura: 4 ondas de venda (base fria fracionada A–D, cupom próprio por onda)
 * + follow-ups sex/sáb + régua paralela de contagem regressiva pra quem já comprou
 * (tag [compra]_creators_summit_es — lista viva).
 */

export type SummitDisparoTipo = "onda" | "followup" | "contagem";

export interface SummitDisparo {
  data: string; // YYYY-MM-DD
  tipo: SummitDisparoTipo;
  onda?: 1 | 2 | 3 | 4;
  fracao?: "A" | "B" | "C" | "D" | "Todas";
  publico: string;
  cupom?: string;
  titulo: string;
  copy: string;
  variantes?: Array<{ label: string; copy: string }>;
  obs?: string;
  opcional?: boolean;
}

export const SUMMIT_INFO = {
  evento: "Creator Summit ES 2026",
  dataEvento: "2026-08-03",
  local: "Brizz, Vitória/ES",
  ingressos: "~300 ingressos · Pass R$297 / VIP R$2.997 (VIP fora de broadcast frio — régua 1:1)",
  base: "6.146 contatos DDD 27/28 pra broadcast (de 6.471 mapeados: −31 compradores, −279 clientes p/ régua de 15%, −15 duplicados)",
  regras: [
    "Máx. 2 mensagens por contato por semana (1 disparo + 1 follow-up), sempre com texto diferente",
    "Horários de envio: 10h–12h ou 18h–20h",
    "Quem pedir pra sair não entra em nenhuma onda seguinte",
    "Fração inteira (~1.540) no mesmo dia via API oficial — espaçar em 2–3 blocos pra não afogar os SDRs",
    "Clientes ficam FORA (recebem régua própria com cupom de 15% — clientes_ddd27_28_regua_15.csv)",
  ],
  fracoes: [
    { fracao: "A", contatos: 1537, dia: "Segunda-feira" },
    { fracao: "B", contatos: 1537, dia: "Terça-feira" },
    { fracao: "C", contatos: 1536, dia: "Quarta-feira" },
    { fracao: "D", contatos: 1536, dia: "Quinta-feira" },
  ],
  utm: "utm_source=whatsapp&utm_medium=broadcast&utm_campaign=onda1 (2, 3, 4) — cupom mede a VENDA, UTM mede o CLIQUE",
} as const;

export const SUMMIT_CUPONS = [
  { onda: 1, cupom: "SUMMIT10", validade: "até dom 12/07", mede: "Conversão do convite inicial" },
  { onda: 2, cupom: "MANU10", validade: "até sex 17/07", mede: "Força do ângulo headliner/lineup" },
  { onda: 3, cupom: "BORA10", validade: "até dom 26/07", mede: "Força do ângulo case/playbook" },
  { onda: 4, cupom: "AGORA10", validade: "até dom 02/08, 12h", mede: "Urgência da última semana" },
] as const;

export const SUMMIT_METAS = [
  { metrica: "Entrega", meta: "≥ 95%", seFicarAbaixo: "Higienizar a base (números inválidos)" },
  { metrica: "Leitura", meta: "≥ 60%", seFicarAbaixo: "Testar outro horário de envio" },
  { metrica: "Resposta (Onda 1)", meta: "≥ 8%", seFicarAbaixo: "Trocar o gancho/CTA antes da próxima fração" },
  { metrica: "Clique (Ondas 2–4)", meta: "≥ 5%", seFicarAbaixo: "Testar outro ângulo na fração seguinte" },
  { metrica: "Opt-out", meta: "≤ 2%", seFicarAbaixo: "Reduzir frequência e rever tom da copy" },
  { metrica: "Vendas por cupom", meta: "por onda e fração", seFicarAbaixo: "Dobrar a aposta na copy vencedora na Onda 4" },
] as const;

const ONDA1_COPY =
  "A Manu Cit escolheu Vitória pra abrir o jogo — e vai ser na tua frente 👀\n\nDia 03/08, ela sobe no palco do primeiro Creator Summit ES junto com Creamy, True, Bready e +100 marcas. O maior evento de creator economy que o Espírito Santo já viu, um dia inteiro no Brizz.\n\nO primeiro lote tá voando — e quem garantir agora ainda leva um cupom de 10% 🔥\n\nResponde BORA que a gente te manda a programação completa + o cupom 😉";

const ONDA1_VARIANTES = [
  { label: "Hook V2 (teste A/B entre frações)", copy: "Ela transformou milhões de seguidores em um império. E dia 03/08 vai contar como — a poucos metros de você 🔥" },
  { label: "Hook V3 (teste A/B entre frações)", copy: "O ES nunca recebeu um evento assim. E a Manu Cit é só o começo 👀" },
];

const ONDA1_OBS =
  "SEM LINK de propósito: o link só vai na resposta (aumenta taxa de resposta e protege a reputação do número). Quem responder BORA cai no SDR, que manda programação + link com o cupom SUMMIT10. Deixar mini-roteiro pro time com lineup e link. SLA de 15 min nos dias de disparo.";

const ONDA2_COPY =
  "Já pensou perguntar pra Manu Cit, ao vivo, como ela transformou audiência em marca? 👀\n\nDia 03/08 dá: ela sobe no palco do Creator Summit ES pra responder \"minha marca precisa ter um rosto?\" — e você pode tá na plateia.\n\nE o line não para:\n🧴 Creamy e True abrindo os bastidores de quem opera com creators em escala\n🚀 Bready contando como foi do zero a R$1,5M/mês\n🎤 + fundadores e CMOs de quem tá construindo a creator economy no Brasil\n\nMenos de 300 lugares no Brizz. Cupom MANU10 te dá 10% até sexta: {link}";

const ONDA3_COPY =
  "Do zero a R$1,5M/mês com creators. Essa é a história da Bready — e eles vão abrir o playbook no palco dia 03/08 🤯\n\nJunto: Creamy e True mostrando contrato, briefing e métrica de quem já opera com creators em escala, e Manu Cit contando como transformou audiência em marca. Fora a tarde inteira de networking entre marcas e creators capixabas.\n\nFaltam 2 semanas e os ingressos tão acabando. Cupom BORA10 (10%) até domingo — e levando 3+ do time, o desconto sobe: {link}";

const ONDA3_OBS =
  "Desconto progressivo de grupo entra como argumento (3 ingressos = 10%, 5 = 20%, 10+ = 30%) — voltado a empresários levando o time. Confirmar internamente se o case Bready \"do zero a R$1,5M/mês\" pode ser usado publicamente.";

const ONDA4_COPY =
  "É SEMANA QUE VEM! 🚨\n\nSegunda (03/08) o Brizz vira o QG da creator economy: Manu Cit, Creamy, True, Bready e +100 marcas.\n\nÚltimos ingressos e último cupom: AGORA10 (10%) até domingo ao meio-dia. Depois é preço cheio — se sobrar lugar 👀 {link}";

const fracaoDia: Record<string, string> = { A: "seg", B: "ter", C: "qua", D: "qui" };

function ondaFracoes(onda: 1 | 2 | 3 | 4, datas: [string, string, string, string], cupom: string, titulo: string, copy: string, extra?: Partial<SummitDisparo>): SummitDisparo[] {
  return (["A", "B", "C", "D"] as const).map((f, i) => ({
    data: datas[i],
    tipo: "onda" as const,
    onda,
    fracao: f,
    publico: `Fração ${f} (~${SUMMIT_INFO.fracoes[i].contatos} contatos, ${fracaoDia[f]})`,
    cupom,
    titulo: `Onda ${onda} · Fração ${f} — ${titulo}`,
    copy,
    ...extra,
  }));
}

export const SUMMIT_DISPAROS: SummitDisparo[] = [
  // ── Semana 1 (06–12/07) · Onda 1: convite + gatilho de resposta ─────────
  ...ondaFracoes(1, ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09"], "SUMMIT10", "Convite + gatilho \"BORA\"", ONDA1_COPY, { variantes: ONDA1_VARIANTES, obs: ONDA1_OBS }),
  {
    data: "2026-07-10", tipo: "followup", onda: 1, cupom: "SUMMIT10",
    publico: "Quem NÃO respondeu (disparou − respondeu − clicou − comprou)",
    titulo: "Follow-up Onda 1 (sexta)",
    copy: "Não some não! 😅 Manu Cit, Creamy, True, Bready e +100 marcas, tudo dia 03/08 no Brizz. Teu cupom SUMMIT10 (10% off) morre domingo. Bora garantir? {link}",
  },
  {
    data: "2026-07-11", tipo: "followup", onda: 1, cupom: "SUMMIT10",
    publico: "Quem NÃO respondeu (continuação de sexta)",
    titulo: "Follow-up Onda 1 (sábado)",
    copy: "Não some não! 😅 Manu Cit, Creamy, True, Bready e +100 marcas, tudo dia 03/08 no Brizz. Teu cupom SUMMIT10 (10% off) morre domingo. Bora garantir? {link}",
  },

  // ── Semana 2 (13–19/07) · Onda 2: lineup / headliner Manu Cit ───────────
  ...ondaFracoes(2, ["2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16"], "MANU10", "Lineup / headliner Manu Cit", ONDA2_COPY),
  {
    data: "2026-07-17", tipo: "followup", onda: 2, cupom: "MANU10",
    publico: "Quem não clicou/respondeu/comprou",
    titulo: "Follow-up Onda 2 — prova social (PREENCHER o % real)",
    copy: "[X]% dos ingressos já voaram 🚀 Tava esperando um sinal? É esse. O MANU10 (10% off) morre HOJE: {link}",
    obs: "Preencher o [X]% com o número real de ingressos vendidos antes de subir.",
  },

  // ── Semana 3 (20–26/07) · Onda 3: case Bready / playbook + grupo ────────
  ...ondaFracoes(3, ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23"], "BORA10", "Case Bready / playbook + desconto de grupo", ONDA3_COPY, { obs: ONDA3_OBS }),
  {
    data: "2026-07-24", tipo: "followup", onda: 3, cupom: "BORA10",
    publico: "Quem não clicou/respondeu/comprou",
    titulo: "Follow-up Onda 3 (curto)",
    copy: "O ES nunca viu isso: 100 marcas + 250 creators + Manu Cit, tudo no mesmo dia, no Brizz 🔥 Teu cupom BORA10 (10%) morre domingo: {link}",
  },

  // ── Semana 4 (27/07–02/08) · Onda 4: última chamada / escassez ──────────
  ...ondaFracoes(4, ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"], "AGORA10", "Última chamada / escassez", ONDA4_COPY),
  {
    data: "2026-07-31", tipo: "followup", onda: 4, fracao: "Todas", cupom: "AGORA10",
    publico: "BASE TODA, em lotes ao longo do dia",
    titulo: "Últimas 48h — base toda",
    copy: "Últimas 48h ⏰ Segunda é dia de Creator Summit! Manu Cit e 100 marcas te esperando no Brizz. Teu cupom AGORA10 (10%) expira domingo ao meio-dia: {link}",
  },
  {
    data: "2026-08-02", tipo: "followup", onda: 4, cupom: "AGORA10", opcional: true,
    publico: "Só quem interagiu e NÃO comprou",
    titulo: "\"É amanhã\" (OPCIONAL)",
    copy: "É AMANHÃ! 🎉 Última chance de entrar pro primeiro Creator Summit da história do ES: {link}",
  },

  // ── Contagem regressiva — quem JÁ COMPROU (tag [compra]_creators_summit_es, lista viva) ──
  {
    data: "2026-07-06", tipo: "contagem", publico: "Compradores (lista viva pela tag)",
    titulo: "Faltam 4 semanas — boas-vindas · CTA: grupo dos confirmados",
    copy: "Teu lugar no primeiro Creator Summit ES tá garantido 🎟️\nFaltam 4 semanas pro dia 03/08 no Brizz. Daqui até lá a gente vai soltando programação, bastidores e uns perrengues chics pra você chegar craque.\nResponde CONFIRMADO que a gente te coloca no grupo de quem já tá dentro 🔥",
    obs: "Essa mensagem cria o grupo dos confirmados — vira o canal anti-no-show até o dia.",
  },
  {
    data: "2026-07-13", tipo: "contagem", publico: "Compradores",
    titulo: "Faltam 3 semanas — hype de lineup · CTA: pergunta pra Manu Cit",
    copy: "Faltam 3 semanas 🗓️ Manu Cit, Creamy, True, Bready e +100 marcas te esperando dia 03/08.\nAproveita e já pensa: o que você quer descobrir lá? Os melhores insights saem de quem vai com pergunta na cabeça.\nManda aqui a pergunta que você faria pra Manu Cit — pode ser que a gente leve pro palco 👀",
  },
  {
    data: "2026-07-19", tipo: "contagem", publico: "Compradores",
    titulo: "Faltam 15 dias — abre a contagem + logística · CTA: ver programação",
    copy: "⏳ 15 dias pro Creator Summit ES!\nAnota: 03/08, segunda, no Brizz (Vitória). É dia inteiro — chega com a manhã livre e o celular carregado pra fazer networking e registrar tudo.\nProgramação completa aqui 👉 {link}",
    obs: "Nos marcos de 15 e 10 dias cabe CTA alternativo de indicação: \"chama um parceiro pra ir com você\".",
  },
  {
    data: "2026-07-24", tipo: "contagem", publico: "Compradores",
    titulo: "Faltam 10 dias — como aproveitar melhor · CTA: \"EU VOU\"",
    copy: "Faltam 10 dias 🚀\nDica de quem já vai: leve cartão (digital vale), 2 boas perguntas e disposição pra trocar ideia com marca e creator. O Summit rende o dobro pra quem chega pronto pra conectar.\nResponde EU VOU pra gente já contar contigo 🙌",
    obs: "Entre os marcos de 10 e 5 dias: toque 1:1 do SDR oferecendo upgrade VIP (R$2.997) pra quem tem Pass — fora do broadcast.",
  },
  {
    data: "2026-07-29", tipo: "contagem", publico: "Compradores",
    titulo: "Faltam 5 dias — semana do evento · CTA: tirar dúvida de logística",
    copy: "É NA PRÓXIMA SEMANA 🔥 5 dias pro Creator Summit ES.\nSegunda (03/08) o Brizz vira o QG da creator economy do ES. Já vai se organizando: avisa no trampo, ajeita a agenda e garante que nada vai te tirar de lá.\nDúvida de horário, local ou estacionamento? Responde aqui 👇",
  },
  {
    data: "2026-07-31", tipo: "contagem", publico: "Compradores",
    titulo: "Faltam 3 dias — logística final · CTA: como chegar",
    copy: "Faltam 3 dias! 🎉 Segunda é dia de Summit.\nLocal: Brizz, Vitória. Chega com antecedência pra pegar seu credenciamento sem correria — os primeiros a chegar pegam os melhores lugares e os melhores papos.\nVê como chegar aqui 👉 {link}",
  },
  {
    data: "2026-08-01", tipo: "contagem", publico: "Compradores",
    titulo: "Faltam 2 dias — preparação · CTA leve de engajamento",
    copy: "48h ⏰ Depois de amanhã você tá dentro do primeiro Creator Summit da história do ES.\nSepara a roupa, carrega o celular e já deixa o despertador armado. Segunda vai ser grande 🔥\nResponde 🔥 se tá contando os dias igual a gente",
  },
  {
    data: "2026-08-02", tipo: "contagem", publico: "Compradores",
    titulo: "É amanhã — véspera + horário · CTA: salvar localização (PREENCHER [HORÁRIO])",
    copy: "É AMANHÃ! 🤩 Segunda, 03/08, Brizz, Vitória.\nManu Cit, Creamy, True, Bready e +100 marcas. Credenciamento abre [HORÁRIO] — chega cedo. Dorme cedo hoje que amanhã é dia cheio 😎\nSalva a localização e o horário aqui 👉 {link}",
    obs: "Preencher o [HORÁRIO] do credenciamento antes de subir como template.",
  },
  {
    data: "2026-08-03", tipo: "contagem", publico: "Compradores",
    titulo: "É HOJE — bom Summit + suporte no dia · CTA: responder aqui",
    copy: "É HOJE! 🎉🔥 O Creator Summit ES começa hoje no Brizz.\nTraz energia, traz pergunta e vem trocar ideia com a gente. Bom Summit! 🚀\nQualquer coisa durante o dia, é só responder aqui 👇",
  },
];

export const SUMMIT_CHECKLIST = [
  { item: "Base mapeada (6.146) e fracionada — base_broadcast_ddd27_28_fracionada.csv", feito: true },
  { item: "Compradores, clientes (régua 15%) e duplicados removidos", feito: true },
  { item: "Criar os 4 cupons no checkout com as validades da seção de cupons", feito: false },
  { item: "Criar trigger links rastreáveis (com UTM) por onda no CRM — habilita o follow-up \"não clicou\"", feito: false },
  { item: "Submeter as copies como templates na API oficial do WhatsApp (aprovação Meta — enviar com antecedência)", feito: false },
  { item: "Teste com 20–30 contatos internos antes da Fração A", feito: false },
  { item: "Alinhar SDRs: mini-roteiro da Onda 1 (programação + link com cupom) e SLA de 15 min", feito: false },
  { item: "Aprovar as copies finais", feito: false },
] as const;
