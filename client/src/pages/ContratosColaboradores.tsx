import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSetPageInfo } from "@/contexts/PageContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Search,
  User,
  Building2,
  MapPin,
  Download,
  Eye,
  Printer,
  Send,
  Loader2,
} from "lucide-react";
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

CONTRATANTE: TURBO PARTNERS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o n° 42.100.292/0001-84, com sede na Avenida João Batista Parra, 633, Enseada do Suá, Vitória-ES, 29052-120, neste ato representada por seu sócio Rodrigo Queiroz Santos;

CONTRATADA: {{QUALIFICACAO_CONTRATADA}}

Têm entre si, justo e contratado, o presente Contrato de Prestação de Serviços, mediante as seguintes cláusulas e condições:


CLÁUSULA PRIMEIRA – DO OBJETO DO CONTRATO

1.1. O CONTRATADO prestará serviços como {{CARGO_TITULO}}. Para isso, deverá designar pessoa legalmente certificada e habilitada para a execução dos serviços.

1.1.1. Os serviços serão prestados por pessoa previamente indicada pelo CONTRATADO e compreendem, de modo exemplificativo, as seguintes atribuições: {{ESCOPO_CARGO}}

Parágrafo Primeiro. Fica certo e ajustado entre as PARTES que não haverá qualquer controle de horário e/ou carga horária do profissional alocado pela CONTRATADA para a execução dos serviços, tampouco obrigatoriedade quanto ao local de realização das tarefas.

Parágrafo Segundo. Toda e qualquer pessoa eventualmente envolvida pela CONTRATADA na execução dos serviços contratados atuará em nome e por conta exclusiva da própria CONTRATADA, sendo esta a única responsável por sua relação jurídica, operacional e contratual com tais profissionais, sem qualquer vínculo direto ou indireto com a CONTRATANTE.

Parágrafo Terceiro. As atribuições descritas nesta cláusula são meramente exemplificativas e poderão variar conforme entendimento técnico da CONTRATADA, respeitados os objetivos finais acordados entre as Partes.


CLÁUSULA SEGUNDA – DO PRAZO

2.1 – O presente contrato tem prazo de 6 (seis) meses, com início em {{DATA_INICIO}} e fim em {{DATA_FIM}}. Ao final deste prazo, o CONTRATO poderá ser renovado mediante manifestação expressa das partes, ocasião em que será reavaliado o escopo e as condições comerciais, desde que nenhuma das partes se manifeste no prazo de antecedência mínimo de 30 (trinta) dias anteriores ao término temporal contratual.

Parágrafo Primeiro. Ao final deste prazo, o contrato poderá ser renovado, sendo este realizado por simples aditivo contratual.

Parágrafo Segundo. O presente contrato será considerado rescindido de pleno direito, no caso de falência, concordata ou liquidação, de quaisquer das partes, não sendo aplicável nesse caso nenhuma multa ou indenização.

Parágrafo Terceiro. No caso de encerramento do presente contrato, a CONTRATADA deverá devolver, à CONTRATANTE, todo material em seu poder e que pertença à CONTRATANTE. A CONTRATANTE deverá quitar quaisquer pagamentos devidos por eventuais perdas e danos.


CLÁUSULA TERCEIRA – DA REMUNERAÇÃO

3.1 - A título de contraprestação pelos serviços prestados no âmbito deste contrato, a CONTRATADA fará jus à remuneração no valor de R$ {{VALOR_MENSAL}} ({{VALOR_EXTENSO}}) mensais, enquanto vigente o presente instrumento, observado o escopo e a periodicidade das entregas pactuadas entre as partes.

Parágrafo Primeiro. Os valores que resultarem do disposto nesta cláusula constituem os únicos valores/créditos devidos pela CONTRATANTE ao CONTRATADO em razão do presente contrato, eximindo-se a CONTRATANTE de responder por quaisquer outros valores que sejam cobrados pelo CONTRATADO.

Parágrafo Segundo. Até o 25° (vigésimo quinto) dia do mês subsequente à prestação dos serviços, a CONTRATANTE providenciará o pagamento da CONTRATADA, desde que cumpridas todo o escopo de entregas previstas no presente instrumento contratual.

