-- Seed: planejamento de broadcasts de JUNHO/2026 (gerado pela IA)
-- Snapshot versionado das copies (a fonte viva é cortex_core.broadcast_plan no Postgres).
-- Restauração idempotente: remove os slots auto-gerados de junho e reinsere este snapshot.
-- Preserva slots manuais (created_by que não começa com auto-IA).
BEGIN;
DELETE FROM cortex_core.broadcast_plan WHERE plan_date BETWEEN '2026-06-01' AND '2026-06-30' AND created_by LIKE 'auto-IA%';
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-01'::date,'WhatsApp','Geral - Todos','Agendar reunião','PERGUNTA_ESPELHO','Pergunta-espelho marketing sem clareza','Você sabe dizer, sem chutar, quanto cada real investido em marketing te traz de volta?

Se a resposta veio meio "acho que...", esse é exatamente o problema.

A maioria dos negócios que faturam bem ainda toca aquisição no feeling, sem saber o que dá retorno e o que só queima caixa.

Dá pra enxergar isso com clareza e parar de apostar no escuro.

Quer que eu faça um diagnóstico rápido do seu hoje? Me responde aqui que eu te explico como funciona.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-02'::date,'WhatsApp','Clientes','Agendar reunião','EVENTO','Convite diagnóstico segundo semestre','Metade do ano tá quase indo embora e é agora que dá pra ajustar a rota do seu negócio.

Na correria do dia a dia é fácil deixar passar oportunidade de crescimento que tá bem na nossa frente.

Quero reservar uns 30 min com você pra olhar os números do que já rodamos juntos e desenhar o próximo movimento.

Te faz sentido marcar essa conversa essa semana? Me responde aqui que eu já encaixo no melhor horário.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-03'::date,'WhatsApp','Creators - Todos','Agendar reunião','CONTRASTE','Contraste UGC Creators','Tem empresário queimando grana com criador de conteúdo e nem percebe.

✗ Contrata creator bonito de seguir e torce pra dar venda
✗ Pede "um vídeo viral" sem roteiro e sem oferta clara
✗ Mede pelo like, não pelo caixa

✓ Creator certo pro SEU público, com vídeo feito pra converter
✓ Roteiro testado, oferta na cara e CTA que vende
✓ Mensura por venda, não por curtida

Se você tá no lado ✗, dá pra virar isso rápido.

Quer que eu te mostre como ficaria pro seu negócio? Responde aqui.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-04'::date,'WhatsApp','Congelados','Agendar reunião','PERGUNTA_ESPELHO','Reativação lead frio','Quanto do seu faturamento hoje ainda depende de indicação e sorte, e não de um canal de aquisição que você controla?

Sei que sumi faz um tempo, sem desculpa.

Mas voltei justamente porque a gente refez a forma de gerar demanda pra negócios do seu porte e os números mudaram demais.

Vale eu te mostrar num diagnóstico rápido como ficaria no seu caso?

Responde aqui que eu te explico.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-05'::date,'WhatsApp','Geral - MQLs','Agendar reunião','URGENCIA_SAZONAL','Dia do Meio Ambiente: budget desperdiçado','Hoje é Dia do Meio Ambiente, e o papo aqui é desperdício.

Só que o lixo que me preocupa é o da sua verba de mídia.

Quanto do seu orçamento virou clique que não converteu, lead que ninguém ligou e post bonito que não vendeu nada?

Desperdício de budget é o maior poluente do marketing — e dá pra reciclar isso em retorno rastreável.

Quer que eu olhe onde sua verba tá vazando? Me responde aqui que eu te mostro.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-08'::date,'WhatsApp','CRM - MQLs','Agendar reunião','URGENCIA_SAZONAL','Fechamento do 1º semestre — CRM','Seu comercial tá vendendo redondo ou ainda tem lead caindo no esquecimento?

Lembra do que você planejou em janeiro pro time: previsibilidade na receita, nenhum negócio perdido por falta de follow-up.

Se ainda tá vendendo "no feeling", dá pra arrumar o 2º semestre inteiro a partir de agora.

Monto um diagnóstico rápido do seu funil e te mostro onde tá vazando dinheiro.

Te faz sentido eu te chamar pra essa conversa?','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-09'::date,'WhatsApp','Geral - Entre 30k a 100k','Agendar reunião','URGENCIA_SAZONAL','Fechamento do 1º semestre','Lembra do número que você projetou pra esse negócio lá em janeiro?

Metade do ano praticamente foi. Se o crescimento que você planejou ainda não chegou, não é falta de esforço — é falta de um motor de aquisição previsível.

A boa notícia: ainda dá pra fechar o ano no número certo. O 2º semestre é onde a virada acontece.

