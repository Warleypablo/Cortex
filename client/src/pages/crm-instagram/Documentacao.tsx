export default function Documentacao() {
  return (
    <div className="max-w-3xl space-y-6 text-sm text-gray-700 dark:text-zinc-300">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Como funciona o CRM Instagram</h2>
        <p>
          Esta aba transforma o engajamento do Instagram da Turbo em um pipeline de social selling:
          captura quem comenta, manda DM (e, em breve, quem curte), prioriza os mais quentes por um
          lead score e leva as boas oportunidades para o Bitrix.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Como operar no dia a dia</h3>
        <p className="mb-2">
          Rotina do SDR na aba <strong>Pipeline</strong> — a fila já chega ordenada pelo lead score
          (mais quente no topo).
        </p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            <strong>Pegar o card</strong> — clique em <strong>"Pegar"</strong>. Você vira o dono e o card
            trava por 15 min pra nenhum outro SDR abordar o mesmo perfil (seu balão aparece no card).
          </li>
          <li>
            <strong>Avaliar</strong> — confira o selo <strong>"Já é contato"</strong> (se já está na nossa
            base do GHL), o histórico de interações e a temperatura (🔥 quente · 🌡 morno · ❄️ frio).
          </li>
          <li>
            <strong>Abordar</strong> — lead de DM: botão <strong>"Responder no GHL"</strong>. Lead com
            @handle (comentário/curtida): nome vira link + botão <strong>"Instagram"</strong>.
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
            <strong>Avançar / Criar no Bitrix</strong> — Engajador → Oportunidade conforme trabalha o
            lead; ao virar comercial, <strong>"Criar no Bitrix"</strong> cria o deal já atribuído a você
            (Responsável + SDR), com origem/link do Instagram preenchidos.
          </li>
          <li>
            <strong>Soltar</strong> — se não vai trabalhar agora, devolve o card pra fila.
          </li>
        </ol>
        <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
          Abas: <strong>Pipeline</strong> (fila de trabalho) · <strong>Qualificação</strong> (base
          completa com tag editável e card de detalhe do lead) · <strong>Lead Scoring</strong> (pesos do
          score) · <strong>Documentação</strong>.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Estágios</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Engajador</strong> — alguém interagiu (comentário, DM ou curtida). Entrada do funil.</li>
          <li><strong>Oportunidade</strong> — o operador qualificou e vai abordar.</li>
          <li><strong>Negócio</strong> — virou lead comercial; criado no Bitrix.</li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Lead Scoring (como o score é calculado)</h3>
        <p className="mb-2">
          O score é a <strong>soma dos pontos de cada interação</strong> do lead — transparente e
          editável na aba <strong>Lead Scoring</strong> (só admins, Vinícius e Lucas salvam). Padrões:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>💌 DM espontânea: <strong>+5</strong> · 💬 Comentário: <strong>+3</strong> · ❤️ Curtida: <strong>+1</strong> · 👥 Seguiu: <strong>+1</strong></li>
          <li>🎯 Bônus por <strong>comentário com intenção</strong> de compra (preço, quero, contato…): <strong>+3</strong></li>
          <li>🔁 Bônus por <strong>recorrência</strong> (engajou em vários posts): <strong>+2</strong> por post extra</li>
        </ul>
        <p className="mt-2">
          A <strong>temperatura</strong> é separada do número (não pontua): mede há quanto tempo o lead
          não interage. Padrão 🔥 0–15 dias · 🌡 16–30 · ❄️ 30+ (também editável). Mudou os pesos? O efeito
          é imediato — o score é recalculado a cada carregamento.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Dedup / identidade</h3>
        <p>
          O selo <strong>"Já é contato"</strong> indica que o perfil já existe no GHL — evita abordar
          quem já está na base. A chave de deduplicação é o <strong>@handle</strong> (índice único): a
          mesma pessoa que curte e comenta cai num registro só. Leads de DM ainda não têm @handle (ver
          pendências) e por isso são a exceção do dedup por ora.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Trava (multi-operador)</h3>
        <p>
          Ao pegar um card, ele fica travado para você por 15 minutos, evitando que dois operadores
          abordem o mesmo perfil.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Limites de captura (importante)</h3>
        <p>
          A API oficial do Instagram só entrega nominalmente quem <strong>comenta</strong> e quem manda{" "}
          <strong>DM</strong>. Curtidas e seguidores não vêm pela API oficial — dependem de scraping (ver
          abaixo). Saves e compartilhamentos são <strong>anônimos</strong> (nem o IG mostra quem foi) e
          por isso ficam de fora.
        </p>
      </section>

      {/* ── Decisão pendente: scraping (curtidas + seguidores) ── */}
      <section className="rounded-lg border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Decisão pendente
          </span>
          <span className="text-xs text-gray-500 dark:text-zinc-400">capturar curtidas e seguidores</span>
        </div>
        <p className="mb-3">
          Curtidas e seguidores não vêm da API oficial. Pra trazer esses leads, usamos uma ferramenta
          externa que <strong>cobra por consulta</strong> — como um táxi: cada vez que a gente vai buscar
          os dados, paga a corrida. Por isso, <strong>quanto mais vezes consultamos, mais caro fica</strong>.
          A frequência que escolhermos define o custo do mês.
        </p>

        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">❤️ Curtidas</p>
        <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
          Buscamos quem curtiu os posts recentes. Buscar com mais frequência deixa a informação mais
          fresca, mas custa mais.
        </p>
        <div className="overflow-hidden rounded border border-amber-200 dark:border-amber-900 text-xs mb-4">
          <table className="w-full">
            <thead className="bg-amber-100/60 dark:bg-amber-950/40 text-gray-600 dark:text-zinc-400">
              <tr><th className="text-left p-2 font-medium">Frequência</th><th className="text-left p-2 font-medium">Você sabe das curtidas</th><th className="text-right p-2 font-medium">Custo/mês</th></tr>
            </thead>
            <tbody className="text-gray-700 dark:text-zinc-300">
              <tr className="border-t border-amber-200 dark:border-amber-900"><td className="p-2">1x por mês</td><td className="p-2">com até ~1 mês de atraso</td><td className="p-2 text-right">~$15</td></tr>
              <tr className="border-t border-amber-200 dark:border-amber-900"><td className="p-2">1x por semana</td><td className="p-2">com até ~1 semana</td><td className="p-2 text-right">~$20</td></tr>
              <tr className="border-t border-amber-200 dark:border-amber-900"><td className="p-2">Todo dia</td><td className="p-2">quase em tempo real</td><td className="p-2 text-right">~$100</td></tr>
            </tbody>
          </table>
        </div>

        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">👥 Seguidores</p>
        <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
          Cada busca lê a lista inteira (~50 mil) de uma vez — então cada busca custa ~$130, não importa
          quantos sejam novos. Aqui a frequência é o que pesa de verdade.
        </p>
        <div className="overflow-hidden rounded border border-amber-200 dark:border-amber-900 text-xs mb-4">
          <table className="w-full">
            <thead className="bg-amber-100/60 dark:bg-amber-950/40 text-gray-600 dark:text-zinc-400">
              <tr><th className="text-left p-2 font-medium">Frequência</th><th className="text-left p-2 font-medium">Você sabe de seguidor novo</th><th className="text-right p-2 font-medium">Custo/mês</th></tr>
            </thead>
            <tbody className="text-gray-700 dark:text-zinc-300">
              <tr className="border-t border-amber-200 dark:border-amber-900"><td className="p-2">1x por mês</td><td className="p-2">com até ~1 mês de atraso</td><td className="p-2 text-right">~$130</td></tr>
              <tr className="border-t border-amber-200 dark:border-amber-900"><td className="p-2">1x por semana</td><td className="p-2">com até ~1 semana</td><td className="p-2 text-right">~$520</td></tr>
              <tr className="border-t border-amber-200 dark:border-amber-900"><td className="p-2">Todo dia</td><td className="p-2">no mesmo dia</td><td className="p-2 text-right">~$3.900 (inviável)</td></tr>
            </tbody>
          </table>
        </div>

        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Total — onde queremos chegar</p>
        <p className="mb-3 text-xs text-gray-500 dark:text-zinc-400">
          Recomendação inicial: <strong className="text-gray-700 dark:text-zinc-300">curtidas 1x por semana + seguidores 1x por mês ≈ $150/mês</strong>.
          Começar só com curtidas custa ~$49/mês (o piso é o plano da ferramenta).
          <span className="block mt-1">(valores estimados, baseados em ~50 mil seguidores e ~14 posts/semana; confirmamos na 1ª busca real.)</span>
        </p>

        <p className="text-xs text-gray-500 dark:text-zinc-400">
          <strong className="text-gray-700 dark:text-zinc-300">O que precisa ser decidido com o Lucas:</strong>{" "}
          (1) de quanto em quanto tempo buscar as curtidas; (2) de quanto em quanto tempo buscar os
          seguidores; (3) se mostramos todos os 50 mil seguidores na ferramenta ou só os que começarem a
          seguir de agora em diante.
        </p>
      </section>

      {/* ── Status do projeto ── */}
      <section className="rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Status do projeto</h3>

        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Entregue</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Pipeline de DMs (via espelho do GHL) com lead score, temperatura, Pegar/Soltar e trava.</li>
          <li>Histórico de Interações por lead (com pontos por interação).</li>
          <li>Card de detalhe do lead na Qualificação (sempre visível) + busca compacta e filtros (estágio/tag).</li>
          <li>Tab Lead Scoring (modelo aditivo, sliders, decay, bônus de intenção e recorrência).</li>
          <li>Auto-criação no Bitrix (Responsável + SDR) e blocklist de tags.</li>
          <li>Ingestão de curtidas via Apify (likes scraper) — código pronto, aguardando token/config.</li>
        </ul>

        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">Em andamento</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li><strong>Deploy</strong> do módulo em produção.</li>
        </ul>

        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">Pendente</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Reconectar o Instagram</strong> em prod (após deploy) — liga a captura de <strong>comentários</strong> pela API oficial (o sinal público mais quente, sem scraping) + validar que vêm com @username.</li>
          <li><strong>Backfill do @handle dos leads de DM</strong> — via API de mensagens do IG; fecha o dedup. Pega carona na reconexão.</li>
          <li><strong>Confirmar acessos</strong> dos SDRs em prod e validar os pesos padrão do scoring.</li>
          <li>
            <strong>Captura de curtidas/seguidores (scraping):</strong>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li><strong>1º — Decisão (com o Lucas):</strong> frequência e custo (ver bloco "Decisão pendente" acima). <span className="text-amber-600 dark:text-amber-400">⏳ aguardando</span></li>
              <li><strong>2º — Criar e executar:</strong> ligar a captura, validar a 1ª busca e ativar o scraping recorrente.</li>
            </ul>
          </li>
        </ul>
      </section>
    </div>
  );
}