Parágrafo Terceiro. Até o 10° (décimo) dia anterior à data de pagamento e condicionado à plena constatação de cumprimento das entregas previstas, o CONTRATADO deverá emitir a competente Nota Fiscal, remetendo-a imediatamente à CONTRATANTE.

Parágrafo Quarto. Caso em determinado exercício mensal haja a interrupção ou suspensão na prestação dos serviços, o pagamento será feito de modo proporcional ao período de efetiva execução das tarefas.

Parágrafo Quinto. O recolhimento dos tributos incidentes sobre os Serviços, assim como o cumprimento das correspondentes obrigações tributárias acessórias, são de exclusiva responsabilidade da CONTRATADA, exceto nas hipóteses em que a CONTRATANTE deva, em razão de disposição legal, promover a retenção dos valores a serem pagos ao Fisco (Municipal, Estadual ou Federal).

Parágrafo Sexto. O comprovante de depósito ou transferência servirá como recibo e prova de quitação e pagamento da obrigação ajustada.


CLÁUSULA QUARTA – DAS OBRIGAÇÕES DO CONTRATADO

4.1 - São obrigações do CONTRATADO:

I. Prestar os serviços contratados em conformidade com os padrões de qualidade acordados e com a boa técnica profissional aplicável ao setor.

II. Fornecer as notas fiscais referentes aos pagamentos efetuados pela CONTRATANTE dentro do prazo previamente estipulado por meio do presente instrumento;

III. Arcar com todas as despesas de natureza tributária decorrentes dos serviços especificados neste contrato;

IV. Cumprir todas as determinações impostas pelas autoridades públicas competentes, referentes a estes serviços;

V. Manter sigilosas, mesmo após findo este contrato, as informações privilegiadas de qualquer natureza às quais tenham acesso em virtude da execução destes serviços, pelo prazo de 5 (cinco) anos;

VI. Comprometer-se a utilizar os equipamentos disponibilizados unicamente para fins profissionais relacionados às entregas pactuadas, observando as diretrizes técnicas definidas pela CONTRATANTE.

Parágrafo Primeiro. Os documentos pertencentes ou em posse da empresa contratante depositados em mídias físicas ou digitais somente devem ser abertos e tratados em computadores credenciados e de propriedade da CONTRATANTE.

Parágrafo Segundo. Sobre os computadores e demais equipamentos fornecidos para a prestação dos serviços não devem ser instalados programas alheios sem a autorização da CONTRATANTE.


CLÁUSULA QUINTA – DAS OBRIGAÇÕES DA CONTRATANTE

5.1 - São obrigações da CONTRATANTE:

I. Fornecer todas as informações necessárias à execução dos serviços, incluindo diretrizes e objetivos, respeitada a autonomia técnica e operacional da CONTRATADA quanto aos meios e métodos empregados.

II. Efetuar o pagamento, nas datas e nos termos definidos neste contrato;

III. Manifestar, de forma expressa, eventuais críticas, dúvidas, solicitações, novas orientações e sugestões pertinentes aos serviços, quando existirem;


CLÁUSULA SEXTA – DA RESCISÃO E EXTINÇÃO DO CONTRATO

6.1. O presente contrato poderá ser rescindido, a qualquer tempo, por qualquer das partes, independentemente de motivação, mediante comunicação prévia e escrita à outra parte, com antecedência mínima de 30 (trinta) dias, sem que disso decorra o pagamento de multa ou indenização, ressalvadas as obrigações já vencidas.

6.2. O contrato poderá ser rescindido de forma motivada, por qualquer das partes, independentemente de aviso prévio, nas seguintes hipóteses:

    6.2.1. Descumprimento, pela outra parte, de quaisquer obrigações assumidas neste contrato, inclusive atraso na entrega dos serviços, execução inadequada do objeto ou violação de cláusulas contratuais;

    6.2.2. Prática de atos que comprometam a continuidade, a regularidade ou a finalidade do contrato.

6.3. O contrato será considerado automaticamente extinto, independentemente de aviso ou notificação, nas seguintes hipóteses:

    6.3.1. Impossibilidade superveniente de execução do contrato por motivo de força maior ou caso fortuito, devidamente comprovado;

    6.3.2. Encerramento, dissolução ou extinção das atividades empresariais da CONTRATANTE.


CLÁUSULA SÉTIMA – DA INEXISTÊNCIA DE VÍNCULO TRABALHISTA E SOCIETÁRIO