Topa um diagnóstico rápido pra eu te mostrar onde tá travando? Me responde aqui que eu te explico.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-10'::date,'WhatsApp','Creators - Entre 30k a 100k','Agendar reunião','HOOK_PROVOCATIVO','UGC sem virar influencer','Influenciador caro não é o que faz sua marca vender mais.

Hoje quem converte é o vídeo que PARECE real, não o que parece anúncio. Creators certos gravando pra sua empresa vendem mais que post patrocinado de famoso — por uma fração do custo.

Pra um negócio que já fatura bem, isso vira escala com previsibilidade, não aposta.

Me responde aqui: hoje você já testa vídeo de criador pra divulgar a empresa, ou ainda tá só no tráfego puro?','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-11'::date,'WhatsApp','Geral - Abaixo de 30k','Agendar reunião','EVENTO','Diagnóstico gargalo faturamento','Tem mês que o caixa enche, tem mês que seca — e você nunca sabe o porquê.

Quase sempre não é falta de esforço. É um gargalo no funil que ninguém te mostrou ainda: ou entra pouco lead, ou entra e não vira venda.

Tô abrindo uns horários essa semana pra sentar com alguns donos de negócio e mapear esse ponto exato.

Em 20 min eu te mostro onde tá travando o seu crescimento.

Quer que eu reserve um horário pra você? Me responde aqui.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-12'::date,'WhatsApp','Creators - Abaixo de 30k','Agendar reunião','URGENCIA_SAZONAL','Namorados: venda nos 21 dias antes','Dia dos Namorados é a 3ª maior data do varejo no Brasil.

E quase todo mundo erra igual: posta um coraçãozinho no dia 12 e acha que fez marketing.

Mas a venda não acontece no dia. Ela acontece nos 21 dias ANTES — com oferta no ar e criadores mostrando seu produto pra quem ainda tá decidindo onde comprar.

Dá pra começar enxuto: alguns vídeos de UGC rodando + uma oferta clara.

Você já tá com algo no ar ou vai chegar atrasado de novo? Me responde aqui que eu te mostro como montar isso a tempo.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-15'::date,'WhatsApp','Contatos Espírito Santo','Agendar reunião','URGENCIA_SAZONAL','Metade do ano ES','Aquele plano de crescimento que você desenhou em janeiro... saiu do papel?

A gente acompanha empresários aqui do ES de perto e o padrão se repete: o 1º semestre escapa e o jogo todo fica pro 2º.

Dá tempo de virar essa chave antes de julho.

Quer que eu monte um diagnóstico rápido do seu marketing pra fechar o ano no azul? Me responde aqui.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-16'::date,'WhatsApp','IA - MQLs','Agendar reunião','HOOK_PROVOCATIVO','IA sem estrategia nao escala','IA não vai escalar seu negócio. Sozinha, ela só acelera a bagunça que já existe.

O que separa quem fatura mais com IA dos que só "testam ferramenta" é uma coisa: ter o processo certo ANTES de automatizar.

Quem não tem isso gasta tempo brincando de prompt e não muda o caixa.

Posso te mostrar onde a IA realmente move o ponteiro no seu caso, numa conversa rápida de diagnóstico.

Faz sentido pra você? Me responde aqui.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-17'::date,'WhatsApp','IA - Todos','Agendar reunião','CONTRASTE','IA: jeito errado vs certo','Tem gente jogando dinheiro fora com IA e nem percebe.

O jeito errado (o que quase todo mundo faz):
✗ Pede texto pro ChatGPT e cola no anúncio
✗ Testa ferramenta nova toda semana sem método
✗ Usa IA só pra "escrever post"

O jeito certo:
✓ IA conectada no seu funil, gerando lead e vendendo
✓ Operação que roda no automático enquanto você escala

A diferença separa quem brinca de IA de quem fatura com ela.

Quer que eu te mostre onde o seu negócio tá perdendo isso? Responde aqui que eu te explico.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-18'::date,'WhatsApp','CRM - Todos','Agendar reunião','CONTRASTE','CRM: jeito errado x certo','Tem empresa que perde venda não por falta de lead, mas por falta de processo.

O jeito que trava:
✗ Lead chega e fica esperando alguém "lembrar" de responder
✗ Follow-up no feeling, anotado no caderninho ou na cabeça
✗ Ninguém sabe quantas oportunidades estão abertas agora

O jeito que vende:
✓ Cada lead com dono, prazo e próximo passo claro
✓ Funil organizado, do primeiro contato ao fechamento
✓ Você enxergando o comercial em tempo real, não só no fim do mês

Monto um diagnóstico rápido do seu processo comercial e te mostro onde está vazando.

Te faz sentido a gente conversar?','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-19'::date,'WhatsApp','Geral - Todos','Agendar reunião','PERGUNTA_ESPELHO','Pergunta-espelho marketing travado','Quanto do seu faturamento hoje depende de indicação e sorte?

Se a resposta te incomodou, é sinal de que o marketing ainda não virou uma máquina previsível no seu negócio.

