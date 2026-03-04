import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Users,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  Download,
  Printer,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  DollarSign,
  FileCheck,
  FileClock,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Colaborador {
  id: number;
  nome: string;
  cpf: string | null;
  cnpj: string | null;
  endereco: string | null;
  estado: string | null;
  cargo: string | null;
  setor: string | null;
  admissao: string | null;
  email: string | null;
  salario: string | null;
  patrimonio: string | null;
}

interface ContratoStatus {
  id: number;
  colaborador_id: number;
  colaborador_nome: string;
  colaborador_email: string | null;
  documento_id: string | null;
  status: string;
  data_envio: string;
  data_assinatura: string | null;
}

// Mapeamento de escopos por cargo - cada cargo tem seu escopo específico para cláusulas 1.1 e 1.1.1
const ESCOPOS_POR_CARGO: Record<string, { titulo: string; escopo: string }> = {
  "ANALISTA DE CX": {
    titulo: "ANALISTA DE CX",
    escopo: "garantir a experiência do cliente em todas as interações com a empresa, criar estratégia para melhorar a experiência do cliente, identificando e implementando soluções para corrigir problemas, fornecer informações precisas e atualizadas sobre os produtos e serviços oferecidos pela empresa, interagir com outras equipes da empresa, como a equipe de performance e vendas, para garantir que as necessidades dos clientes sejam atendidas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "CXCS": {
    titulo: "ANALISTA DE CX",
    escopo: "garantir a experiência do cliente em todas as interações com a empresa, criar estratégia para melhorar a experiência do cliente, identificando e implementando soluções para corrigir problemas, fornecer informações precisas e atualizadas sobre os produtos e serviços oferecidos pela empresa, interagir com outras equipes da empresa, como a equipe de performance e vendas, para garantir que as necessidades dos clientes sejam atendidas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "ANALISTA DE COMUNICAÇÃO": {
    titulo: "ANALISTA DE COMUNICAÇÃO",
    escopo: "gestão de redes sociais; produção e programação de conteúdo; elaboração de relatórios analíticos; planejamento de pautas e calendários editoriais; gestão de comunidades digitais; monitoramento de tendências e oportunidades de conteúdo; pesquisa de mercado para embasar estratégias de comunicação; acompanhamento de métricas e indicadores de performance, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "COMUNICAÇÃO": {
    titulo: "ANALISTA DE COMUNICAÇÃO",
    escopo: "gestão de redes sociais; produção e programação de conteúdo; elaboração de relatórios analíticos; planejamento de pautas e calendários editoriais; gestão de comunidades digitais; monitoramento de tendências e oportunidades de conteúdo; pesquisa de mercado para embasar estratégias de comunicação; acompanhamento de métricas e indicadores de performance, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "SOCIAL MEDIA": {
    titulo: "ANALISTA DE COMUNICAÇÃO",
    escopo: "gestão de redes sociais; produção e programação de conteúdo; elaboração de relatórios analíticos; planejamento de pautas e calendários editoriais; gestão de comunidades digitais; monitoramento de tendências e oportunidades de conteúdo; pesquisa de mercado para embasar estratégias de comunicação; acompanhamento de métricas e indicadores de performance, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "G&G": {
    titulo: "ANALISTA DE GENTE E GESTÃO",
    escopo: "recrutamento e seleção de talentos; condução de processos seletivos e entrevistas; acompanhamento de colaboradores; implementação de políticas de gestão de pessoas; desenvolvimento de programas de treinamento e capacitação; análise de clima organizacional; gestão de indicadores de RH; apoio à cultura organizacional, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "GENTE E GESTÃO": {
    titulo: "ANALISTA DE GENTE E GESTÃO",
    escopo: "recrutamento e seleção de talentos; condução de processos seletivos e entrevistas; acompanhamento de colaboradores; implementação de políticas de gestão de pessoas; desenvolvimento de programas de treinamento e capacitação; análise de clima organizacional; gestão de indicadores de RH; apoio à cultura organizacional, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "RH": {
    titulo: "ANALISTA DE GENTE E GESTÃO",
    escopo: "recrutamento e seleção de talentos; condução de processos seletivos e entrevistas; acompanhamento de colaboradores; implementação de políticas de gestão de pessoas; desenvolvimento de programas de treinamento e capacitação; análise de clima organizacional; gestão de indicadores de RH; apoio à cultura organizacional, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "VIDEOMAKER": {
    titulo: "VIDEOMAKER",
    escopo: "produção e edição de vídeos institucionais e publicitários; captação de imagens e áudio; pós-produção e tratamento de conteúdo audiovisual; criação de motion graphics e animações; gestão de equipamentos audiovisuais; planejamento de produções; entrega de materiais em formatos adequados para diferentes plataformas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "VIDEO": {
    titulo: "VIDEOMAKER",
    escopo: "produção e edição de vídeos institucionais e publicitários; captação de imagens e áudio; pós-produção e tratamento de conteúdo audiovisual; criação de motion graphics e animações; gestão de equipamentos audiovisuais; planejamento de produções; entrega de materiais em formatos adequados para diferentes plataformas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "EDITOR": {
    titulo: "VIDEOMAKER",
    escopo: "produção e edição de vídeos institucionais e publicitários; captação de imagens e áudio; pós-produção e tratamento de conteúdo audiovisual; criação de motion graphics e animações; gestão de equipamentos audiovisuais; planejamento de produções; entrega de materiais em formatos adequados para diferentes plataformas, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "DESIGNER": {
    titulo: "DESIGNER",
    escopo: "criação de peças gráficas para campanhas digitais e offline; desenvolvimento de identidades visuais; produção de materiais para redes sociais; elaboração de layouts para landing pages e e-mails marketing; criação de apresentações corporativas; adaptação de materiais para diferentes formatos e plataformas; manutenção da consistência visual da marca, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "DESIGN": {
    titulo: "DESIGNER",
    escopo: "criação de peças gráficas para campanhas digitais e offline; desenvolvimento de identidades visuais; produção de materiais para redes sociais; elaboração de layouts para landing pages e e-mails marketing; criação de apresentações corporativas; adaptação de materiais para diferentes formatos e plataformas; manutenção da consistência visual da marca, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "DIRETOR DE ARTE": {
    titulo: "DESIGNER",
    escopo: "criação de peças gráficas para campanhas digitais e offline; desenvolvimento de identidades visuais; produção de materiais para redes sociais; elaboração de layouts para landing pages e e-mails marketing; criação de apresentações corporativas; adaptação de materiais para diferentes formatos e plataformas; manutenção da consistência visual da marca, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "GESTOR DE PERFORMANCE": {
    titulo: "GESTOR DE PERFORMANCE",
    escopo: "planejamento e execução de campanhas de mídia paga (Google Ads, Meta Ads, LinkedIn Ads e outras plataformas); análise de métricas e KPIs de performance; otimização contínua de campanhas; gestão de orçamento de mídia; elaboração de relatórios de resultados; testes A/B e experimentação; acompanhamento de conversões e funil de vendas; implementação de tags e pixels de rastreamento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "PERFORMANCE": {
    titulo: "GESTOR DE PERFORMANCE",
    escopo: "planejamento e execução de campanhas de mídia paga (Google Ads, Meta Ads, LinkedIn Ads e outras plataformas); análise de métricas e KPIs de performance; otimização contínua de campanhas; gestão de orçamento de mídia; elaboração de relatórios de resultados; testes A/B e experimentação; acompanhamento de conversões e funil de vendas; implementação de tags e pixels de rastreamento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "MÍDIA": {
    titulo: "GESTOR DE PERFORMANCE",
    escopo: "planejamento e execução de campanhas de mídia paga (Google Ads, Meta Ads, LinkedIn Ads e outras plataformas); análise de métricas e KPIs de performance; otimização contínua de campanhas; gestão de orçamento de mídia; elaboração de relatórios de resultados; testes A/B e experimentação; acompanhamento de conversões e funil de vendas; implementação de tags e pixels de rastreamento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "TRAFEGO": {
    titulo: "GESTOR DE PERFORMANCE",
    escopo: "planejamento e execução de campanhas de mídia paga (Google Ads, Meta Ads, LinkedIn Ads e outras plataformas); análise de métricas e KPIs de performance; otimização contínua de campanhas; gestão de orçamento de mídia; elaboração de relatórios de resultados; testes A/B e experimentação; acompanhamento de conversões e funil de vendas; implementação de tags e pixels de rastreamento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "TRÁFEGO": {
    titulo: "GESTOR DE PERFORMANCE",
    escopo: "planejamento e execução de campanhas de mídia paga (Google Ads, Meta Ads, LinkedIn Ads e outras plataformas); análise de métricas e KPIs de performance; otimização contínua de campanhas; gestão de orçamento de mídia; elaboração de relatórios de resultados; testes A/B e experimentação; acompanhamento de conversões e funil de vendas; implementação de tags e pixels de rastreamento, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "PRÉ-VENDAS": {
    titulo: "ESPECIALISTA EM PRÉ-VENDAS",
    escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "SDR": {
    titulo: "ESPECIALISTA EM PRÉ-VENDAS",
    escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
  "BDR": {
    titulo: "ESPECIALISTA EM PRÉ-VENDAS",
    escopo: "criação de listas para prospecção outbound (BDR); qualificação de leads; garantir o comparecimento do cliente na reunião agendada; construir um resumo do cliente para o closer ter contexto ao participar da reunião; atingir metas de reuniões agendadas; apresentação de pré reunião; desenvolvimento técnico comercial constante; construir relacionamento com clientes; atualizar o CRM; participar de reuniões internas; apresentação de Planos de Ação, sem que isso implique subordinação hierárquica ou integração à estrutura organizacional da CONTRATANTE"
  },
};

// Função para obter escopo baseado no cargo
const getEscopoCargo = (cargo: string | null): { titulo: string; escopo: string } => {
  if (!cargo) return { titulo: "PRESTADOR DE SERVIÇOS", escopo: "prestar serviços conforme acordado entre as partes" };

  const cargoUpper = cargo.toUpperCase().trim();

  // Busca exata
  if (ESCOPOS_POR_CARGO[cargoUpper]) {
    return ESCOPOS_POR_CARGO[cargoUpper];
  }

  // Busca parcial
  for (const [key, value] of Object.entries(ESCOPOS_POR_CARGO)) {
    if (cargoUpper.includes(key) || key.includes(cargoUpper)) {
      return value;
    }
  }

  // Fallback
  return { titulo: cargo, escopo: "prestar serviços conforme acordado entre as partes, respeitando as diretrizes técnicas e operacionais da CONTRATANTE" };
};

const CLAUSULAS_CONTRATO = `CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS

Pelo presente instrumento particular, e na melhor forma de direito, as partes a seguir qualificadas:

CONTRATANTE: TURBO PARTNERS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o n° 42.100.292/0001-84, com sede na Av. João Batista Parra, 633 - 13° Andar - Enseada do Suá, Vitória - ES, CEP: 29052-123, neste ato representada por seu sócio Rodrigo Queiroz Santos;

CONTRATADA: {{QUALIFICACAO_CONTRATADA}}

têm entre si, justo e contratado, o presente Contrato de Prestação de Serviços, mediante as seguintes cláusulas e condições:


CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO

1.1. O CONTRATADO prestará serviços como {{CARGO_TITULO}}. Para isso, deverá designar pessoa legalmente certificada e habilitada para a execução dos serviços.

1.1.1. Os serviços serão prestados por pessoa previamente indicada pelo CONTRATADO e compreendem, de modo exemplificativo, as seguintes atribuições: {{ESCOPO_CARGO}}

Parágrafo Primeiro. Fica certo e ajustado entre as PARTES que não haverá qualquer controle de horário e/ou carga horário do profissional alocado pela CONTRATADA para a execução dos serviços, tampouco obrigatoriedade quanto ao local de realização das tarefas.

Parágrafo Segundo. Toda e qualquer pessoa eventualmente envolvida pela CONTRATADA na execução dos serviços contratados atuará em nome e por conta exclusiva da própria CONTRATADA, sendo esta a única responsável por sua relação jurídica, operacional e contratual com tais profissionais, sem qualquer vínculo direto ou indireto com a CONTRATANTE.

Parágrafo Terceiro. Quanto estiver atuando em dependências da CONTRATANTE, a CONTRATADA responsabiliza-se a fazer cumprir, por seu pessoal, as normas legais e internas da CONTRATANTE no tocante à segurança geral, higiene, proteção ao patrimônio e prevenção de incêndios.


CLÁUSULA SEGUNDA – DO PRAZO

2.1 – O presente contrato tem prazo de 6 [seis] meses, com início em {{DATA_INICIO}} e fim em {{DATA_FIM}}. Ao final deste prazo, o CONTRATO poderá ser renovado mediante manifestação expressa das partes, ocasião em que será reavaliado o escopo e as condições comerciais.

Parágrafo Primeiro. Ao final deste prazo, o contrato poderá ser renovado, sendo este realizado por simples aditivo contratual.

2.2 A CONTRATANTE poderá rescindir o presente Contrato, a qualquer tempo, independentemente de motivação e sem necessidade de aviso prévio, mediante comunicação à CONTRATADA, operando-se a extinção imediata do vínculo contratual.

Parágrafo Primeiro. Na hipótese de resilição ora prevista, serão devidos exclusivamente os valores proporcionais aos serviços comprovadamente prestados até a data da comunicação.

Parágrafo Terceiro. No caso de encerramento do presente contrato, a CONTRATADA deverá devolver, à CONTRATANTE, todo material em seu poder e que pertença à CONTRATANTE. A CONTRATANTE deverá quitar quaisquer pagamentos devidos por eventuais perdas e danos.


CLÁUSULA TERCEIRA – DA REMUNERAÇÃO

3.1 - A título de contraprestação pelos serviços prestados no âmbito deste contrato, a CONTRATADA fará jus à remuneração no valor de R$ {{VALOR_MENSAL}} ({{VALOR_EXTENSO}}) mensais, enquanto vigente o presente instrumento, observado o escopo e a periodicidade das entregas pactuadas entre as partes.

Parágrafo Primeiro. Os valores que resultarem do disposto nesta cláusula constituem os únicos valores/créditos devidos pela CONTRATANTE ao CONTRATADO em razão do presente contrato, eximindo-se a CONTRATANTE de responder por quaisquer outros valores que sejam cobrados pelo CONTRATADO.

Parágrafo Segundo. Até o 25° (vigésimo quinto) dia do mês subsequente à prestação dos serviços, a CONTRATANTE providenciará o pagamento da CONTRATADA, desde que cumpridas todo o escopo de entregas previstas no presente instrumento contratual.

Parágrafo Terceiro. Até o 10° (décimo) dia anterior à data de pagamento e condicionado à plena constatação de cumprimento das entregas previstas, o CONTRATADO deverá emitir a competente Nota Fiscal, remetendo-a imediatamente à CONTRATANTE.

Parágrafo Quarto. O CONTRATADO será o único responsável pelo pagamento de eventuais valores devidos a terceiros por si SUBCONTRATADOS, não subsistindo nenhuma obrigação da CONTRATANTE para com terceiros neste sentido, tampouco de pagamento de qualquer outra importância à definida neste CONTRATO.

Parágrafo Quinto. Caso em determinado exercício mensal haja a interrupção ou suspensão na prestação dos serviços, o pagamento será feito de modo proporcional ao período de efetiva execução das tarefas.

Parágrafo Sexto. O recolhimento dos tributos incidentes sobre os Serviços, assim como o cumprimento das correspondentes obrigações tributárias acessórias, são de exclusiva responsabilidade da CONTRATADA, exceto nas hipóteses em que a CONTRATANTE deva, em razão de disposição legal, promover a retenção dos valores a serem pagos ao Fisco (Municipal, Estadual ou Federal).

Parágrafo Sétimo. O comprovante de depósito ou transferência servirá como recibo e prova de quitação e pagamento da obrigação ajustada.


CLÁUSULA QUARTA – DAS OBRIGAÇÕES DO CONTRATADO

4.1 - São obrigações do CONTRATADO:

4.2. Prestar os serviços contratados em conformidade com os padrões de qualidade acordados e com a boa técnica profissional aplicável ao setor e estipulados e definidos pela CONTRATANTE.

4.3. Fornecer as notas fiscais referentes aos pagamentos efetuados pela CONTRATANTE dentro do prazo previamente estipulado por meio do presente instrumento;

4.4. Arcar com todas as despesas de natureza tributária decorrentes dos serviços especificados neste contrato;

4.5. Cumprir todas as determinações impostas estipuladas no escopo, dentro dos prazos estipulados, para o desenvolvimento das tarefas ora atribuídas ao CONTRATADO;

4.6. Manter sigilosas, mesmo após findo este contrato, pelo período de 5 (cinco) anos, as informações privilegiadas de qualquer natureza às quais tenham acesso em virtude da execução destes serviços;

4.7. Comprometer-se a utilizar os equipamentos disponibilizados unicamente para fins profissionais relacionados às entregas pactuadas, observando as diretrizes técnicas definidas pela CONTRATANTE.

4.8. A CONTRATANTE poderá ter acesso a qualquer momento, independente de consentimento, ao computador e informações contidas nos equipamentos disponibilizados para o CONTRATADO.

4.9. A CONTRATADA compromete-se a observar os prazos e padrões técnicos definidos pela CONTRATANTE, podendo esta rejeitar materiais que não atendam às diretrizes estabelecidas.

4.10. A CONTRATADA compromete-se a não praticar qualquer ato que possa prejudicar a imagem, reputação ou credibilidade da CONTRATANTE.

Parágrafo Primeiro. O envolvimento da CONTRATADA em situação que gere repercussão negativa relevante autoriza a rescisão imediata do contrato, sem ônus para a CONTRATANTE.

Parágrafo Segundo. Os documentos pertencentes ou em posse da empresa contratante depositados em mídias físicas ou digitais somente devem ser abertos e tratados em computadores credenciados e de propriedade da CONTRATANTE.

Parágrafo Terceiro. Sobre os computadores e demais equipamentos fornecidos para a prestação dos serviços não devem ser instalados programas alheios sem a autorização da CONTRATANTE.


CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATADA

5.1. Sem prejuízo das demais obrigações expressamente ajustadas neste Contrato, a CONTRATADA se obriga a:

5.1. Fornecer todas as informações necessárias à execução dos serviços, incluindo diretrizes e objetivos, respeitada a autonomia técnica e operacional da CONTRATADA quanto aos meios e métodos empregados.

5.2 Efetuar o pagamento, nas datas e nos termos definidos neste contrato;

5.3. Manifestar, de forma expressa, eventuais críticas, dúvidas, solicitações, novas orientações e sugestões pertinentes aos serviços, quando existirem;


CLÁUSULA SEXTA – DA RESCISÃO E EXTINÇÃO DO CONTRATO

6.1. O presente contrato poderá ser rescindido, a qualquer tempo, por qualquer das partes, independentemente de motivação, independente de qualquer comunicação prévia à outra parte, sem antecedência mínima, sem que disso decorra o pagamento de multa ou indenização, ressalvadas as obrigações já vencidas.

6.2. O contrato poderá ser rescindido de forma motivada, por qualquer das partes, independentemente de aviso prévio, nas seguintes hipóteses:

    6.2.1. Descumprimento, pela outra parte, de quaisquer obrigações assumidas neste contrato, inclusive atraso na entrega dos serviços, execução inadequada do objeto ou violação de cláusulas contratuais;

    6.2.3. Prática de atos que comprometam a continuidade, a regularidade ou a finalidade do contrato.

6.3. A rescisão motivada não exime a parte inadimplente da responsabilidade pelo pagamento dos serviços efetivamente prestados até a data da rescisão, nem das perdas e danos eventualmente apurados.


CLÁUSULA SÉTIMA – DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA E SOCIETÁRIO

7.1 - Não se estabelece, por força do presente contrato, nenhum vínculo empregatício, nem enseja qualquer tipo de subordinação e pessoalidade entre a CONTRATANTE e o pessoal do CONTRATADO, sendo certo que as obrigações e direitos das partes limitam-se ao expressamente avençado neste contrato.

7.2. O próprio CONTRATADO, na qualidade de prestador de serviços estabelecerá e concretizará, cotidianamente, a forma de realização dos serviços pactuados no presente termo.

Parágrafo Primeiro. O CONTRATADO tem ciência e declara que nenhum ex-empregado da CONTRATANTE cujo contrato de trabalho tenha se encerrado há menos de 18 (dezoito) meses poderá ser alocado pelo CONTRATADO na prestação dos serviços.

Parágrafo Segundo. O CONTRATADO tem ciência e declara que tem capacidade técnico-financeira para arcar com suas responsabilidades contratuais e extracontratuais, vinculada ou não a este contrato, e que não possui nem se colocará em situação de dependência econômica com relação ao resultado financeiro deste contrato.

Parágrafo Terceiro. O CONTRATADO declara assumir integralmente os riscos relacionados à atividade empresarial que exerce, inclusive quanto à gestão de sua equipe, métodos de trabalho, investimentos necessários e responsabilidade pelos resultados.

Parágrafo Quarto. O CONTRATADO tem ciência e declara que nada neste contrato poderá ser interpretado como tendo as partes, estabelecido qualquer forma de sociedade, associação, agência ou consórcio, de fato ou de direito, permanecendo cada uma das partes com as suas obrigações civis, comerciais, trabalhistas e tributárias, de forma autônoma.

Parágrafo Quinto. Não haverá controles de horários de chegada ou saída ou subordinação, ou controle de presença caso o CONTRATADO opte por ir em modelo presencial, com total autonomia da CONTRATADO em relação à CONTRATANTE, se comprometendo a CONTRATANTE a executar os serviços contratados através das horas necessárias à execução dos serviços, conforme acordado, sob pena dos respectivos descontos. Caso não seja solicitado por escrito pela CONTRATANTE, não serão devidas horas adicionais às expressamente contratadas nesta cláusula.


CLÁUSULA OITAVA – DA CONFIDENCIALIDADE

8.1 - As partes concordam que, sem o consentimento escrito, não poderão revelar ou divulgar, direta ou indiretamente, no todo ou em parte, isolada ou juntamente com terceiros, qualquer informação confidencial referente ao presente contrato, o que inclui, mas não se limita a: todos e quaisquer dados, relatórios, análises, estudos, pesquisas, interpretações, previsões / estimativas, registros, materiais e quaisquer outros elementos que contenham informações referentes à outra Parte. As disposições desta cláusula sobreviverão após o prazo de 05 (cinco) anos posteriores à vigência deste contrato ou à rescisão do mesmo por qualquer razão.

Parágrafo Primeiro. Para os propósitos, serão consideradas "informações confidenciais" todas e quaisquer informações e/ou dados de natureza confidencial (incluindo, sem limitação, os termos e condições deste contrato e todos os segredos e/ou informações operacionais, econômicas e técnicas, bem como demais informações comerciais ou "know-how") que tenham sido direta ou indiretamente fornecidos ou divulgados por uma das partes à outra sob ou em função deste contrato, incluindo-se as informações de natureza comercial e os Contratos celebrados com terceiros para a comercialização dos produtos e serviços, mesmo as obtidas durante as negociações precedentes à formalização deste instrumento.

Parágrafo Segundo. Caso a CONTRATADA venha a ser legalmente obrigada, por determinação judicial ou de autoridade administrativa competente, a revelar qualquer Informação Confidencial relacionada à CONTRATANTE, deverá comunicar formalmente à CONTRATANTE, por escrito e com a maior brevidade possível, acerca da referida exigência, fornecendo cópia da ordem recebida e todas as informações pertinentes, a fim de que a CONTRATANTE possa adotar as medidas judiciais ou administrativas cabíveis à preservação de seus direitos.

Parágrafo único. A CONTRATADA limitar-se-á a revelar exclusivamente as informações estritamente exigidas pela autoridade competente, envidando seus melhores esforços para resguardar o caráter confidencial dos dados divulgados.

Parágrafo Terceiro. A CONTRATADA não poderá, em nenhuma hipótese, fazer qualquer outro uso, realizar qualquer outro negócio ou celebrar qualquer outro contrato relacionado, direta ou indiretamente, às Informações Confidenciais.

Parágrafo Quarto. Todas as Informações Confidenciais devem ser mantidas e tratadas como estritamente confidenciais e não poderão ser reveladas a qualquer terceiro, de forma alguma, no todo ou em parte, bem como não poderão ser utilizadas para qualquer finalidade que não esteja única e exclusivamente relacionada aos Serviços.

Parágrafo Quinto. Sem prejuízo de outras obrigações, a CONTRATADA se compromete desde logo a:
1. Não divulgar quaisquer Informações Confidenciais a quaisquer terceiros;
2. Utilizar quaisquer Informações Confidenciais exclusivamente para a execução da prestação dos serviços;
3. Não analisar, providenciar análise, derivar ou sintetizar qualquer informação recebida da CONTRATANTE sem autorização prévia e fora dos limites da execução de seu trabalho;

8.2. A CONTRATADA responderá direta, exclusiva e integralmente por qualquer divulgação, utilização indevida, vazamento, acesso não autorizado ou tratamento irregular de Informações Confidenciais ocorrido durante a execução deste Contrato, ainda que o ato seja praticado por seus empregados, prepostos, representantes, subcontratados, colaboradores ou quaisquer terceiros sob sua responsabilidade ou esfera de controle.

8.3. Verificada a ocorrência de qualquer das hipóteses acima, a CONTRATADA obriga-se a ressarcir integralmente a CONTRATANTE por todos os prejuízos suportados, inclusive aqueles decorrentes de condenação judicial, acordo, autuação administrativa ou qualquer tipo de sanção regulatória.


CLÁUSULA NONA – DA INEXISTÊNCIA DE LICENÇAS

9.1. A CONTRATANTE reterá todo o direito, titularidade e interesse sobre as informações confidenciais presentes no presente contrato.

9.2. Nada contido neste CONTRATO, nem a revelação de Informações Confidenciais, deverá ser interpretado como cessão ou transferência de quaisquer direitos, por meio de licença ou de qualquer outra forma, referente a marcas, patentes, direitos autorais, informações tecnológicas, segredos comerciais e/ou industriais, ou outras Informações Confidenciais, ou qualquer outra propriedade intelectual, sendo certo que a CONTRATANTE permanecerá como única proprietária das Informações Confidenciais.

9.3. São e serão considerados como propriedade intelectual e/ou industrial única e exclusiva da CONTRATANTE qualquer produto, criação, desenvolvimento, relatório, planilha, resultado, dentre outros, ainda que tenham sido desenvolvidos pela CONTRATADA. Nenhum direito de propriedade intelectual e/ou industrial será detido pela CONTRATADA, a qual, expressamente, cede e transfere à CONTRATANTE, desde logo, não onerosamente, todo e qualquer direito relacionado ou derivado a qualquer espécie de criação decorrente do relacionamento entre as Partes.

9.4. Não assiste à CONTRATADA qualquer direito ou expectativa de direito de propriedade intelectual e/ou industrial ou de qualquer direito imaterial, tampouco lhe assiste qualquer direito de postular ou formular qualquer reivindicação.

9.5. A CONTRATADA expressamente declara que todo e qualquer valor a título de eventuais direitos sobre propriedade intelectual e/ou industrial, direitos autorais ou qualquer espécie de direitos imateriais, já foi considerada pela Partes na fixação do Preço (contraprestação), razão pela qual nenhuma quantia poderá ser reclamada, a qualquer título, pela CONTRATADA.


CLÁUSULA DÉCIMA – DA ABSTENÇÃO DE ALICIAMENTO E INDUÇÃO DE TERCEIROS VINCULADOS À CONTRATANTE

10.1 - Durante a vigência deste instrumento e por um período de 24 (vinte e quatro) meses após sua extinção, o CONTRATADO se compromete a não contratar, ou tentar contratar, direta ou indiretamente, qualquer empregado(a) da CONTRATANTE ou de qualquer outra empresa do grupo no Brasil ou no exterior, para trabalhar para seu novo empregador ou empresa da qual seja, direta ou indiretamente, ligado, inclusive como sócio.

10.1.1 - Durante o período mencionado na Cláusula Segunda e pelo mesmo prazo de 02 (dois) anos contados da rescisão do contrato, o CONTRATADO também se compromete a não ajudar terceiros a contratar empregados(as) da CONTRATANTE ou de outra empresa do grupo, tampouco a induzir ou convencer qualquer empregado(a) da CONTRATANTE a rescindir o contrato que mantém com a CONTRATANTE.

10.2 - O CONTRATADO, também neste ato, de forma irrevogável e irretratável, se compromete perante a CONTRATANTE a abster-se, durante a vigência do presente e pelo período de 03 (três) anos contados da rescisão contratual de direta ou indiretamente, aliciar, induzir, convidar, contratar, nem determinar que seja aliciado, induzido ou convidado:

(i) Qualquer cliente atendido e/ou captado pela CONTRATANTE ou pelo CONTRATADO durante a prestação de seus serviços para que tal cliente seja atendido por outra personalidade jurídica concorrente da TURBO;

(ii) Qualquer empregado, sócio, diretor ou outro prestador de serviços da TURBO e/ou qualquer de suas afiliadas;

(iii) Qualquer pessoa a deixar de fazer negócios com a TURBO e/ou qualquer de suas afiliadas;

(iv) Qualquer fornecedor ou cliente da TURBO a deixar de realizar ou diminuir os negócios realizados com a CONTRATANTE;

10.3 - Sem prejuízo das indenizações por perdas e danos e da responsabilidade criminal, o CONTRATADO, em caso de infração da presente cláusula, pagará ao CONTRATANTE uma multa não compensatória igual a R$100.000,00 (cem mil reais) por cada infração.


CLÁUSULA DÉCIMA PRIMEIRA – DA PROTEÇÃO DE DADOS PESSOAIS

11.1 - Seguindo as determinações da Lei 13.709/2018 ("Lei Geral de Proteção de Dados Pessoais") o CONTRATADO se compromete a manter segredo absoluto dos assuntos relacionados aos serviços prestados, bem como de todos os dados e informações relativos aos resultados obtidos na prestação do serviço, comprometendo-se a: não utilizar as informações confidenciais a que tiver acesso pelo período de 05 (cinco) anos, para gerar benefício próprio exclusivo e/ou unilateral, presente ou futuro, ou para o uso de terceiros; não efetuar nenhuma gravação ou cópia da documentação confidencial a que tiver acesso; não apropriar-se para si ou para outrem de material confidencial e/ou sigiloso da tecnologia que venha a ser disponível e; não repassar o conhecimento das informações confidenciais, responsabilizando-se por todas as pessoas que vierem a ter acesso às informações, por seu intermédio, e obrigando-se, assim, a reparar a ocorrência de qualquer dano e / ou prejuízo oriundo de uma eventual quebra de sigilo das informações fornecidas.

Parágrafo Primeiro. As partes se comprometem a não utilizar os dados pessoais que tiverem acesso para fins distintos da relação estabelecida, sendo vedada a transmissão para terceiros.

Parágrafo Segundo. As partes se comprometem em manter os compromissos acima, mesmo após o término da relação contratual.

Parágrafo Terceiro. As partes declaram que qualquer conduta incompatível com as disposições acima será considerada uma grave violação deste contrato e será considerado motivo de justa causa para a rescisão imediata, sem prejuízo da adoção das medidas legalmente cabíveis.


CLÁUSULA DÉCIMA SEGUNDA – DO USO E RESPONSABILIDADE PELOS EQUIPAMENTOS FORNECIDOS PELA CONTRATANTE

12.1. A CONTRATANTE disponibilizará, em regime de comodato, um computador MacBook modelo [X], de sua propriedade, para uso exclusivo da CONTRATADA na execução dos serviços contratados neste instrumento.

12.2. A CONTRATADA compromete-se a zelar pelo bom estado de conservação, uso adequado e exclusivo do equipamento disponibilizado, abstendo-se de utilizá-lo para fins pessoais, atividades não relacionadas ao presente contrato, ou por terceiros.

12.3. A CONTRATADA será responsável integral por qualquer dano, perda, extravio, furto, roubo ou mau uso do equipamento, independentemente de culpa, obrigando-se a arcar com os custos de reparação ou substituição integral do bem, conforme orçamento técnico indicado pela CONTRATANTE.

12.4. Em caso de dano parcial, a CONTRATADA deverá restituir à CONTRATANTE o valor referente ao reparo, no prazo máximo de 30 (trinta) dias após a notificação.

12.5. Em caso de perda total, extravio, furto ou roubo, a CONTRATADA deverá indenizar a CONTRATANTE com base no valor de mercado atualizado do bem à época do evento, conforme cotação de revendedor autorizado ou nota fiscal de aquisição, o que for mais benéfico à CONTRATANTE.

12.6. O equipamento deverá ser devolvido à CONTRATANTE no ato de rescisão do contrato, em perfeito estado de funcionamento e conservação, ressalvado o desgaste natural decorrente do uso regular.

12.7. A CONTRATANTE poderá, a qualquer tempo, solicitar a devolução imediata do equipamento, cabendo à CONTRATADA o cumprimento imediato da solicitação.

12.8. O inadimplemento das obrigações previstas nesta cláusula autoriza a CONTRATANTE a reter valores devidos à CONTRATADA até o limite da indenização cabível, sem prejuízo das demais medidas legais e contratuais aplicáveis.

12.9. A CONTRATANTE poderá realizar auditorias técnicas remotas no equipamento disponibilizado, a qualquer tempo.


CLÁUSULA DÉCIMA TERCEIRA - DO DIREITO DE USO DE IMAGEM

13. O CONTRATADO autoriza, de forma livre, expressa, irrevogável e irretratável, a utilização de sua imagem, nome e voz pela CONTRATANTE, para fins institucionais, comerciais e publicitários relacionados ou não ao objeto deste contrato, em quaisquer meios físicos ou digitais, sem limitação territorial ou temporal, inclusive após o término da relação contratual, sem que disso decorra direito a remuneração adicional.

Parágrafo único. A utilização ora autorizada não implica exclusividade, vínculo empregatício ou societário, comprometendo-se a CONTRATANTE a utilizar a imagem do CONTRATADO de forma ética e compatível com a finalidade profissional pactuada.


CLÁUSULA DÉCIMA QUARTA – DAS DISPOSIÇÕES GERAIS

14.1. O presente Contrato é celebrado em caráter irrevogável e irretratável, obrigando as Partes e seus sucessores a qualquer título, constituindo o acordo integral entre elas acerca do objeto ora pactuado, ficando expressamente revogados e substituídos quaisquer contratos, instrumentos, ajustes, propostas, entendimentos e negociações anteriores, verbais ou escritos, que versem sobre a mesma matéria.

14.2. A tolerância das Partes com relação a inadimplemento ou não cumprimento de qualquer obrigação, cláusula, termo ou condição ora estabelecida não constitui precedente, renúncia a obrigações, emenda ou renovação do contrato, e sim mera liberalidade.

14.3. A declaração de nulidade ou anulação de qualquer dos dispositivos contidos neste instrumento não invalidará suas demais disposições, as quais permanecerão em pleno vigor.

14.4. Não se estabelece, por força deste instrumento, qualquer forma de sociedade, associação, agência, consórcio, participação societária, ou responsabilidade solidária entre as partes.

14.5. O objeto deste contrato não visa proporcionar nenhuma espécie de vantagem fiscal, trabalhista ou previdenciária a qualquer Parte ou a terceiros, e não implica vínculo empregatício entre uma das partes e os funcionários/prepostos da outra, ficando a cargo de cada uma delas a responsabilidade referente aos encargos sociais, tributários, previdenciários e trabalhistas de seus respectivos colaboradores.

14.6. Os tributos (impostos, taxas, emolumentos, contribuições fiscais e parafiscais) que sejam devidos em decorrência direta ou indireta do presente contrato ou de sua execução, serão de exclusiva responsabilidade do contribuinte, conforme definido na norma tributária, autorizadas as retenções legais, sem direito a reembolso.

14.7. O presente CONTRATO é o instrumento que regula todos os direitos e obrigações acordadas entre as Partes, substituindo todo e qualquer CONTRATO ou entendimento previamente realizado pelas Partes.

14.8. Na hipótese de qualquer autuação, fiscalização, imposição de multa, desenquadramento ou fixação de qualquer outra sanção, de qualquer natureza, em desfavor da CONTRATADA, em especial em matéria tributária ou trabalhista, nenhuma responsabilidade incumbirá à CONTRATANTE, a qual fica desobrigada de qualquer pagamento ou assunção de despesas, sendo de rigor, ao revés, a obrigação de a CONTRATADA indenizar a CONTRATANTE por eventuais prejuízos decorrentes de tais eventos.

14.9. Em nenhuma hipótese a CONTRATANTE será responsável por lucros cessantes, danos indiretos ou perdas financeiras da CONTRATADA.

14.10. O presente contrato não estabelece exclusividade entre as partes, nem gera expectativa de renovação automática ou volume mínimo de demandas.

14.11. Declaram as Partes que as obrigações aqui presentes são celebradas de boa-fé, livremente e de comum acordo, não existindo quaisquer vícios ou defeitos que possam acarretar a sua nulidade, em especial aqueles relacionados com dolo, erro, fraude, simulação ou coação, inexistindo também qualquer fato que possa ser configurado como estado de perigo ou de necessidade.

14.12. Fica eleito o Foro da Comarca de Vitória/ES para nele serem dirimidas eventuais dúvidas ou questões oriundas deste contrato.

As Partes neste ato declaram que (i) é admitida como válida e verdadeira a assinatura deste Contrato por meio de certificado digital emitido por entidades credenciadas para tanto pela Infraestrutura de Chaves Públicas Brasileira - ICP-Brasil; e (ii) são admitidas como válidas e originais as vias deste Contrato emitidas por meios de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil.

E assim, por estarem justas e CONTRATADAS, as partes assinam este presente contrato em 2 (duas) vias de igual teor, na presença das testemunhas abaixo.


Vitória, {{DATA_ATUAL}}.



____________________________________________________
TURBO PARTNERS LTDA



____________________________________________________
{{NOME}}
`;

// --------------- Sub-components ---------------

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status || status === "Sem contrato") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-zinc-600 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-zinc-400">
        <FileText className="h-3 w-3" />
        Sem contrato
      </span>
    );
  }

  if (status === "Assinado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3" />
        Assinado
      </span>
    );
  }

  if (status === "Enviado para assinatura") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <Clock className="h-3 w-3" />
        Enviado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-300 dark:border-zinc-600 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-zinc-400">
      {status}
    </span>
  );
}