7.1. - Não se estabelece, por força do presente contrato, nenhum vínculo empregatício, nem enseja qualquer tipo de subordinação e pessoalidade entre a CONTRATANTE e o pessoal do CONTRATADO, sendo certo que as obrigações e direitos das partes limita-se ao expressamente avençado neste contrato.

7.2. O próprio CONTRATADO, na qualidade de prestador de serviços estabelecerá e concretizará, cotidianamente, a forma de realização dos serviços pactuados no presente termo.

Parágrafo Primeiro. O CONTRATADO tem ciência e declara que nenhum ex-empregado da CONTRATANTE cujo contrato de trabalho tenha se encerrado há menos de 18 (dezoito) meses poderá ser alocado pelo CONTRATADO na prestação dos serviços.

Parágrafo Segundo. O CONTRATADO tem ciência e declara que tem capacidade técnico-financeira para arcar com suas responsabilidades contratuais e extracontratuais, vinculada ou não a este contrato, e que não possui nem se colocará em situação de dependência econômica com relação ao resultado financeiro deste contrato.

Parágrafo Terceiro. O CONTRATADO declara assumir integralmente os riscos relacionados à atividade empresarial que exerce, inclusive quanto à gestão de sua equipe, métodos de trabalho, investimentos necessários e responsabilidade pelos resultados.

Parágrafo Quarto. O CONTRATADO tem ciência e declara que nada neste contrato poderá ser interpretado como tendo as partes, estabelecido qualquer forma de sociedade, associação, agência ou consórcio, de fato ou de direito, permanecendo cada uma das partes com as suas obrigações civis, comerciais, trabalhistas e tributárias, de forma autônoma.

Parágrafo Quinto. Não haverá controles de horários de chegada ou saída ou subordinação, com total autonomia da CONTRATADA em relação à CONTRATANTE, se comprometendo a CONTRATANTE a executar os serviços contratados através das horas necessárias à execução dos serviços, conforme acordado, sob pena dos respectivos descontos.


CLÁUSULA OITAVA – DA CONFIDENCIALIDADE E DIREITO DE IMAGEM

8.1. - As partes concordam que, sem o consentimento escrito, não poderão revelar ou divulgar, direta ou indiretamente, no todo ou em parte, isolada ou juntamente com terceiros, qualquer informação confidencial referente ao presente contrato. As disposições desta cláusula sobreviverão após o prazo de 05 (cinco) anos posteriores à vigência deste contrato ou à rescisão do mesmo por qualquer razão.

Parágrafo Primeiro. Para os propósitos, serão consideradas "informações confidenciais" todas e quaisquer informações e/ou dados de natureza confidencial (incluindo, sem limitação, os termos e condições deste contrato e todos os segredos e/ou informações operacionais, econômicas e técnicas, bem como demais informações comerciais ou "know-how").

Parágrafo Segundo. O descumprimento da presente cláusula enseja o pagamento, por parte da CONTRATADA ao CONTRATANTE, de multa não compensatória fixada em R$50.000,00 (cinquenta mil reais).

8.2. O CONTRATADO autoriza, de forma livre, expressa, irrevogável e irretratável, a utilização de sua imagem, nome e voz pela CONTRATANTE, para fins institucionais, comerciais e publicitários relacionados ao objeto deste contrato.


CLÁUSULA NONA – DA INEXISTÊNCIA DE LICENÇAS

9.1. A CONTRATANTE reterá todo o direito, titularidade e interesse sobre as informações confidenciais presentes no presente contrato.

9.2. São e serão considerados como propriedade intelectual e/ou industrial única e exclusiva da CONTRATANTE qualquer produto, criação, desenvolvimento, relatório, planilha, resultado, dentre outros, ainda que tenham sido desenvolvidos pela CONTRATADA.


CLÁUSULA DÉCIMA – DA ABSTENÇÃO DE ALICIAMENTO

10.1. - Durante a vigência deste instrumento e por um período de 24 (vinte e quatro) meses após sua extinção, o CONTRATADO se compromete a não contratar, ou tentar contratar, direta ou indiretamente, qualquer empregado(a) da CONTRATANTE.

10.2. - Sem prejuízo das indenizações por perdas e danos e da responsabilidade criminal, o CONTRATADO, em caso de infração da presente cláusula, pagará ao CONTRATANTE uma multa não compensatória igual a R$ 100.000,00 (cem mil reais) por cada infração.


