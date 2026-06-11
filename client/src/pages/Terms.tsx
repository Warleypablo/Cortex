import { useEffect, useState } from "react";

const LAST_UPDATED = "11 de junho de 2026";

export default function Terms() {
  const [lang, setLang] = useState<"pt" | "en">("pt");

  useEffect(() => {
    document.title = "Termos de Serviço — Cortex | Turbo Partners";
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {lang === "pt" ? "Termos de Serviço" : "Terms of Service"}
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

        {lang === "pt" ? <TermsPT /> : <TermsEN />}

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

function TermsPT() {
  return (
    <>
      <p className="text-base md:text-lg leading-relaxed text-gray-700 dark:text-zinc-300">
        Estes Termos de Serviço ("Termos") regem o uso do <strong>Cortex</strong>, plataforma interna de
        analytics e gestão de campanhas operada pela <strong>Turbo Partners LTDA</strong> (CNPJ
        42.100.292/0001-84). Ao acessar o Cortex ou autorizar a integração de uma conta de plataforma
        terceira, você concorda com estes Termos. O tratamento de dados pessoais é regido pela nossa{" "}
        <a className="underline" href="/privacy">Política de Privacidade</a>.
      </p>

      <Section title="1. Objeto do serviço">
        <p>
          O Cortex é uma ferramenta de uso interno da Turbo Partners e de seus clientes contratantes, que
          agrega e exibe métricas de marketing e vendas de múltiplas plataformas (Meta, Google, TikTok,
          YouTube, LinkedIn, Bitrix24, HighLevel) em painéis unificados. O acesso às plataformas terceiras é
          <strong> somente leitura</strong>: o Cortex não cria, edita nem publica conteúdo em nome do usuário.
        </p>
      </Section>

      <Section title="2. Elegibilidade e contas">
        <p>
          O uso do Cortex é restrito a profissionais maiores de 18 anos, colaboradores autorizados da Turbo
          Partners e clientes contratantes. Você é responsável por manter a confidencialidade das suas
          credenciais de acesso e por toda atividade realizada na sua conta.
        </p>
      </Section>

      <Section title="3. Autorização de integrações">
        <p>
          Ao conectar uma conta de plataforma terceira via OAuth, você declara ter autoridade para conceder
          esse acesso e autoriza o Cortex a ler os dados dentro do escopo aprovado. Especificamente para o
          <strong> TikTok</strong>, o Cortex solicita acesso de leitura a informações de perfil e métricas de
          vídeo (visualizações, curtidas, comentários, compartilhamentos) das contas autorizadas, usadas
          exclusivamente para relatórios internos.
        </p>
      </Section>

      <Section title="4. Uso aceitável">
        <p>Ao usar o Cortex, você concorda em não:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Acessar contas ou dados para os quais não tenha autorização;</li>
          <li>Tentar burlar mecanismos de segurança, autenticação ou limites de uso;</li>
          <li>Revender, redistribuir ou expor publicamente dados obtidos das plataformas integradas;</li>
          <li>Usar a plataforma para qualquer finalidade ilícita ou que viole os termos das plataformas terceiras.</li>
        </ul>
      </Section>

      <Section title="5. Dados das plataformas terceiras">
        <p>
          Os dados obtidos via APIs (incluindo TikTok, Meta, Google, YouTube e LinkedIn) permanecem sujeitos
          aos termos e políticas das respectivas plataformas. O Cortex utiliza esses dados apenas para as
          finalidades descritas na <a className="underline" href="/privacy">Política de Privacidade</a> e não
          os vende nem os compartilha com anunciantes ou parceiros comerciais externos.
        </p>
      </Section>

      <Section title="6. Revogação e encerramento">
        <p>
          Você pode revogar a qualquer momento o acesso do Cortex às suas contas de plataformas terceiras,
          diretamente na plataforma de origem (ex.: TikTok for Business → Settings → Connected Apps). Após a
          revogação, os tokens são invalidados e novas sincronizações deixam de ocorrer. A Turbo pode
          suspender ou encerrar o acesso de usuários que violem estes Termos.
        </p>
      </Section>

      <Section title="7. Propriedade intelectual">
        <p>
          O software, a marca e os layouts do Cortex são de propriedade da Turbo Partners LTDA. Estes Termos
          não concedem qualquer licença sobre a propriedade intelectual da Turbo além do uso da plataforma
          conforme aqui descrito.
        </p>
      </Section>

      <Section title="8. Isenção de garantias">
        <p>
          O Cortex é fornecido "no estado em que se encontra". Embora nos esforcemos pela disponibilidade e
          precisão, não garantimos que o serviço será ininterrupto ou livre de erros, nem nos
          responsabilizamos por decisões tomadas com base nos dados exibidos.
        </p>
      </Section>

      <Section title="9. Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, a Turbo Partners não se responsabiliza por danos indiretos,
          incidentais ou lucros cessantes decorrentes do uso ou da impossibilidade de uso do Cortex.
        </p>
      </Section>

      <Section title="10. Alterações nos Termos">
        <p>
          Podemos atualizar estes Termos periodicamente. A data da última atualização aparece no topo.
          Mudanças significativas serão comunicadas aos usuários ativos. O uso continuado após a alteração
          implica concordância com os novos Termos.
        </p>
      </Section>

      <Section title="11. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da Comarca de Vitória/ES
          para dirimir quaisquer questões deles decorrentes.
        </p>
      </Section>

      <Section title="12. Contato">
        <p>
          Dúvidas sobre estes Termos: <strong>privacidade@turbopartners.com.br</strong>
        </p>
      </Section>
    </>
  );
}

function TermsEN() {
  return (
    <>
      <p className="text-base md:text-lg leading-relaxed text-gray-700 dark:text-zinc-300">
        These Terms of Service ("Terms") govern the use of <strong>Cortex</strong>, an internal analytics and
        campaign management platform operated by <strong>Turbo Partners LTDA</strong> (Brazilian tax ID
        42.100.292/0001-84). By accessing Cortex or authorizing the integration of a third-party platform
        account, you agree to these Terms. Processing of personal data is governed by our{" "}
        <a className="underline" href="/privacy">Privacy Policy</a>.
      </p>

      <Section title="1. Service description">
        <p>
          Cortex is an internal tool for Turbo Partners and its contracting clients that aggregates and
          displays marketing and sales metrics from multiple platforms (Meta, Google, TikTok, YouTube,
          LinkedIn, Bitrix24, HighLevel) in unified dashboards. Access to third-party platforms is
          <strong> read-only</strong>: Cortex does not create, edit, or publish content on the user's behalf.
        </p>
      </Section>

      <Section title="2. Eligibility and accounts">
        <p>
          Use of Cortex is restricted to professionals over 18 years old, authorized Turbo Partners employees,
          and contracting clients. You are responsible for keeping your access credentials confidential and
          for all activity performed under your account.
        </p>
      </Section>

      <Section title="3. Integration authorization">
        <p>
          By connecting a third-party platform account via OAuth, you represent that you have authority to
          grant such access and authorize Cortex to read data within the approved scope. Specifically for
          <strong> TikTok</strong>, Cortex requests read access to profile information and video metrics
          (views, likes, comments, shares) of authorized accounts, used solely for internal reporting.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>When using Cortex, you agree not to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Access accounts or data you are not authorized to access;</li>
          <li>Attempt to bypass security, authentication, or usage-limit mechanisms;</li>
          <li>Resell, redistribute, or publicly expose data obtained from integrated platforms;</li>
          <li>Use the platform for any unlawful purpose or in violation of third-party platform terms.</li>
        </ul>
      </Section>

      <Section title="5. Third-party platform data">
        <p>
          Data obtained via APIs (including TikTok, Meta, Google, YouTube, and LinkedIn) remains subject to
          the terms and policies of the respective platforms. Cortex uses such data only for the purposes
          described in the <a className="underline" href="/privacy">Privacy Policy</a> and does not sell or
          share it with external advertisers or commercial partners.
        </p>
      </Section>

      <Section title="6. Revocation and termination">
        <p>
          You may revoke Cortex's access to your third-party platform accounts at any time, directly on the
          source platform (e.g., TikTok for Business → Settings → Connected Apps). Upon revocation, tokens are
          invalidated and new syncs stop occurring. Turbo may suspend or terminate access for users who
          violate these Terms.
        </p>
      </Section>

      <Section title="7. Intellectual property">
        <p>
          The Cortex software, brand, and layouts are owned by Turbo Partners LTDA. These Terms grant no
          license over Turbo's intellectual property beyond using the platform as described herein.
        </p>
      </Section>

      <Section title="8. Disclaimer of warranties">
        <p>
          Cortex is provided "as is". While we strive for availability and accuracy, we do not warrant that
          the service will be uninterrupted or error-free, nor are we liable for decisions made based on the
          displayed data.
        </p>
      </Section>

      <Section title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, Turbo Partners is not liable for indirect, incidental, or
          consequential damages arising from the use of or inability to use Cortex.
        </p>
      </Section>

      <Section title="10. Changes to the Terms">
        <p>
          We may update these Terms periodically. The date of the last update appears at the top. Significant
          changes will be communicated to active users. Continued use after a change implies agreement with
          the new Terms.
        </p>
      </Section>

      <Section title="11. Applicable law and jurisdiction">
        <p>
          These Terms are governed by Brazilian law. The court of the District of Vitória/ES, Brazil, is
          elected to resolve any disputes arising from them.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions about these Terms: <strong>privacidade@turbopartners.com.br</strong>
        </p>
      </Section>
    </>
  );
}