function StatsCards({
  total,
  enviados,
  assinados,
  pendentes,
}: {
  total: number;
  enviados: number;
  assinados: number;
  pendentes: number;
}) {
  const cards = [
    { label: "Total Colaboradores", value: total, icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Contratos Enviados", value: enviados, icon: FileClock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Assinados", value: assinados, icon: FileCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "Pendentes", value: pendentes, icon: FileText, color: "text-gray-600 dark:text-zinc-400", bg: "bg-gray-50 dark:bg-zinc-800/50" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`rounded-lg p-2.5 ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ColaboradorSheet({
  colaborador,
  contratoStatus,
  open,
  onOpenChange,
  onDownloadPDF,
  onPrint,
  onEnviarAssinatura,
  onMarcarAssinado,
  enviarPending,
  marcarPending,
  contratoTexto,
}: {
  colaborador: Colaborador;
  contratoStatus: ContratoStatus | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadPDF: () => void;
  onPrint: () => void;
  onEnviarAssinatura: () => void;
  onMarcarAssinado: () => void;
  enviarPending: boolean;
  marcarPending: boolean;
  contratoTexto: string;
}) {
  const status = contratoStatus?.status;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-zinc-800">
          <SheetTitle className="text-lg font-semibold text-gray-900 dark:text-white">
            {colaborador.nome}
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-500 dark:text-zinc-400">
            {colaborador.cargo || "Cargo não informado"} {colaborador.setor ? `- ${colaborador.setor}` : ""}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-4">
            {/* Dados do colaborador */}
            <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <UserCheck className="h-4 w-4 mt-0.5 text-gray-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">CPF/CNPJ</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {colaborador.cnpj || colaborador.cpf || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-0.5 text-gray-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Email</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {colaborador.email || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-gray-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Endereço</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {colaborador.endereco || "-"}
                      {colaborador.estado ? ` - ${colaborador.estado}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 mt-0.5 text-gray-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Setor</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {colaborador.setor || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-gray-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Admissão</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {colaborador.admissao
                        ? format(new Date(colaborador.admissao), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 mt-0.5 text-gray-400 dark:text-zinc-500" />
                  <div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400">Salário</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {colaborador.salario ? `R$ ${colaborador.salario}` : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onDownloadPDF} className="border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800">
                <Download className="h-4 w-4 mr-1.5" />
                Baixar PDF
              </Button>
              <Button size="sm" variant="outline" onClick={onPrint} className="border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800">
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimir
              </Button>
              <Button
                size="sm"
                onClick={onEnviarAssinatura}
                disabled={enviarPending || !colaborador.email}
                title={!colaborador.email ? "Colaborador não possui email cadastrado" : "Enviar para assinatura"}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {enviarPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Enviar para Assinatura
              </Button>
              {status === "Enviado para assinatura" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                  onClick={onMarcarAssinado}
                  disabled={marcarPending}
                >
                  {marcarPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  Marcar como Assinado
                </Button>
              )}
            </div>

            {/* Preview do contrato */}
            <div className="rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="px-4 py-2.5 border-b border-gray-200 dark:border-zinc-800">
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                  Preview do Contrato
                </p>
              </div>
              <div className="p-4">
                <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed text-gray-700 dark:text-zinc-300">
                  {contratoTexto}
                </pre>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// --------------- Main component ---------------

export default function ContratosColaboradores() {
  useSetPageInfo("Contratos Colaboradores", "Geração de contratos para colaboradores");
  usePageTitle("Contratos Colaboradores | Turbo Cortex");
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [setorFilter, setSetorFilter] = useState("todos");
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery<{ colaboradores: Colaborador[] }>({
    queryKey: ["/api/juridico/colaboradores-contrato"],
  });

  const colaboradores = data?.colaboradores || [];

  const { data: statusData } = useQuery<ContratoStatus[]>({
    queryKey: ["/api/juridico/colaboradores-contrato/status"],
  });

  const statusPorColaborador = useMemo(() => {
    const map = new Map<number, ContratoStatus>();
    if (statusData) {
      for (const status of statusData) {
        if (!map.has(status.colaborador_id)) {
          map.set(status.colaborador_id, status);
        }
      }
    }
    return map;
  }, [statusData]);

  // Setores únicos
  const setores = useMemo(() => {
    const s = new Set<string>();
    colaboradores.forEach((c) => { if (c.setor) s.add(c.setor); });
    return Array.from(s).sort();
  }, [colaboradores]);

  // Helper: resolve status string for a colaborador
  const getStatus = (id: number) => statusPorColaborador.get(id)?.status || "Sem contrato";

  // KPIs
  const stats = useMemo(() => {
    const total = colaboradores.length;
    let enviados = 0;
    let assinados = 0;
    colaboradores.forEach((c) => {
      const s = getStatus(c.id);
      if (s === "Enviado para assinatura") enviados++;
      if (s === "Assinado") assinados++;
    });
    return { total, enviados, assinados, pendentes: total - enviados - assinados };
  }, [colaboradores, statusPorColaborador]);

  // Filtered list
  const filteredColaboradores = useMemo(() => {
    let list = colaboradores;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (c) =>
          c.nome?.toLowerCase().includes(term) ||
          c.cpf?.includes(term) ||
          c.cnpj?.includes(term) ||
          c.cargo?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "todos") {
      list = list.filter((c) => {
        const s = getStatus(c.id);
        if (statusFilter === "sem_contrato") return s === "Sem contrato";
        if (statusFilter === "enviado") return s === "Enviado para assinatura";
        if (statusFilter === "assinado") return s === "Assinado";
        return true;
      });
    }

    if (setorFilter !== "todos") {
      list = list.filter((c) => c.setor === setorFilter);
    }

    return list;
  }, [colaboradores, searchTerm, statusFilter, setorFilter, statusPorColaborador]);

  const enviarAssinaturaMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/juridico/colaboradores-contrato/${id}/enviar-assinatura`);
      return await res.json() as { emailEnviado?: string };
    },
    onSuccess: (data: { emailEnviado?: string }) => {
      toast({
        title: "Contrato enviado para assinatura",
        description: data.emailEnviado ? `Email enviado para: ${data.emailEnviado}` : "Contrato enviado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/colaboradores-contrato/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar para assinatura",
        description: error.message || "Verifique se o colaborador possui email cadastrado",
        variant: "destructive",
      });
    },
  });

  const marcarAssinadoMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('PATCH', `/api/juridico/colaboradores-contrato/${id}/status`, {
        status: 'Assinado',
      });
    },
    onSuccess: () => {
      toast({ title: "Status atualizado", description: "Contrato marcado como assinado" });
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/colaboradores-contrato/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Não foi possível atualizar o status",
        variant: "destructive",
      });
    },
  });

  const syncStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/juridico/colaboradores-contrato/sync-status');
      return await res.json() as { total: number; atualizados: number; resultados: { colaborador: string; statusAnterior: string; statusNovo: string }[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/juridico/colaboradores-contrato/status"] });
      if (data.atualizados > 0) {
        const detalhes = data.resultados.map(r => `${r.colaborador}: ${r.statusNovo}`).join('\n');
        toast({ title: "Status sincronizado", description: `${data.atualizados} contrato(s) atualizado(s)` });
      } else {
        toast({ title: "Status sincronizado", description: `Nenhuma alteração. ${data.total} contrato(s) verificados.` });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao sincronizar",
        description: error.message || "Não foi possível verificar status no Assinafy",
        variant: "destructive",
      });
    },
  });

  const gerarContrato = (colaborador: Colaborador) => {
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const dataInicioDate = new Date();
    const dataInicio = format(dataInicioDate, "dd/MM/yyyy", { locale: ptBR });
    const dataFimDate = new Date(dataInicioDate);
    dataFimDate.setMonth(dataFimDate.getMonth() + 6);
    const dataFim = format(dataFimDate, "dd/MM/yyyy", { locale: ptBR });
    const { titulo: cargoTitulo, escopo: escopoCargo } = getEscopoCargo(colaborador.cargo);

    const gerarQualificacaoContratada = (): string => {
      const cnpjLimpo = (colaborador.cnpj || '').replace(/\D/g, '');
      const cpfLimpo = (colaborador.cpf || '').replace(/\D/g, '');
      const nome = colaborador.nome || 'Não informado';
      const endereco = colaborador.endereco || 'Não informado';
      const estado = colaborador.estado ? `, ${colaborador.estado}` : '';
      const cnpjFormatado = cnpjLimpo.length === 14
        ? (colaborador.cnpj || cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'))
        : null;
      const cpfFormatado = cpfLimpo.length === 11
        ? (colaborador.cpf || cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'))
        : null;
      if (cnpjFormatado) {
        if (cpfFormatado) {
          return `${nome}, pessoa jurídica de direito privado inscrita no CNPJ ${cnpjFormatado}, com sede na ${endereco}${estado}, devidamente registrado no CPF ${cpfFormatado}.`;
        }
        return `${nome}, pessoa jurídica de direito privado inscrita no CNPJ ${cnpjFormatado}, com sede na ${endereco}${estado}.`;
      }
      if (cpfFormatado) {
        return `${nome}, pessoa física, inscrita no CPF sob o n° ${cpfFormatado}, residente na ${endereco}${estado}.`;
      }
      return `${nome}, com endereço na ${endereco}${estado}.`;
    };

    const patrimonioDescricao = colaborador.patrimonio || 'a definir';

    return CLAUSULAS_CONTRATO
      .replace(/\{\{QUALIFICACAO_CONTRATADA\}\}/g, gerarQualificacaoContratada())
      .replace(/\{\{CARGO_TITULO\}\}/g, cargoTitulo)
      .replace(/\{\{ESCOPO_CARGO\}\}/g, escopoCargo)
      .replace(/\{\{DATA_INICIO\}\}/g, dataInicio)
      .replace(/\{\{DATA_FIM\}\}/g, dataFim)
      .replace(/\{\{VALOR_MENSAL\}\}/g, "A DEFINIR")
      .replace(/\{\{VALOR_EXTENSO\}\}/g, "a definir")
      .replace(/\{\{DATA_ATUAL\}\}/g, dataAtual)
      .replace(/\[X\]/g, patrimonioDescricao);
  };

  const handlePrint = () => {
    if (!selectedColaborador) return;
    const conteudo = gerarContrato(selectedColaborador);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Contrato - ${selectedColaborador.nome}</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; }
              pre { white-space: pre-wrap; font-family: 'Times New Roman', serif; font-size: 14px; }
            </style>
          </head>
          <body>
            <pre>${conteudo}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedColaborador) return;
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const dataAdmissao = selectedColaborador.admissao
      ? format(new Date(selectedColaborador.admissao), "dd/MM/yyyy", { locale: ptBR })
      : "a definir";

    try {
      const response = await fetch("/api/juridico/colaboradores-contrato/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: selectedColaborador.nome,
          cpf: selectedColaborador.cpf,
          cnpj: selectedColaborador.cnpj,
          endereco: selectedColaborador.endereco,
          estado: selectedColaborador.estado,
          cargo: selectedColaborador.cargo,
          dataAdmissao,
          dataAtual,
          salario: selectedColaborador.salario,
          patrimonio: selectedColaborador.patrimonio,
        }),
      });

      if (!response.ok) throw new Error("Erro ao gerar PDF");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Contrato_${selectedColaborador.nome.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao baixar PDF:", error);
      toast({ title: "Erro ao baixar PDF", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <StatsCards
        total={stats.total}
        enviados={stats.enviados}
        assinados={stats.assinados}
        pendentes={stats.pendentes}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
          <Input
            placeholder="Buscar por nome, CPF, CNPJ ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
            data-testid="input-search-colaborador"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="sem_contrato">Sem contrato</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="assinado">Assinado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800">
            <SelectItem value="todos">Todos os setores</SelectItem>
            {setores.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="default"
          onClick={() => syncStatusMutation.mutate()}
          disabled={syncStatusMutation.isPending}
          className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
        >
          {syncStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar Status
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider hidden md:table-cell">Cargo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider hidden lg:table-cell">Setor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider hidden lg:table-cell">CPF/CNPJ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {filteredColaboradores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-zinc-400">
                    Nenhum colaborador encontrado
                  </td>
                </tr>
              ) : (
                filteredColaboradores.map((c) => {
                  const cStatus = getStatus(c.id);
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                      onClick={() => { setSelectedColaborador(c); setSheetOpen(true); }}
                      data-testid={`row-colaborador-${c.id}`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{c.nome}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm text-gray-600 dark:text-zinc-400 truncate max-w-[150px]">{c.cargo || "-"}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-sm text-gray-600 dark:text-zinc-400">{c.setor || "-"}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-sm text-gray-600 dark:text-zinc-400 font-mono text-xs">{c.cnpj || c.cpf || "-"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={cStatus} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
                            onClick={() => {
                              setSelectedColaborador(c);
                              handleDownloadPDF();
                            }}
                            title="Baixar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => {
                              enviarAssinaturaMutation.mutate(c.id);
                            }}
                            disabled={enviarAssinaturaMutation.isPending || !c.email}
                            title={!c.email ? "Sem email" : "Enviar para assinatura"}
                          >
                            {enviarAssinaturaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                          {cStatus === "Enviado para assinatura" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                              onClick={() => marcarAssinadoMutation.mutate(c.id)}
                              disabled={marcarAssinadoMutation.isPending}
                              title="Marcar como assinado"
                            >
                              {marcarAssinadoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sheet lateral */}
      {selectedColaborador && (
        <ColaboradorSheet
          colaborador={selectedColaborador}
          contratoStatus={statusPorColaborador.get(selectedColaborador.id)}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onDownloadPDF={handleDownloadPDF}
          onPrint={handlePrint}
          onEnviarAssinatura={() => enviarAssinaturaMutation.mutate(selectedColaborador.id)}
          onMarcarAssinado={() => marcarAssinadoMutation.mutate(selectedColaborador.id)}
          enviarPending={enviarAssinaturaMutation.isPending}
          marcarPending={marcarAssinadoMutation.isPending}
          contratoTexto={gerarContrato(selectedColaborador)}
        />
      )}
    </div>
  );
}