CLÁUSULA DÉCIMA PRIMEIRA– DA PROTEÇÃO DE DADOS PESSOAIS

11.1. - Seguindo as determinações da Lei 13.709/2018 ("Lei Geral de Proteção de Dados Pessoais") o CONTRATADO se compromete a manter segredo absoluto dos assuntos relacionados aos serviços prestados, bem como de todos os dados e informações relativos aos resultados obtidos na prestação do serviço.

Parágrafo Primeiro. As partes se comprometem a não utilizar os dados pessoais que tiverem acesso para fins distintos da relação estabelecida, sendo vedada a transmissão para terceiros.


CLÁUSULA DÉCIMA SEGUNDA– DO USO E RESPONSABILIDADE PELOS EQUIPAMENTOS FORNECIDOS

12.1. A CONTRATANTE poderá disponibilizar, em regime de comodato, um computador de sua propriedade, para uso exclusivo da CONTRATADA na execução dos serviços contratados neste instrumento.

12.2. A CONTRATADA compromete-se a zelar pelo bom estado de conservação, uso adequado e exclusivo do equipamento disponibilizado.

12.3. A CONTRATADA será responsável integral por qualquer dano, perda, extravio, furto, roubo ou mau uso do equipamento.

12.4. O equipamento deverá ser devolvido à CONTRATANTE no ato de rescisão do contrato, em perfeito estado de funcionamento e conservação.


CLÁUSULA DÉCIMA TERCEIRA – DAS DISPOSIÇÕES GERAIS

13.1. Nenhuma das Partes poderá ceder ou transferir quaisquer direitos ou obrigações decorrentes deste contrato a terceiros, total ou parcialmente, sem o prévio e expresso consentimento por escrito da outra Parte.

13.2. O presente contrato é celebrado em caráter irrevogável e irretratável, obrigando as Partes e seus sucessores.

13.3. A tolerância das Partes com relação a inadimplemento ou não cumprimento de qualquer obrigação, cláusula, termo ou condição ora estabelecida não constitui precedente, renúncia a obrigações, emenda ou renovação do contrato, e sim mera liberalidade.

13.4. A declaração de nulidade ou anulação de qualquer dos dispositivos contidos neste instrumento não invalidará suas demais disposições, as quais permanecerão em pleno vigor.

13.5. Não se estabelece, por força deste instrumento, qualquer forma de sociedade, associação, agência, consórcio, participação societária, ou responsabilidade solidária entre as partes.

13.6. O objeto deste contrato não visa proporcionar nenhuma espécie de vantagem fiscal, trabalhista ou previdenciária a qualquer Parte ou a terceiros, e não implica vínculo empregatício entre uma das partes e os funcionários/prepostos da outra, ficando a cargo de cada uma delas a responsabilidade referente aos encargos sociais, tributários, previdenciários e trabalhistas de seus respectivos colaboradores.

13.7. Os tributos (impostos, taxas, emolumentos, contribuições fiscais e parafiscais) que sejam devidos em decorrência direta ou indireta do presente contrato ou de sua execução, serão de exclusiva responsabilidade do contribuinte, conforme definido na norma tributária, autorizadas as retenções legais, sem direito a reembolso.

13.8. O presente CONTRATO é o instrumento que regula todos os direitos e obrigações acordadas entre as Partes, substituindo todo e qualquer CONTRATO ou entendimento previamente realizado pelas Partes.

13.9. Toda e qualquer modificação deste CONTRATO somente poderá ocorrer mediante aditamento, o qual deverá observar, obrigatoriamente, a forma escrita.

13.10. Na hipótese de qualquer autuação, fiscalização, imposição de multa, desenquadramento ou fixação de qualquer outra sanção, de qualquer natureza, em desfavor da CONTRATADA, em especial em matéria tributária ou trabalhista, nenhuma responsabilidade incumbirá à CONTRATANTE, a qual fica desobrigada de qualquer pagamento ou assunção de despesas, sendo de rigor, ao revés, a obrigação de a CONTRATADA indenizar a CONTRATANTE por eventuais prejuízos decorrentes de tais eventos.

