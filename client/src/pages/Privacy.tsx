import { useEffect, useState } from "react";

const LAST_UPDATED = "22 de maio de 2026";

export default function Privacy() {
  const [lang, setLang] = useState<"pt" | "en">("pt");

  useEffect(() => {
    document.title = "Política de Privacidade — Cortex | Turbo Partners";
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {lang === "pt" ? "Política de Privacidade" : "Privacy Policy"}
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
              Cortex · Turbo Partners LTDA · {lang === "pt" ? "Última atualização" : "Last updated"}: {LAST_UPDATED}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-900 rounded-lg p-1">
            <button
              onClick={() => setLang("pt")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                lang === "pt"
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-zinc-400"
              }`}
            >
              PT-BR
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                lang === "en"
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-zinc-400"
              }`}
            >
              EN
            </button>
          </div>
        </header>

        {lang === "pt" ? <PrivacyPT /> : <PrivacyEN />}

        <footer className="mt-12 pt-6 border-t border-gray-200 dark:border-zinc-800 text-xs text-gray-500 dark:text-zinc-400">
          Turbo Partners LTDA · CNPJ 42.100.292/0001-84 · Rua Carlos Fernando Lindenberg Filho, 90, Monte Belo, Vitória/ES, CEP 29053-315
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl md:text-2xl font-semibold mb-3 text-gray-900 dark:text-white">{title}</h2>
      <div className="space-y-3 text-sm md:text-base leading-relaxed text-gray-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function PrivacyPT() {
  return (
    <>
      <p className="text-base md:text-lg leading-relaxed text-gray-700 dark:text-zinc-300">
        Esta Política de Privacidade descreve como a <strong>Turbo Partners LTDA</strong> (CNPJ 42.100.292/0001-84)
        coleta, utiliza, armazena e compartilha dados pessoais e de marketing por meio do{" "}
        <strong>Cortex</strong>, nossa plataforma interna de analytics e gestão de campanhas. Ao utilizar o Cortex
        ou autorizar a integração de uma conta de mídia paga, o titular dos dados concorda com os termos abaixo.
        Esta política está em conformidade com a LGPD (Lei nº 13.709/2018) e com os termos das plataformas
        terceiras integradas.
      </p>

      <Section title="1. Quem somos">
        <p>
          O Cortex é operado pela <strong>Turbo Partners LTDA</strong>, agência de marketing digital com sede na
          Rua Carlos Fernando Lindenberg Filho, 90, Monte Belo, Vitória/ES, CEP 29053-315. A Turbo é
          enquadrada como agente de tratamento de pequeno porte conforme Resolução CD/ANPD nº 2/2022 e mantém
          canal direto de atendimento ao titular pelo e-mail <strong>contato@turbopartners.com.br</strong>.
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <p>O Cortex coleta e processa as seguintes categorias de dados:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Dados de plataformas de mídia paga e analytics</strong> (Meta Ads, Google Ads, TikTok Ads,
            YouTube, LinkedIn Ads, Google Analytics 4): métricas agregadas de campanhas — impressões, cliques,
            investimento, conversões, ROAS, sessões, dados de criativos — obtidas via APIs oficiais mediante
            autorização explícita do dono da conta.
          </li>
          <li>
            <strong>Dados de CRM</strong> (Bitrix24, HighLevel): leads, oportunidades, etapas de funil, valores
            de contrato, motivos de descarte. Não armazenamos dados sensíveis de cartão de crédito ou
            credenciais bancárias.
          </li>
          <li>
            <strong>Dados de uso da plataforma</strong>: nome, e-mail, função, identificador da empresa, IP,
            navegador, sistema operacional e páginas acessadas dentro do Cortex.
          </li>
          <li>
            <strong>Identificadores técnicos</strong>: tokens OAuth criptografados (AES-256-GCM), IDs de contas
            de Ads e Business Centers, IDs de canais YouTube e Company Pages LinkedIn.
          </li>
        </ul>
      </Section>

      <Section title="3. Plataformas integradas e finalidade">
        <p>
          O Cortex integra-se via API com as plataformas abaixo, sempre mediante autorização OAuth do titular
          ou administrador da conta. Em todos os casos o acesso é <strong>somente leitura</strong> — não
          criamos, modificamos nem publicamos conteúdo em nome do titular.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Meta (Facebook e Instagram Ads)</strong>: leitura de métricas de campanhas, criativos,
            públicos e desempenho orgânico de páginas e perfis de propriedade da Turbo ou de seus clientes.
          </li>
          <li>
            <strong>Google Ads</strong>: leitura de métricas de campanhas, ad groups, ads e conversões da
            conta MCC da Turbo e contas-cliente associadas.
          </li>
          <li>
            <strong>Google Analytics 4</strong>: leitura de métricas de sessão, usuários e eventos de
            propriedades autorizadas, usada para enriquecer dashboards multi-plataforma.
          </li>
          <li>
            <strong>YouTube (Data API v3 e Analytics API)</strong>: leitura de métricas públicas e privadas
            de canais autorizados (inscritos, visualizações, retenção, demografia).
          </li>
          <li>
            <strong>TikTok for Business (Marketing API)</strong>: leitura de métricas de Advertisers e
            Business Centers autorizados, para painéis de orçado vs realizado e cross-channel ROAS.
          </li>
          <li>
            <strong>LinkedIn (Marketing Developer Platform)</strong>: leitura de métricas de Ads e Company
            Pages autorizadas pela Turbo e seus clientes.
          </li>
          <li>
            <strong>Bitrix24 e HighLevel</strong>: sincronização de leads e oportunidades para análise de
            funil end-to-end.
          </li>
        </ul>
        <p className="mt-3">
          Cada plataforma exige aceite específico de seus próprios Termos e Política de Privacidade. O uso do
          Cortex não substitui esses aceites — eles são feitos no momento do OAuth de cada plataforma.
        </p>
      </Section>

      <Section title="4. Como usamos os dados">
        <ul className="list-disc pl-6 space-y-2">
          <li>Construir dashboards de orçado vs realizado, performance por funil/produto e ROI cross-channel.</li>
          <li>Identificar criativos vencedores e otimizar alocação de orçamento entre plataformas.</li>
          <li>
            Apoiar clientes de e-commerce da Turbo na tomada de decisão baseada em dados, com visibilidade
            unificada de todos os canais que rodam conosco.
          </li>
          <li>Autenticação e auditoria de acesso à plataforma.</li>
          <li>Cumprimento de obrigações legais e contratuais.</li>
        </ul>
      </Section>

      <Section title="5. Compartilhamento de dados">
        <p>Compartilhamos dados apenas nas seguintes hipóteses:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Com o próprio cliente da Turbo</strong>: cada cliente vê exclusivamente os dados das
            contas que ele autorizou. Não cruzamos dados entre clientes.
          </li>
          <li>
            <strong>Com provedores de infraestrutura</strong>: Google Cloud (banco PostgreSQL, hospedagem),
            sob acordo de proteção de dados.
          </li>
          <li>
            <strong>Com autoridades públicas</strong>: mediante ordem judicial ou requisição legal válida.
          </li>
        </ul>
        <p>
          Nós <strong>não vendemos, alugamos ou redistribuímos</strong> dados de plataformas terceiras
          (Meta, Google, TikTok, YouTube, LinkedIn) a parceiros comerciais ou anunciantes externos.
        </p>
      </Section>

      <Section title="6. Armazenamento e segurança">
        <p>
          Os dados ficam armazenados em PostgreSQL hospedado no Google Cloud (região São Paulo) com criptografia
          em trânsito (TLS 1.2+) e em repouso. Tokens OAuth são criptografados com AES-256-GCM antes de serem
          persistidos. O acesso ao Cortex requer autenticação e é restrito a colaboradores autorizados da Turbo
          Partners e aos clientes contratantes, com escopo limitado por permissão.
        </p>
      </Section>

      <Section title="7. Retenção de dados">
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Métricas de Ads e analytics</strong>: até 5 anos após o encerramento do contrato com o cliente.</li>
          <li><strong>Tokens OAuth</strong>: enquanto a autorização estiver ativa; revogados imediatamente após desconexão.</li>
          <li><strong>Logs de acesso</strong>: 6 meses.</li>
          <li><strong>Dados de leads (CRM)</strong>: até 5 anos após o último contato.</li>
        </ul>
      </Section>

      <Section title="8. Direitos do titular (LGPD Art. 18)">
        <p>O titular dos dados tem direito a:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Confirmação da existência de tratamento</li>
          <li>Acesso aos dados</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade</li>
          <li>Portabilidade</li>
          <li>Eliminação dos dados tratados com consentimento</li>
          <li>Informação sobre entidades com as quais compartilhamos dados</li>
          <li>Revogação do consentimento a qualquer momento</li>
          <li>Oposição a tratamento realizado com base em uma das hipóteses de dispensa de consentimento</li>
          <li>Revisão de decisões automatizadas</li>
        </ul>
        <p>
          Para exercer qualquer um desses direitos, envie e-mail para{" "}
          <strong>contato@turbopartners.com.br</strong> identificando-se. Responderemos em até 15 dias úteis.
        </p>
      </Section>

      <Section title="9. Revogação de acesso de plataformas terceiras">
        <p>
          Você pode revogar a qualquer momento o acesso do Cortex às suas contas de plataformas terceiras
          diretamente na própria plataforma:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Meta: <a className="underline" href="https://accountscenter.facebook.com/business_apps">Account Center → Business Integrations</a></li>
          <li>Google / YouTube / GA4: <a className="underline" href="https://myaccount.google.com/permissions">Permissões da conta Google</a></li>
          <li>TikTok: TikTok for Business → Settings → Connected Apps</li>
          <li>LinkedIn: <a className="underline" href="https://www.linkedin.com/psettings/permitted-services">Permitted Services</a></li>
        </ul>
        <p>Ao revogar, os tokens são invalidados e novos sincs deixam de ocorrer.</p>
      </Section>

      <Section title="10. Cookies">
        <p>
          O Cortex utiliza cookies estritamente necessários para autenticação e funcionamento. Não utilizamos
          cookies de publicidade comportamental dentro da plataforma.
        </p>
      </Section>

      <Section title="11. Crianças e adolescentes">
        <p>O Cortex destina-se a profissionais maiores de 18 anos. Não coletamos dados de menores intencionalmente.</p>
      </Section>

      <Section title="12. Alterações nesta política">
        <p>
          Esta política pode ser atualizada. A data da última atualização aparece no topo. Mudanças
          significativas serão comunicadas por e-mail aos usuários ativos.
        </p>
      </Section>

      <Section title="13. Lei aplicável e foro">
        <p>
          Esta política é regida pela legislação brasileira (LGPD, Marco Civil da Internet). Fica eleito o
          foro da Comarca de Vitória/ES para dirimir quaisquer questões.
        </p>
      </Section>

      <Section title="14. Contato">
        <p>
          Para qualquer dúvida sobre privacidade ou exercício de direitos:{" "}
          <strong>contato@turbopartners.com.br</strong>
        </p>
      </Section>
    </>
  );
}

function PrivacyEN() {
  return (
    <>
      <p className="text-base md:text-lg leading-relaxed text-gray-700 dark:text-zinc-300">
        This Privacy Policy describes how <strong>Turbo Partners LTDA</strong> (Brazilian tax ID
        42.100.292/0001-84) collects, uses, stores, and shares personal and marketing data through{" "}
        <strong>Cortex</strong>, our internal analytics and campaign management platform. By using Cortex or
        authorizing the integration of a paid media account, the data subject agrees to the terms below.
        This policy complies with the Brazilian General Data Protection Law (LGPD) and with the terms of the
        integrated third-party platforms.
      </p>

      <Section title="1. Who we are">
        <p>
          Cortex is operated by <strong>Turbo Partners LTDA</strong>, a digital marketing agency
          headquartered at Rua Carlos Fernando Lindenberg Filho, 90, Monte Belo, Vitória/ES, ZIP 29053-315,
          Brazil. Turbo Partners is classified as a small-size data processing agent under Brazilian ANPD
          Resolution 2/2022 and maintains a direct support channel for data subjects at{" "}
          <strong>contato@turbopartners.com.br</strong>.
        </p>
      </Section>

      <Section title="2. Data we collect">
        <p>Cortex collects and processes the following categories of data:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Paid media and analytics platform data</strong> (Meta Ads, Google Ads, TikTok Ads,
            YouTube, LinkedIn Ads, Google Analytics 4): aggregated campaign metrics — impressions, clicks,
            spend, conversions, ROAS, sessions, creative data — obtained via official APIs upon explicit
            authorization by the account owner.
          </li>
          <li>
            <strong>CRM data</strong> (Bitrix24, HighLevel): leads, opportunities, funnel stages, contract
            values, loss reasons. We do not store sensitive payment card or banking credentials.
          </li>
          <li>
            <strong>Platform usage data</strong>: name, e-mail, role, company identifier, IP, browser,
            operating system, and pages accessed within Cortex.
          </li>
          <li>
            <strong>Technical identifiers</strong>: encrypted OAuth tokens (AES-256-GCM), Ads account and
            Business Center IDs, YouTube channel IDs, and LinkedIn Company Page IDs.
          </li>
        </ul>
      </Section>

      <Section title="3. Integrated platforms and purpose">
        <p>
          Cortex integrates via API with the platforms below, always upon OAuth authorization by the account
          owner or administrator. In all cases access is <strong>read-only</strong> — we do not create,
          modify, or publish content on behalf of the data subject.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Meta (Facebook and Instagram Ads)</strong>: read campaign metrics, creatives, audiences,
            and organic page/profile performance for assets owned by Turbo or its clients.
          </li>
          <li>
            <strong>Google Ads</strong>: read metrics for campaigns, ad groups, ads, and conversions from
            Turbo's MCC account and associated client accounts.
          </li>
          <li>
            <strong>Google Analytics 4</strong>: read session, user, and event metrics from authorized
            properties, used to enrich multi-platform dashboards.
          </li>
          <li>
            <strong>YouTube (Data API v3 and Analytics API)</strong>: read public and private metrics for
            authorized channels (subscribers, views, retention, demographics).
          </li>
          <li>
            <strong>TikTok for Business (Marketing API)</strong>: read metrics from authorized Advertisers
            and Business Centers, for budget vs. actual dashboards and cross-channel ROAS analysis.
          </li>
          <li>
            <strong>LinkedIn (Marketing Developer Platform)</strong>: read metrics from Ads and Company
            Pages authorized by Turbo and its clients.
          </li>
          <li>
            <strong>Bitrix24 and HighLevel</strong>: lead and opportunity sync for end-to-end funnel analysis.
          </li>
        </ul>
        <p className="mt-3">
          Each platform requires acceptance of its own Terms and Privacy Policy. Using Cortex does not
          replace those acceptances — they are performed at the time of each platform's OAuth flow.
        </p>
      </Section>

      <Section title="4. How we use the data">
        <ul className="list-disc pl-6 space-y-2">
          <li>Build budget-vs-actual dashboards, funnel/product performance, and cross-channel ROI.</li>
          <li>Identify winning creatives and optimize budget allocation across platforms.</li>
          <li>
            Support Turbo's e-commerce clients in data-driven decision-making with unified visibility into
            all channels run with us.
          </li>
          <li>Authenticate and audit access to the platform.</li>
          <li>Comply with legal and contractual obligations.</li>
        </ul>
      </Section>

      <Section title="5. Data sharing">
        <p>We share data only in the following scenarios:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>With the Turbo client</strong>: each client sees only the data from the accounts they
            authorized. We do not cross-reference data between clients.
          </li>
          <li>
            <strong>With infrastructure providers</strong>: Google Cloud (PostgreSQL, hosting), under data
            protection agreement.
          </li>
          <li>
            <strong>With public authorities</strong>: upon valid court order or legal request.
          </li>
        </ul>
        <p>
          We <strong>do not sell, lease, or redistribute</strong> third-party platform data (Meta, Google,
          TikTok, YouTube, LinkedIn) to commercial partners or external advertisers.
        </p>
      </Section>

      <Section title="6. Storage and security">
        <p>
          Data is stored in PostgreSQL hosted on Google Cloud (São Paulo region) with encryption in transit
          (TLS 1.2+) and at rest. OAuth tokens are encrypted with AES-256-GCM before being persisted. Access
          to Cortex requires authentication and is restricted to authorized Turbo Partners employees and
          contracted clients, with scope limited by permission.
        </p>
      </Section>

      <Section title="7. Data retention">
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Ads and analytics metrics</strong>: up to 5 years after contract termination with the client.</li>
          <li><strong>OAuth tokens</strong>: while the authorization is active; revoked immediately upon disconnection.</li>
          <li><strong>Access logs</strong>: 6 months.</li>
          <li><strong>CRM lead data</strong>: up to 5 years after last contact.</li>
        </ul>
      </Section>

      <Section title="8. Data subject rights (LGPD Art. 18)">
        <p>The data subject has the right to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Confirmation of processing</li>
          <li>Access to data</li>
          <li>Correction of incomplete, inaccurate, or outdated data</li>
          <li>Anonymization, blocking, or deletion of unnecessary, excessive, or unlawfully processed data</li>
          <li>Portability</li>
          <li>Deletion of data processed under consent</li>
          <li>Information about entities with which we share data</li>
          <li>Revocation of consent at any time</li>
          <li>Objection to processing under exceptions to consent</li>
          <li>Review of automated decisions</li>
        </ul>
        <p>
          To exercise any of these rights, send an e-mail to{" "}
          <strong>contato@turbopartners.com.br</strong> identifying yourself. We will respond within 15
          business days.
        </p>
      </Section>

      <Section title="9. Revoking third-party platform access">
        <p>
          You can revoke Cortex's access to your third-party platform accounts at any time directly on the
          platform:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Meta: <a className="underline" href="https://accountscenter.facebook.com/business_apps">Account Center → Business Integrations</a></li>
          <li>Google / YouTube / GA4: <a className="underline" href="https://myaccount.google.com/permissions">Google Account Permissions</a></li>
          <li>TikTok: TikTok for Business → Settings → Connected Apps</li>
          <li>LinkedIn: <a className="underline" href="https://www.linkedin.com/psettings/permitted-services">Permitted Services</a></li>
        </ul>
        <p>Upon revocation, tokens are invalidated and new syncs stop occurring.</p>
      </Section>

      <Section title="10. Cookies">
        <p>
          Cortex uses cookies strictly necessary for authentication and operation. We do not use behavioral
          advertising cookies within the platform.
        </p>
      </Section>

      <Section title="11. Children and minors">
        <p>Cortex is intended for professionals over 18 years old. We do not knowingly collect data from minors.</p>
      </Section>

      <Section title="12. Changes to this policy">
        <p>
          This policy may be updated. The date of the last update appears at the top. Significant changes
          will be communicated by e-mail to active users.
        </p>
      </Section>

      <Section title="13. Applicable law and jurisdiction">
        <p>
          This policy is governed by Brazilian law (LGPD, Marco Civil da Internet). The court of the
          District of Vitória/ES, Brazil, is elected to resolve any disputes.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          For any privacy-related questions or to exercise rights:{" "}
          <strong>contato@turbopartners.com.br</strong>
        </p>
      </Section>
    </>
  );
}
