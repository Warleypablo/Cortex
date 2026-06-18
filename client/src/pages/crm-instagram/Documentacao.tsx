export default function Documentacao() {
  return (
    <div className="max-w-3xl space-y-6 text-sm text-gray-700 dark:text-zinc-300">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Como funciona o CRM Instagram</h2>
        <p>
          Esta aba transforma o engajamento do Instagram da Turbo em um pipeline de social selling:
          captura quem comenta e quem manda DM, prioriza os mais quentes e leva as boas oportunidades
          para o Bitrix.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Como operar no dia a dia</h3>
        <p className="mb-2">
          Rotina do SDR na aba <strong>Pipeline</strong> — a fila já chega priorizada (quem mandou DM
          primeiro, depois quem comentou mais vezes; o mais recente no topo) com a temperatura do lead.
        </p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            <strong>Pegar o card</strong> — clique em <strong>"Pegar"</strong>. Você vira o dono e o card
            trava por 15 min pra nenhum outro SDR abordar o mesmo perfil (seu balão aparece no card).
          </li>
          <li>
            <strong>Avaliar</strong> — confira o selo <strong>"Já é contato"</strong> (se já está na nossa
            base do GHL), o nº de interações e a temperatura (🔥 ≤15d · 🌡 16–30d · ❄️ &gt;30d).
          </li>
          <li>
            <strong>Abordar</strong> — lead de DM: botão <strong>"Responder no GHL"</strong> (abre a
            conversa no GHL). Lead só de comentário: <strong>"Abrir no Instagram"</strong> (responde/DM
            por lá).
          </li>
          <li>
            <strong>Qualificar</strong> — aplique uma <strong>tag</strong>. As tags{" "}
            <strong>colaborador, creator, influenciadora, talento</strong> e <strong>desqualificado</strong>{" "}
            tiram o card do Pipeline (somem da fila, mas continuam na aba Qualificação). Só{" "}
            <strong>empresário</strong> permanece no funil.
          </li>
          <li>
            <strong>Anotar</strong> — use <strong>"Adicionar observação"</strong> para contexto; se virar
            deal, isso vai pros comentários do Bitrix.
          </li>
          <li>
            <strong>Avançar o estágio</strong> — Engajador → Oportunidade conforme você trabalha o lead.
          </li>
          <li>
            <strong>Criar no Bitrix</strong> — quando vira lead comercial, clique em{" "}
            <strong>"Criar no Bitrix"</strong>. O deal nasce com origem/link do Instagram preenchidos e
            atribuído a você (Responsável + campo SDR). Telefone e e-mail são opcionais.
          </li>
          <li>
            <strong>Soltar</strong> — se não vai trabalhar o card agora, <strong>"Soltar"</strong> devolve
            ele pra fila para outro SDR pegar.
          </li>
        </ol>
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
          Outras abas: <strong>Qualificação</strong> lista todos os perfis com a tag editável (base
          completa); <strong>Social Media</strong> mostra o desempenho dos posts e quantos engajadores
          de cada post entraram no funil (depende da reconexão do Instagram — ver pendências com o time).
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Estágios</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Engajador</strong> — alguém interagiu (comentário ou DM). Entrada do funil.</li>
          <li><strong>Oportunidade</strong> — o operador qualificou e vai abordar.</li>
          <li><strong>Negócio</strong> — virou lead comercial; criado no Bitrix pelo botão "Criar no Bitrix".</li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Priorização</h3>
        <p>
          A fila ordena por intenção real: quem mandou <strong>DM</strong> primeiro, depois quem
          <strong> comentou várias vezes</strong>, depois 1 comentário — e o mais recente no topo.
          A temperatura (🔥 ≤15d · 🌡 16–30d · ❄️ &gt;30d) é calculada pela data da última interação.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Dedup</h3>
        <p>
          O selo <strong>"Já é contato"</strong> indica que o perfil já existe no nosso CRM de
          marketing (GHL) — evita abordar quem já está na base.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Trava (multi-operador)</h3>
        <p>
          Ao abrir um card para trabalhar, ele fica travado para você por 15 minutos, evitando que
          dois operadores abordem o mesmo perfil. Reivindique como dono para manter a responsabilidade.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Limites de captura (importante)</h3>
        <p>
          A API oficial do Instagram só entrega <strong>nome</strong> de quem <strong>comenta</strong> e
          de quem manda <strong>DM</strong>. Curtidas, saves, shares e seguidores não vêm nominalmente —
          então o garimpo trabalha o sinal quente (comentário + DM), que também é o mais qualificado.
        </p>
      </section>

      <section className="rounded-lg border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Roadmap
          </span>
          <span className="text-xs text-gray-500 dark:text-zinc-400">próximas implementações</span>
        </div>
        <p className="mb-3">
          A meta é ampliar o garimpo para além de comentário/DM, capturando todos os sinais de
          engajamento.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Capturar curtidas (quem curtiu)</strong> — identificar nominalmente quem curtiu cada
            post e trazer esses perfis para o funil, não só quem comentou/mandou DM.
          </li>
          <li>
            <strong>Capturar novos seguidores (quem seguiu)</strong> — usar o "passou a seguir" como sinal
            de interesse para alimentar a fila de prospecção.
          </li>
          <li>
            <strong>Lead scoring enriquecido</strong> — incorporar esses novos sinais (curtida, seguir,
            salvar, compartilhar) ao score 0–100, refinando a priorização da fila e a temperatura do lead.
          </li>
        </ul>
        <div className="mt-3 text-xs text-gray-500 dark:text-zinc-400">
          <p className="mb-1">
            A API oficial não entrega curtidas/seguidores nominalmente, então a captura depende de um
            serviço externo de scraping/automação. Opções a avaliar:
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li><strong>Apify</strong> — actors prontos de Instagram (likers, followers, comentários).</li>
            <li><strong>Scrapfly / ScraperAPI</strong> — APIs de scraping com proxy e anti-bot.</li>
            <li><strong>Bright Data</strong> — coleta em escala via rede de proxies.</li>
            <li><strong>Phantombuster</strong> — automação no IG para extrair likers/seguidores.</li>
          </ul>
          <p className="mt-1">
            Trade-off: scraping viola os termos do Instagram e tem risco de bloqueio da conta — é uma
            decisão de produto antes de implementar.
          </p>
        </div>
      </section>
    </div>
  );
}