13.11. Para fins de prova e, por derradeiro, para dirimir quaisquer dúvidas, controvérsias ou litígios oriundos do presente CONTRATO, tanto para procedimento judicial quanto arbitral ou de mediação, valerá a versão digital da via de cada Parte, com a devida certificação da plataforma digital utilizada para a assinatura eletrônica deste CONTRATO.

13.12. Fica eleito o Foro da Comarca de Vitória/ES para nele serem dirimidas eventuais dúvidas ou questões oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.

13.13. Declaram as Partes que as obrigações aqui presentes são celebradas de boa-fé, livremente e de comum acordo, não existindo quaisquer vícios ou defeitos que possam acarretar a sua nulidade, em especial aqueles relacionados com dolo, erro, fraude, simulação ou coação, inexistindo também qualquer fato que possa ser configurado como estado de perigo ou de necessidade.

As Partes neste ato declaram que (i) é admitida como válida e verdadeira a assinatura deste Contrato por meio de certificado digital emitido por entidades credenciadas para tanto pela Infraestrutura de Chaves Públicas Brasileira - ICP-Brasil; e (ii) são admitidas como válidas e originais as vias deste Contrato emitidas por meios de comprovação da autoria e integridade de documentos em forma eletrônica, inclusive os que utilizem certificados não emitidos pela ICP-Brasil.

Em testemunho do quê, as PARTES assinaram este Memorando em 3 (três) vias contendo os mesmos termos e condições, conjuntamente com 2 (duas) testemunhas.


Vitória, {{DATA_ATUAL}}.



____________________________________________________
TURBO PARTNERS LTDA
CONTRATANTE



