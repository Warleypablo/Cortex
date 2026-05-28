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
    </div>
  );
}