A maioria dos donos que a gente conversa fatura bem, mas não sabe de onde vem o próximo cliente.

Dá pra trocar isso por um fluxo que você controla.

Quer que eu faça um diagnóstico rápido do seu cenário? Responde aqui que eu te mostro por onde começar.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-22'::date,'WhatsApp','Clientes','Agendar reunião','EVENTO','Convite diagnóstico de meio de ano','O segundo semestre costuma definir como você fecha o ano.

Antes de a gente acelerar, vale parar 30 min e olhar o que tá travando o crescimento aí dentro: o que escalar, o que cortar e onde tem caixa parado no que já rodamos.

Quero abrir uma agenda de diagnóstico com você essa semana pra desenhar o jogo do semestre.

Te faz sentido? Me responde aqui que já te mando os horários.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-23'::date,'WhatsApp','Creators - Todos','Agendar reunião','CONTRASTE','Contraste UGC/Creators','Vídeo institucional bonitão é onde muito empresário enterra verba sem perceber.

O jeito que quase todo mundo faz:
✗ vídeo institucional que ninguém assiste
✗ você mesmo gravando, sem tempo e sem jeito
✗ post genérico que parece propaganda de longe

O jeito que converte:
✓ criadores reais falando do seu produto como gente normal
✓ vídeo que parece recomendação de amigo, não anúncio
✓ volume de conteúdo testado pra escalar o que vende

A gente cuida disso pro seu negócio ponta a ponta.

Quer que eu te mostre como ficaria no seu caso? Responde aqui.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-24'::date,'WhatsApp','Congelados','Agendar reunião','URGENCIA_SAZONAL','Reativação meio do ano','Faz um tempão que a gente não fala, e eu não vou fingir que não.

Mas o ano virou a metade e isso me fez lembrar de você.

O que move o seu negócio hoje ainda depende de indicação? Indicação é ótima, só que quando seca, a agenda esvazia e não tem o que fazer.

Quem construiu autoridade no digital parou de torcer pra agenda lotar e passou a ESCOLHER cliente.

O 2º semestre é a janela certa pra começar. Te faz sentido conversar 20 min sobre o seu caso?','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-25'::date,'WhatsApp','Geral - MQLs','Agendar reunião','URGENCIA_SAZONAL','Fechamento do 1º semestre','Aquela meta de faturamento que você desenhou em janeiro: tá no ritmo certo pra fechar o ano no azul?

Se a resposta te deu um nó no estômago, ainda dá tempo de virar o jogo no 2º semestre — mas a janela pra ajustar é AGORA.

Separei 30 min pra olhar seus números de aquisição com você e mapear onde tá travando.

Te faz sentido marcar essa conversa essa semana? Me responde aqui que eu já te passo os horários.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-26'::date,'WhatsApp','Creators - MQLs','Agendar reunião','URGENCIA_SAZONAL','Junho da marca arco-íris','Teve marca que pintou o logo de arco-íris esse mês, postou uma vez e sumiu.

O consumidor sente o cheiro do oportunismo. Isso não constrói marca, constrói desconfiança.

Quem aparece o ano inteiro, com criador real falando do seu produto, é quem fica na cabeça do cliente.

É isso que a gente entrega com Creators/UGC: presença com verdade, não evento de calendário.

Quer que eu te mostre como ficaria pra sua empresa? Responde aqui que eu te explico.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-29'::date,'WhatsApp','CRM - MQLs','Agendar reunião','URGENCIA_SAZONAL','CRM 1º semestre fechando','A meta de vendas que você traçou em janeiro bate com o número real de hoje?

Na maioria das vezes o problema não é falta de lead — é lead esfriando dentro de um comercial sem CRM e sem processo. Dinheiro vazando todo dia.

O 1º semestre tá fechando e o 2º é onde dá pra virar o jogo, mas só com o funil organizado.

Quer que eu faça um diagnóstico rápido do seu processo comercial? Me responde aqui que eu te mostro onde tá vazando.','pronta','auto-IA·editado',NOW(),NOW());
INSERT INTO cortex_core.broadcast_plan (plan_date,canal,base,objetivo,padrao,titulo,copy_text,status,created_by,created_at,updated_at) VALUES ('2026-06-30'::date,'WhatsApp','Geral - Entre 30k a 100k','Agendar reunião','URGENCIA_SAZONAL','Fechamento do 1º semestre','Aquela meta que você desenhou em janeiro pro negócio: tá no caminho ou virou "ano que vem eu organizo"?

Quem fatura bem já tem caixa pra escalar. O que falta quase sempre é previsibilidade, não dinheiro.

Quero te mandar um diagnóstico rápido do seu marketing pra você entrar no 2º semestre com plano, não no improviso.

Te faz sentido? Responde aqui que eu te explico como funciona.','pronta','auto-IA·editado',NOW(),NOW());
COMMIT;