____________________________________________________
{{NOME}}
CONTRATADO(A)
`;

export default function ContratosColaboradores() {
  useSetPageInfo("Contratos Colaboradores", "Geração de contratos para colaboradores");
  usePageTitle("Contratos Colaboradores | Turbo Cortex");
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data, isLoading } = useQuery<{ colaboradores: Colaborador[] }>({
    queryKey: ["/api/juridico/colaboradores-contrato"],
  });

  const colaboradores = data?.colaboradores || [];

  const enviarAssinaturaMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('POST', `/api/juridico/colaboradores-contrato/${id}/enviar-assinatura`);
    },
    onSuccess: (data: { emailEnviado?: string }) => {
      toast({ 
        title: "Contrato enviado para assinatura", 
        description: data.emailEnviado ? `Email enviado para: ${data.emailEnviado}` : "Contrato enviado com sucesso"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao enviar para assinatura", 
        description: error.message || "Verifique se o colaborador possui email cadastrado",
        variant: "destructive"
      });
    },
  });

  const filteredColaboradores = useMemo(() => {
    if (!searchTerm) return colaboradores;
    const term = searchTerm.toLowerCase();
    return colaboradores.filter(
      (c) =>
        c.nome?.toLowerCase().includes(term) ||
        c.cpf?.includes(term) ||
        c.cnpj?.includes(term) ||
        c.cargo?.toLowerCase().includes(term)
    );
  }, [colaboradores, searchTerm]);

  const gerarContrato = (colaborador: Colaborador) => {
    const dataAtual = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    // Data de início (admissão ou data atual)
    const dataInicio = colaborador.admissao
      ? format(new Date(colaborador.admissao), "dd/MM/yyyy", { locale: ptBR })
      : format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    
    // Data fim (6 meses após início)
    const dataInicioDate = colaborador.admissao ? new Date(colaborador.admissao) : new Date();
    const dataFimDate = new Date(dataInicioDate);
    dataFimDate.setMonth(dataFimDate.getMonth() + 6);
    const dataFim = format(dataFimDate, "dd/MM/yyyy", { locale: ptBR });
    
    // Obter escopo baseado no cargo
    const { titulo: cargoTitulo, escopo: escopoCargo } = getEscopoCargo(colaborador.cargo);
    
    // Estado como complemento (se existir)
    const estadoComplemento = colaborador.estado ? `, ${colaborador.estado}` : "";
    
    // Detectar se é pessoa física (CPF) ou jurídica (CNPJ)
    const gerarQualificacaoContratada = (): string => {
      const cnpjLimpo = (colaborador.cnpj || '').replace(/\D/g, '');
      const cpfLimpo = (colaborador.cpf || '').replace(/\D/g, '');
      const nome = colaborador.nome || 'Não informado';
      const endereco = colaborador.endereco || 'Não informado';
      const estado = colaborador.estado ? `, ${colaborador.estado}` : '';
      
      // Se tem CNPJ válido (14 dígitos), é pessoa jurídica
      if (cnpjLimpo.length === 14) {
        const cnpjFormatado = colaborador.cnpj || cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        if (cpfLimpo.length === 11) {
          const cpfFormatado = colaborador.cpf || cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
          return `${nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o n° ${cnpjFormatado}, representada por seu responsável legal portador do CPF n° ${cpfFormatado}, com sede na ${endereco}${estado}.`;
        }
        return `${nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o n° ${cnpjFormatado}, com sede na ${endereco}${estado}.`;
      }
      
      // Se tem CPF válido (11 dígitos), é pessoa física
      if (cpfLimpo.length === 11) {
        const cpfFormatado = colaborador.cpf || cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return `${nome}, pessoa física, inscrita no CPF sob o n° ${cpfFormatado}, residente na ${endereco}${estado}.`;
      }
      
      // Fallback
      const docDisponivel = colaborador.cnpj || colaborador.cpf || 'Não informado';
      return `${nome}, inscrita no documento n° ${docDisponivel}, com endereço na ${endereco}${estado}.`;
    };

    return CLAUSULAS_CONTRATO
      .replace(/\{\{QUALIFICACAO_CONTRATADA\}\}/g, gerarQualificacaoContratada())
      .replace(/\{\{CARGO_TITULO\}\}/g, cargoTitulo)
      .replace(/\{\{ESCOPO_CARGO\}\}/g, escopoCargo)
      .replace(/\{\{DATA_INICIO\}\}/g, dataInicio)
      .replace(/\{\{DATA_FIM\}\}/g, dataFim)
      .replace(/\{\{VALOR_MENSAL\}\}/g, "A DEFINIR")
      .replace(/\{\{VALOR_EXTENSO\}\}/g, "a definir")
      .replace(/\{\{DATA_ATUAL\}\}/g, dataAtual);
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
          cpfCnpj: selectedColaborador.cnpj || selectedColaborador.cpf,
          endereco: selectedColaborador.endereco,
          estado: selectedColaborador.estado,
          cargo: selectedColaborador.cargo,
          dataAdmissao,
          dataAtual,
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
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Contratos Colaboradores</h1>
          <p className="text-muted-foreground">Gere contratos de prestação de serviços para colaboradores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Selecionar Colaborador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF, CNPJ ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-colaborador"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredColaboradores.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum colaborador encontrado
                </p>
              ) : (
                filteredColaboradores.map((colaborador) => (
                  <div
                    key={colaborador.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover-elevate ${
                      selectedColaborador?.id === colaborador.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    onClick={() => {
                      setSelectedColaborador(colaborador);
                      setShowPreview(true);
                    }}
                    data-testid={`card-colaborador-${colaborador.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{colaborador.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {colaborador.cargo || "Cargo não informado"}
                        </p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>{colaborador.cnpj || colaborador.cpf || "-"}</p>
                        <p>{colaborador.setor || "-"}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Preview do Contrato
              </span>
              {selectedColaborador && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrint}
                    data-testid="button-print-contrato"
                  >
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadPDF}
                    data-testid="button-download-contrato"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Baixar PDF
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => enviarAssinaturaMutation.mutate(selectedColaborador.id)}
                    disabled={enviarAssinaturaMutation.isPending || !selectedColaborador.email}
                    data-testid="button-enviar-assinatura"
                    title={!selectedColaborador.email ? "Colaborador não possui email cadastrado" : "Enviar para assinatura via Assinafy"}
                  >
                    {enviarAssinaturaMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-1" />
                    )}
                    Enviar para Assinatura
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedColaborador ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>Selecione um colaborador para visualizar o contrato</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Nome</p>
                      <p className="font-medium">{selectedColaborador.nome}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                      <p className="font-medium">
                        {selectedColaborador.cnpj || selectedColaborador.cpf || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Endereço</p>
                      <p className="font-medium">
                        {selectedColaborador.endereco || "Não informado"}
                        {selectedColaborador.estado && ` - ${selectedColaborador.estado}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto p-4 bg-card border rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {gerarContrato(selectedColaborador)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
