/**
 * Calendário de datas comerciais BR pra planejamento de broadcasts.
 *
 * Datas fixas (Natal, Namorados…) e móveis (Mães, Pais, Black Friday, Carnaval/Páscoa)
 * calculadas por ano. Cada data tem uma janela de antecedência recomendada pra começar
 * a comunicar. Editável: é só ajustar a lista DATAS_FIXAS / DATAS_MOVEIS.
 */

export interface DataComercial {
  nome: string;
  /** YYYY-MM-DD */
  data: string;
  /** dias antes da data em que faz sentido começar a comunicar */
  antecedenciaDias: number;
  /** dica curta de ângulo/oferta */
  dica?: string;
  /** gancho de copy estilo Turbo (reframe pro empresário) — usado pela geração de copy */
  gancho?: string;
  /** varejo | conscientizacao | setorial | sazonal */
  categoria?: string;
}

// ── Helpers de data ─────────────────────────────────────────────────────────

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** N-ésimo dia-da-semana (0=dom…6=sáb) de um mês. */
function nthWeekday(year: number, month1: number, weekday: number, n: number): Date {
  const d = new Date(Date.UTC(year, month1 - 1, 1));
  const shift = (7 + weekday - d.getUTCDay()) % 7;
  d.setUTCDate(1 + shift + (n - 1) * 7);
  return d;
}

