export default function Documentacao() {
  return (
    <div className="max-w-3xl space-y-6 text-sm text-gray-700 dark:text-zinc-300">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Como funciona o CRM Instagram</h2>
        <p>
          Esta aba transforma o engajamento do Instagram da Turbo em um pipeline de social selling:
          captura quem comenta, manda DM, curte e segue (curtidas/seguidores via HikerAPI), prioriza
          os mais quentes por um lead score e leva as boas oportunidades para o Bitrix.
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

      {/* ── Curtidas & Seguidores via HikerAPI (custo + descobertas) ── */}
      <section className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Curtidas &amp; Seguidores — via HikerAPI
          </span>
          <span className="text-xs text-gray-500 dark:text-zinc-400">atualizado jul/2026</span>
        </div>
        <p className="mb-3">
          Curtidas e seguidores não vêm da API oficial — dependem de uma ferramenta externa que{" "}
          <strong>cobra por consulta</strong> (como um táxi: paga a corrida a cada busca). Trocamos o
          fornecedor: em vez do Apify, passamos a usar a <strong>HikerAPI</strong>, que faz{" "}
          <strong>o mesmo trabalho por ~1/280 do preço</strong> e <strong>sem mensalidade</strong> (é
          pré-pago; só paga o que usar). Com isso, o custo dos dois sinais juntos cabe em{" "}
          <strong className="text-emerald-700 dark:text-emerald-300">menos de US$1 por mês</strong>.
        </p>

        {/* Descobertas */}
        <div className="rounded border border-emerald-200 dark:border-emerald-900 bg-white/60 dark:bg-zinc-900/40 p-3 mb-4 text-xs">
          <p className="font-semibold text-gray-900 dark:text-white mb-1">O que descobrimos (olhando o banco)</p>
          <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-zinc-400">
            <li>O garimpo hoje é <strong>100% DM</strong> (~534 pessoas). Curtida/comentário estão zerados: o robô antigo (Apify) <strong>nunca chegou a rodar</strong> em produção.</li>
            <li>Dessas ~534, <strong>só 1 avançou</strong> de estágio e <strong>nenhuma virou negócio</strong>. Ou seja: o gargalo é <strong>trabalhar a fila</strong>, não falta de gente entrando.</li>
            <li>Por isso o plano é <strong>ligar curtidas primeiro</strong> (custa centavos) e medir se convertem, <strong>antes</strong> de investir em seguidores.</li>
            <li>A conta já está criada e o token validado — falta só <strong>colocar saldo</strong> (~US$10 cobrem mais de um ano).</li>
          </ul>
        </div>

        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">❤️ Curtidas — quanto custa buscar</p>
        <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
          Cada busca lê quem curtiu os ~12 posts recentes. Dá pra buscar <strong>todo dia</strong> sem
          pesar no bolso.
        </p>
        <div className="overflow-hidden rounded border border-emerald-200 dark:border-emerald-900 text-xs mb-4">
          <table className="w-full">
            <thead className="bg-emerald-100/60 dark:bg-emerald-950/40 text-gray-600 dark:text-zinc-400">
              <tr><th className="text-left p-2 font-medium">Período (buscando todo dia)</th><th className="text-left p-2 font-medium">Buscas</th><th className="text-right p-2 font-medium">Custo</th></tr>
            </thead>
            <tbody className="text-gray-700 dark:text-zinc-300">
              <tr className="border-t border-emerald-200 dark:border-emerald-900"><td className="p-2">Por dia</td><td className="p-2">1</td><td className="p-2 text-right">~US$ 0,01</td></tr>
              <tr className="border-t border-emerald-200 dark:border-emerald-900"><td className="p-2">Por semana</td><td className="p-2">7</td><td className="p-2 text-right">~US$ 0,10</td></tr>
              <tr className="border-t border-emerald-200 dark:border-emerald-900"><td className="p-2">Por mês</td><td className="p-2">30</td><td className="p-2 text-right">~US$ 0,45</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mb-4 text-xs text-gray-500 dark:text-zinc-400">
          <strong className="text-amber-700 dark:text-amber-400">Nota:</strong> a ferramenta devolve{" "}
          <strong>até ~200 curtidores por post</strong> (sem "próxima página"). Como nossos posts têm em
          média <strong>~160 curtidas</strong>, na maioria pegamos <strong>todo mundo</strong>; só nos
          posts virais (&gt;200 curtidas, ~10% deles) ficamos com os ~200 principais. Isso não muda o
          custo — cada post custa o mesmo — só limita a completude nos posts grandes (o que é de sobra
          pro objetivo de achar leads).
        </p>

        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">👥 Seguidores — quanto custa buscar</p>
        <p className="mb-2 text-xs text-gray-500 dark:text-zinc-400">
          Não relemos os ~50 mil seguidores antigos toda vez (isso que era caro). Cada busca olha só os{" "}
          <strong>~500 seguidores mais recentes</strong> — que é onde estão os novos. Fica praticamente de graça.
        </p>
        <div className="overflow-hidden rounded border border-emerald-200 dark:border-emerald-900 text-xs mb-2">
          <table className="w-full">
            <thead className="bg-emerald-100/60 dark:bg-emerald-950/40 text-gray-600 dark:text-zinc-400">
              <tr><th className="text-left p-2 font-medium">Período (buscando todo dia)</th><th className="text-left p-2 font-medium">Buscas</th><th className="text-right p-2 font-medium">Custo</th></tr>
            </thead>
            <tbody className="text-gray-700 dark:text-zinc-300">
              <tr className="border-t border-emerald-200 dark:border-emerald-900"><td className="p-2">Por dia</td><td className="p-2">1</td><td className="p-2 text-right">~US$ 0,003</td></tr>
              <tr className="border-t border-emerald-200 dark:border-emerald-900"><td className="p-2">Por semana</td><td className="p-2">7</td><td className="p-2 text-right">~US$ 0,02</td></tr>
              <tr className="border-t border-emerald-200 dark:border-emerald-900"><td className="p-2">Por mês</td><td className="p-2">30</td><td className="p-2 text-right">~US$ 0,09</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mb-4 text-xs text-gray-500 dark:text-zinc-400">
          Se um dia quisermos a <strong>lista inteira dos 50 mil</strong> (varredura completa, uma vez),
          custa <strong>~US$ 0,30 por varredura</strong> — mas isso não é necessário pra pegar quem
          seguiu de agora em diante.
        </p>

        <p className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Total — os dois, todo dia</p>
        <p className="mb-3 text-xs text-gray-500 dark:text-zinc-400">
          Curtidas + seguidores buscando <strong>todo dia</strong> ={" "}
          <strong className="text-emerald-700 dark:text-emerald-300">~US$ 0,55/mês</strong> (~US$ 7/ano).
          Pra comparar, o mesmo no fornecedor antigo (Apify) passava de <strong>US$ 390/mês</strong>.
          <span className="block mt-1">(estimativas sobre ~50 mil seguidores e ~50 posts/mês; a 1ª busca real confirma.)</span>
        </p>

        <p className="text-xs text-gray-500 dark:text-zinc-400">
          <strong className="text-gray-700 dark:text-zinc-300">O que ainda depende de decisão:</strong>{" "}
          (1) <strong>colocar saldo</strong> na HikerAPI (~US$10) pra ligar as curtidas; (2) o{" "}
          <strong>sinal verde do jurídico (LGPD)</strong> antes de ligar os <strong>seguidores</strong> —
          é dado de gente que não consentiu, então seguidores fica desligado até isso.
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
          <li>Ingestão de <strong>curtidas e seguidores via HikerAPI</strong> — código pronto (cliente + job diário + botões de sync), ~280× mais barato que o Apify; token validado.</li>
        </ul>

        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">Em andamento</p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li><strong>Deploy</strong> do módulo em produção.</li>
          <li><strong>Ligar as curtidas:</strong> falta só <strong>colocar saldo na HikerAPI</strong> (~US$10) — o teste real dispara na hora.</li>
        </ul>

        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">Pendente</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Reconectar o Instagram</strong> em prod (após deploy) — liga a captura de <strong>comentários</strong> pela API oficial (o sinal público mais quente, sem scraping) + validar que vêm com @username.</li>
          <li><strong>Backfill do @handle dos leads de DM</strong> — via API de mensagens do IG; fecha o dedup. Pega carona na reconexão.</li>
          <li><strong>Confirmar acessos</strong> dos SDRs em prod e validar os pesos padrão do scoring.</li>
          <li>
            <strong>Piloto de curtidas:</strong> com saldo, ligar e medir por 2–4 semanas se curtidor vira oportunidade (o token no <code>.env</code>/Render já ativa o job diário sozinho).
          </li>
          <li>
            <strong>Seguidores:</strong> só ligar após <strong>parecer jurídico (LGPD)</strong> — é dado de quem não consentiu. Fica desligado por padrão (flag <code>HIKERAPI_FOLLOWERS_ENABLED</code>).
          </li>
        </ul>
      </section>
    </div>
  );
}