/** Último dia-da-semana de um mês. */
function lastWeekday(year: number, month1: number, weekday: number): Date {
  const d = new Date(Date.UTC(year, month1, 0)); // último dia do mês
  const shift = (7 + d.getUTCDay() - weekday) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const toYmd = (d: Date) => ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

// ── Catálogo ──────────────────────────────────────────────────────────────

const DATAS_FIXAS: Array<Omit<DataComercial, "data"> & { mes: number; dia: number }> = [
  { nome: "Janeiro Branco (Saúde Mental)", mes: 1, dia: 1, antecedenciaDias: 7, categoria: "conscientizacao", gancho: "Janeiro Branco é sobre cuidar da cabeça. E a SUA cabeça de empresário? Ansiedade de dono é abrir o ano com a meta definida e a aquisição zerada, sem saber de onde vem o próximo cliente. A gente trata a causa: lead previsível todo mês pra você parar de acordar 3h da manhã pensando no faturamento." },
  { nome: "Liquidação / Recomeço de Janeiro", mes: 1, dia: 2, antecedenciaDias: 7, categoria: "sazonal", gancho: "Todo ano você jura que 'esse vai ser O ano'. Mas promessa não enche pipeline. Enquanto você ainda monta a planilha de meta, seu concorrente já liga a campanha no dia 2. Janeiro é o mês mais BARATO pra adquirir cliente o ano inteiro — o CPM ainda não subiu. Vamos travar sua máquina antes da disputa esquentar?" },
  { nome: "Volta às Aulas", mes: 1, dia: 20, antecedenciaDias: 14, categoria: "varejo", gancho: "Volta às aulas não é só papelaria. É o consumidor reabrindo a carteira depois das festas, com a cabeça em 'recomeço'. Quem captura essa intenção de compra com tráfego bem feito em janeiro fatura o ano inteiro. Sua oferta já tá no ar ou vai esperar fevereiro?" },
  { nome: "Dia do Publicitário", mes: 2, dia: 1, antecedenciaDias: 5, categoria: "setorial", gancho: "Dia de quem faz propaganda. Mas propaganda bonita que não vende é só arte cara pendurada na parede. Seu marketing tá gerando aplauso ou tá gerando reunião comercial agendada? A gente faz criativo pra performar, não pra ganhar prêmio em festival." },
  { nome: "Dia da Internet Segura", mes: 2, dia: 11, antecedenciaDias: 5, categoria: "conscientizacao", gancho: "Dia da Internet Segura. Pergunta direta: sua aquisição depende de UMA conta de anúncio, UM vendedor que sabe vender e UM perfil que você esqueceu de postar essa semana? Isso não é negócio seguro, é negócio na corda bamba. Growth existe pra você não ter ponto único de falha no que paga a folha." },
  { nome: "Dia Internacional da Mulher", mes: 3, dia: 8, antecedenciaDias: 14, categoria: "conscientizacao", gancho: "Dia da Mulher virou data de postar arte bonita e sumir no dia 9. O empresário esperto não vende a data, vende pra quem decide: 7 em cada 10 decisões de compra passam por mulheres. Sua comunicação fala COM ela o ano todo ou só faz homenagem genérica uma vez? A gente constrói copy e tráfego pro público que realmente compra." },
  { nome: "Dia do Consumidor", mes: 3, dia: 15, antecedenciaDias: 14, categoria: "varejo", gancho: "Dia do Consumidor é a Black Friday do 1º semestre — e quem não tem campanha montada vai assistir o concorrente vender. A venda acontece nos dias ANTES, não no dia. Você já tem oferta, criativo e tráfego prontos ou vai improvisar de novo na última hora?" },
  { nome: "Virada do 1º Trimestre (Q1)", mes: 4, dia: 1, antecedenciaDias: 10, categoria: "sazonal", gancho: "Fecha o Q1: você bateu a meta ou tá inventando a desculpa? Se não sabe de cor seu CAC e seu ROAS dos últimos 3 meses, não foi growth — foi sorte. E sorte não se repete no planejamento. Bora olhar o número real do trimestre e montar um Q2 que não dependa de torcida?" },
  { nome: "Dia Mundial da Atividade Física", mes: 4, dia: 6, antecedenciaDias: 3, categoria: "conscientizacao", gancho: "Marketing é igual academia: ninguém fica em forma treinando uma vez por mês quando lembra. A maioria dos empresários trata aquisição assim — anuncia quando o caixa aperta e para quando enche. Resultado vem de constância, não de surto. Quer um plano de treino pro seu funil rodar todo dia?" },
  { nome: "Dia Mundial da Saúde", mes: 4, dia: 7, antecedenciaDias: 7, categoria: "conscientizacao", gancho: "Todo mundo fala da saúde do corpo. Quase ninguém fala da SAÚDE DO SEU MARKETING. Quando foi seu último check-up de aquisição? Se você não sabe seu CAC, seu ROAS e de onde veio o último cliente, seu negócio tá com a pressão alta e você nem sentiu. Bora fazer o exame: diagnóstico de funil essa semana." },
  { nome: "Dia do Frete Grátis", mes: 4, dia: 28, antecedenciaDias: 7, categoria: "varejo", gancho: "Frete grátis não é desconto, é gatilho de conversão. A questão não é dar o frete — é ter funil pra transformar esse pico de visita em cliente recorrente. Tráfego sem CRM por trás é dinheiro escorrendo pelo ralo: você paga pela visita e o concorrente fica com a recompra." },
  { nome: "Prazo do Imposto de Renda", mes: 4, dia: 30, antecedenciaDias: 7, categoria: "sazonal", gancho: "Você corre atrás de cada nota pra não pagar multa pro Leão, mas deixa dinheiro na mesa todo mês com tráfego mal feito. A multa do IR é UMA vez por ano. A multa de não ter aquisição estruturada você paga TODO mês, em cliente que foi pro concorrente. Qual das duas dói mais no caixa?" },
  { nome: "Dia do Trabalho", mes: 5, dia: 1, antecedenciaDias: 7, categoria: "conscientizacao", gancho: "Feriado do Trabalho e seu negócio... trabalha mais que você? Quem não tem aquisição rodando no automático para de faturar quando para de aparecer. Empresa de verdade vende dormindo, vende no feriado, vende enquanto você toma sol. Se o seu só vende quando você empurra, você não tem empresa — tem emprego caro. A gente monta a máquina." },
  { nome: "Dia da Liberdade de Imprensa / Comunicação", mes: 5, dia: 3, antecedenciaDias: 3, categoria: "setorial", gancho: "Liberdade de comunicar é poder. Mas se sua marca só fala quando tem promoção, o mercado esquece de você no resto do mês. Quem comunica todo dia ocupa a cabeça do cliente antes do concorrente aparecer. Sua audiência tá sendo construída ou alugada com anúncio que para amanhã?" },
  { nome: "Dia da Indústria", mes: 5, dia: 25, antecedenciaDias: 7, categoria: "setorial", gancho: "Indústria boa não para a linha de produção esperando pedido cair do céu. Mas seu comercial para. Se você fabrica de mais e vende de menos, o gargalo não é a fábrica — é a aquisição que não abastece o funil. Vamos botar lead na esteira do seu time de vendas?" },
  { nome: "Dia do Orgulho Nerd", mes: 5, dia: 25, antecedenciaDias: 3, categoria: "conscientizacao", gancho: "Tem empresário que tem orgulho de não entender de número, de anúncio, de dado — 'isso é coisa de nerd'. E é justamente o nerd que tá comendo seu mercado: testando criativo, lendo CAC, otimizando funil enquanto você confia no feeling. Growth é nerdice aplicada a dinheiro. Bora ser o nerd que fatura?" },
  { nome: "Dia Mundial do Meio Ambiente", mes: 6, dia: 5, antecedenciaDias: 5, categoria: "conscientizacao", gancho: "Dia do Meio Ambiente: o papo é não desperdiçar recurso. E seu orçamento de mídia? Quanto da sua verba virou poluição — clique que não converteu, lead que ninguém ligou, post bonito que não vendeu nada? Desperdício de budget é o maior lixo do marketing. A gente recicla seu investimento em retorno rastreável." },
  { nome: "Dia dos Namorados", mes: 6, dia: 12, antecedenciaDias: 21, categoria: "varejo", gancho: "Namorados é a 3ª maior data do varejo brasileiro. O problema: todo mundo posta um coraçãozinho no dia 12 e acha que fez marketing. A venda acontece nos 21 dias ANTES. Você já tá rodando tráfego e oferta ou vai chegar atrasado de novo, brigando por migalha de última hora?" },
  { nome: "Dia do Profissional Liberal", mes: 6, dia: 24, antecedenciaDias: 5, categoria: "setorial", gancho: "Médico, advogado, arquiteto, dentista: você vende sua expertise mas depende de indicação que você não controla. Indicação é ótima, só que não é previsível — quando seca, a agenda esvazia. Quem constrói autoridade no digital para de torcer pra agenda lotar e passa a ESCOLHER cliente." },
  { nome: "Festa Junina", mes: 6, dia: 24, antecedenciaDias: 7, categoria: "sazonal", gancho: "Arraiá bom é o que tem fila na barraca. Negócio bom é o que tem fila de lead esperando atendimento. Se a sua 'quadrilha' de vendas dança sem música — sem lead novo entrando —, a festa acaba cedo e o caixa também. Bora botar gente na fila do seu comercial?" },
  { nome: "Dia do Orgulho LGBTQIA+", mes: 6, dia: 28, antecedenciaDias: 10, categoria: "conscientizacao", gancho: "Junho é o mês em que marca que nunca pensou no público acorda, pinta o logo de arco-íris e some em julho. Isso não é posicionamento, é oportunismo — e o consumidor sente o cheiro. Quem se posiciona o ano inteiro, com consistência e verdade, constrói marca. Quem pinta o logo uma vez constrói desconfiança." },
  { nome: "Virada de Semestre / 2º Semestre", mes: 7, dia: 1, antecedenciaDias: 14, categoria: "sazonal", gancho: "Acabou o 1º tempo do ano. Placar na metade: você tá ganhando ou empatando com a meta? Quem espera o último trimestre desesperado pra 'correr atrás' já perdeu. Sobram 6 meses pra virar o jogo — e dá pra dobrar a aquisição se a gente começar a estruturar AGORA, não em novembro." },
  { nome: "Dia do Comércio", mes: 7, dia: 16, antecedenciaDias: 7, categoria: "varejo", gancho: "Comércio que depende só de quem passa na porta tá refém da localização. Quem domina tráfego e CRM transforma o ponto físico em ponto de PARTIDA. Sua maior vitrine devia ser o feed, não a calçada. A diferença entre a loja que cresce e a que quebra hoje é quem domina aquisição digital." },
  { nome: "Semana do Brasil", mes: 9, dia: 7, antecedenciaDias: 10, categoria: "varejo", gancho: "Semana do Brasil é o esquenta oficial do 2º semestre de vendas. Quem testa criativo e escala verba AGORA chega na Black Friday com a máquina de aquisição azeitada. Quem deixa tudo pra novembro paga caro no leilão lotado, disputando o mesmo clique com todo mundo. Sai na frente?" },
  { nome: "Dia do Administrador", mes: 9, dia: 9, antecedenciaDias: 5, categoria: "setorial", gancho: "Você administra fluxo de caixa, estoque, equipe... e o marketing? Esse fica no 'a gente posta quando dá'. O que não tem processo, não escala. Aquisição precisa de gestão igual ao resto do negócio — com meta, número e responsável. Bora tirar seu marketing do improviso?" },
  { nome: "Dia do Cliente", mes: 9, dia: 15, antecedenciaDias: 14, categoria: "varejo", gancho: "No Dia do Cliente o mercado todo grita 'desconto'. Quem ganha é quem já tem a base segmentada e dispara a oferta certa pro cliente certo. Você tem CRM pra reativar quem JÁ comprou ou só vive caçando lead novo no escuro, pagando caro pra começar do zero toda vez?" },
  { nome: "Dia Internacional do Café", mes: 10, dia: 1, antecedenciaDias: 3, categoria: "conscientizacao", gancho: "Você toma 4 cafés por dia pra dar conta de fazer no braço o que uma máquina de aquisição faria sozinha. A cafeína te mantém de pé, mas não escala faturamento — só te deixa cansado mais rápido. Energia de dono é recurso finito; sistema de growth não dorme. Troca a adrenalina por estrutura." },
  { nome: "Outubro Rosa", mes: 10, dia: 1, antecedenciaDias: 14, categoria: "conscientizacao", gancho: "Outubro Rosa é sobre uma palavra que salva: prevenção. No seu negócio, prevenção é olhar o número ANTES do problema estourar. Churn subindo, CAC inflando, lead caindo — tudo dá sinal cedo, se você tiver o exame certo rodando. Empresa que só age quando o caixa dói já tá no estágio avançado." },
  { nome: "Virada do 3º Trimestre (Q3)", mes: 10, dia: 1, antecedenciaDias: 10, categoria: "sazonal", gancho: "Outubro chegou e o ano tá fechando. A pergunta não é mais 'quanto eu cresci', é 'dá tempo de bater a meta?'. Dá — se o seu funil tiver previsibilidade em vez de torcida. Vamos calcular quanto lead você precisa por dia até dezembro pra fechar o ano no azul?" },
  { nome: "Dia do Vendedor", mes: 10, dia: 1, antecedenciaDias: 5, categoria: "setorial", gancho: "Seu melhor vendedor passa o dia ligando pra contato frio? Tá queimando talento e dinheiro. Vendedor bom FECHA — quem aquece e qualifica é o marketing e o CRM. Entrega lead pronto pro time e vê a taxa de fechamento subir sem contratar mais ninguém." },
  { nome: "Dia do Empresário", mes: 10, dia: 5, antecedenciaDias: 14, categoria: "setorial", gancho: "Parabéns pra quem assumiu o risco de empreender. Agora a pergunta dura: se você tirar 30 dias de férias, o faturamento cai? Negócio que depende de você no operacional não é empresa, é um emprego que você criou pra si mesmo. Vamos colocar a aquisição pra rodar sem depender de você?" },
  { nome: "Dia da Saúde Mental", mes: 10, dia: 10, antecedenciaDias: 7, categoria: "conscientizacao", gancho: "Sabe o que tira o sono de empresário de verdade? Não saber se mês que vem entra cliente. Insegurança de faturamento é a maior fonte de ansiedade de dono de negócio — e quase ninguém trata a CAUSA. Previsibilidade de aquisição não é só dinheiro, é paz. A gente entrega as duas coisas." },
  { nome: "Dia das Crianças", mes: 10, dia: 12, antecedenciaDias: 14, categoria: "varejo", gancho: "No Dia das Crianças quem decide a compra é o adulto, mas quem pede é a criança. Se o seu criativo não fala com os dois, você tá queimando verba. UGC com família real converte muito mais que banner bonitinho de banco de imagem que ninguém acredita. Seu criativo tá pronto pra essa data?" },
  { nome: "Novembro Azul", mes: 11, dia: 1, antecedenciaDias: 14, categoria: "conscientizacao", gancho: "Novembro Azul existe porque homem foge de exame por orgulho — e o orgulho custa caro. No negócio é igual: empresário que tem vergonha de admitir que não entende de tráfego, que o comercial tá bagunçado, que não sabe o CAC, segura o problema até virar crise. Pedir ajuda cedo não é fraqueza, é gestão." },
  { nome: "Planejamento de Fim de Ano / Metas", mes: 11, dia: 1, antecedenciaDias: 14, categoria: "sazonal", gancho: "Novembro separa quem vai entrar no ano novo com previsibilidade de quem vai entrar rezando. O empresário amador faz planejamento em janeiro. O profissional já tá montando a máquina de aquisição do ano que vem AGORA — pra ligar a chave no dia 1º e não perder o mês mais barato. De que lado você quer estar?" },
  { nome: "Dia do MEI / Microempreendedor", mes: 11, dia: 5, antecedenciaDias: 5, categoria: "setorial", gancho: "Começou como MEI, hoje fatura alto e segue se vendendo como amador. Quem cresceu o caixa mas não cresceu a marca tá deixando dinheiro na mesa todo mês. Estrutura de aquisição não é luxo de empresa grande — é exatamente o que te tira do amadorismo e destrava o próximo nível." },
  { nome: "Dia Mundial do Diabetes", mes: 11, dia: 14, antecedenciaDias: 3, categoria: "conscientizacao", gancho: "O problema do diabetes é o açúcar que o corpo não consegue processar. Seu negócio tem o mesmo mal com LEAD — entra um monte de contato na base e o comercial não liga, não responde, não converte. Lead parado fermenta e azeda. A gente estrutura o CRM e o follow-up pra cada lead virar energia, não gordura." },
  { nome: "Dia do Empreendedorismo Feminino", mes: 11, dia: 19, antecedenciaDias: 7, categoria: "setorial", gancho: "Empreendedora que sabe entregar não é a mesma coisa que empreendedora que sabe vender. Produto excelente sem máquina de aquisição é segredo bem guardado, conhecido só por quem já é cliente. Hora do mercado descobrir o que você já faz de melhor — com tráfego e posicionamento que escalam." },
  { nome: "Dia da Consciência Negra", mes: 11, dia: 20, antecedenciaDias: 10, categoria: "conscientizacao", gancho: "Consciência é a palavra do dia. E consciência no negócio é parar de operar no escuro. Quantos empresários investem em anúncio sem saber qual criativo trouxe venda, qual canal dá lucro, qual campanha tá queimando dinheiro? Marketing sem dado é fé, não estratégia. A gente acende a luz: você vê de onde vem cada real." },
  { nome: "13º Salário / Pico de Consumo de Dezembro", mes: 12, dia: 1, antecedenciaDias: 14, categoria: "sazonal", gancho: "Em dezembro o Brasil inteiro recebe 13º e o dinheiro tá na rua. A única pergunta é: vai entrar no SEU caixa ou no do concorrente? Quem não tá com tráfego rodando e oferta na mão tá literalmente vendo o cliente passar com a carteira cheia e comprar do outro. Vamos capturar essa onda antes que passe?" },
  { nome: "Dia do Profissional de Marketing", mes: 12, dia: 12, antecedenciaDias: 7, categoria: "setorial", gancho: "Hoje é o dia de quem vive disso. Se você é empresário, a real é: você não precisa virar especialista em marketing, você precisa de um time que respira isso. Pare de aprender tráfego no YouTube às 23h depois de um dia inteiro de operação e delegue pra quem faz o dia todo." },
  { nome: "Fechamento de Ano Fiscal / Balanço", mes: 12, dia: 20, antecedenciaDias: 10, categoria: "sazonal", gancho: "Hora do balanço: você sabe exatamente quanto cada real investido em marketing te devolveu esse ano? Se a resposta é 'mais ou menos', você não tem um negócio — tem um cassino. No ano que vem a gente troca o achismo por dashboard: CAC, LTV e ROAS na palma da mão. Bora fechar sabendo o número de verdade?" },
  { nome: "Natal", mes: 12, dia: 25, antecedenciaDias: 21, categoria: "varejo", gancho: "No Natal o consumidor JÁ decidiu comprar — a única dúvida é de quem. Quem aparece com tráfego e oferta nos 3 fins de semana antes leva. Quem espera o dia 24 disputa migalha no desespero. Sua aquisição já tá no ar ou você ainda acha que dá tempo na véspera?" },
  { nome: "Réveillon / Metas de Ano Novo do Empresário", mes: 12, dia: 31, antecedenciaDias: 7, categoria: "sazonal", gancho: "Todo empresário faz meta de faturamento no dia 31. Pergunta difícil: você tem um PLANO de aquisição pra bater essa meta ou só um número bonito no papel? Meta sem máquina de gerar lead é desejo de fim de ano que morre em fevereiro. A diferença entre quem cumpre e quem repete a mesma meta é UM sistema. Quer começar o ano com ele ligado?" },
];

/** Retorna todas as datas comerciais de um ano (fixas + móveis), ordenadas. */
export function datasComerciaisDoAno(ano: number): DataComercial[] {
  const movel = (nome: string, data: Date, antecedenciaDias: number, gancho: string): DataComercial => ({
    nome, data: toYmd(data), antecedenciaDias, categoria: "varejo", gancho, dica: gancho,
  });
  const pascoa = easter(ano);
  const lista: DataComercial[] = [
    ...DATAS_FIXAS.map((f) => ({ nome: f.nome, data: ymd(ano, f.mes, f.dia), antecedenciaDias: f.antecedenciaDias, categoria: f.categoria, gancho: f.gancho ?? f.dica, dica: f.dica })),
    movel("Carnaval", addDays(pascoa, -47), 14, "O mercado para no Carnaval — quem deixa a aquisição rodando no automático sai na frente quando todo mundo volta."),
    movel("Páscoa", pascoa, 14, "Páscoa é sobre recomeço. Que tal renascer o seu funil de vendas neste trimestre?"),
    movel("Dia das Mães", nthWeekday(ano, 5, 0, 2), 21, "2ª maior data do varejo. Quem não preparou a campanha de aquisição agora, vai assistir o concorrente faturar."),
    movel("Dia dos Pais", nthWeekday(ano, 8, 0, 2), 21, "Data forte de vendas. Seu marketing está pronto pra capturar a demanda ou vai depender da sorte?"),
    movel("Black Friday", lastWeekday(ano, 11, 5), 21, "O maior pico de vendas do ano. Quem chega sem estrutura de aquisição queima verba; quem chega pronto multiplica."),
    movel("Cyber Monday", addDays(lastWeekday(ano, 11, 5), 3), 14, "A cauda da Black Friday ainda converte muito — se você tiver retargeting e CRM rodando."),
  ];
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Datas comerciais nos próximos `horizonteDias` a partir de `ref` (default: hoje). */
export function proximasDatasComerciais(ref: Date, horizonteDias = 45): DataComercial[] {
  const refYmd = toYmd(ref);
  const limite = toYmd(addDays(ref, horizonteDias));
  const anos = [ref.getUTCFullYear(), ref.getUTCFullYear() + 1];
  return anos
    .flatMap((a) => datasComerciaisDoAno(a))
    .filter((d) => d.data >= refYmd && d.data <= limite)
    .sort((a, b) => a.data.localeCompare(b.data));
}
