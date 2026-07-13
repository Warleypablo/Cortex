// Módulo puro (sem I/O). Banco de perguntas DISC, arquétipos e pontuação.
// Usado no client (wizard/resultado) e re-validado no server.

export type Fator = "D" | "I" | "S" | "C";

export const FATORES: Fator[] = ["D", "I", "S", "C"];

export interface DiscOpcao {
  palavra: string;
  fator: Fator;
}

export interface DiscPergunta {
  id: number;
  opcoes: DiscOpcao[];
}

// 40 palavras por fator (uma entra em cada grupo, no mesmo índice).
const D_WORDS = [
  "Decidido", "Direto", "Corajoso", "Competitivo", "Determinado", "Assertivo",
  "Objetivo", "Ousado", "Exigente", "Firme", "Enérgico", "Independente",
  "Franco", "Focado", "Audacioso", "Confiante", "Dominante", "Resoluto",
  "Impositivo", "Pioneiro", "Intenso", "Prático", "Ambicioso", "Autossuficiente",
  "Vigoroso", "Combativo", "Provocador", "Insistente", "Direcionador", "Realizador",
  "Incisivo", "Desbravador", "Persistente", "Controlador", "Vencedor", "Empreendedor",
  "Inquieto", "Veloz", "Frontal", "Líder",
];
const I_WORDS = [
  "Entusiasta", "Sociável", "Charmoso", "Comunicativo", "Otimista", "Expressivo",
  "Persuasivo", "Extrovertido", "Animado", "Espontâneo", "Simpático", "Falante",
  "Inspirador", "Envolvente", "Divertido", "Caloroso", "Alegre", "Convincente",
  "Popular", "Magnético", "Brincalhão", "Empolgado", "Receptivo", "Cativante",
  "Motivador", "Emotivo", "Impulsivo", "Contagiante", "Festivo", "Vibrante",
  "Sonhador", "Amigável", "Radiante", "Espirituoso", "Entrosado", "Efusivo",
  "Encantador", "Expansivo", "Gregário", "Sorridente",
];
const S_WORDS = [
  "Paciente", "Cooperativo", "Leal", "Calmo", "Estável", "Compreensivo",
  "Prestativo", "Gentil", "Tranquilo", "Consistente", "Confiável", "Sereno",
  "Acolhedor", "Ponderado", "Fiel", "Colaborativo", "Harmonioso", "Amável",
  "Constante", "Equilibrado", "Dedicado", "Solidário", "Atencioso", "Diplomático",
  "Moderado", "Pacífico", "Sincero", "Modesto", "Cordial", "Bondoso",
  "Companheiro", "Empático", "Zeloso", "Previsível", "Comedido", "Conciliador",
  "Apoiador", "Perseverante", "Gradual", "Regular",
];
const C_WORDS = [
  "Preciso", "Analítico", "Criterioso", "Cauteloso", "Detalhista", "Organizado",
  "Metódico", "Perfeccionista", "Sistemático", "Lógico", "Rigoroso", "Meticuloso",
  "Exato", "Prudente", "Disciplinado", "Cuidadoso", "Racional", "Correto",
  "Formal", "Reservado", "Cético", "Investigativo", "Minucioso", "Conservador",
  "Reflexivo", "Ordenado", "Preventivo", "Regrado", "Questionador", "Estruturado",
  "Normativo", "Diligente", "Escrupuloso", "Atento", "Perspicaz", "Calculista",
  "Ponderativo", "Sistêmico", "Padronizado", "Avaliador",
];

// Rotaciona a ordem das opções por índice para evitar viés posicional (sem randomness).
function rotate<T>(arr: T[], by: number): T[] {
  const n = arr.length;
  const k = ((by % n) + n) % n;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

export const DISC_PERGUNTAS: DiscPergunta[] = D_WORDS.map((d, i) => {
  const base: DiscOpcao[] = [
    { palavra: d, fator: "D" },
    { palavra: I_WORDS[i], fator: "I" },
    { palavra: S_WORDS[i], fator: "S" },
    { palavra: C_WORDS[i], fator: "C" },
  ];
  return { id: i + 1, opcoes: rotate(base, i) };
});

export interface DiscArquetipo {
  fator: Fator;
  nome: string;
  tagline: string;
  pontosFortes: string[];
  comunicacao: string[];
  atencao: string[];
}

export const DISC_ARQUETIPOS: Record<Fator, DiscArquetipo> = {
  D: {
    fator: "D",
    nome: "Executor",
    tagline: "Foco em resultado, ritmo e decisão.",
    pontosFortes: [
      "Toma decisões rápidas e assume riscos",
      "Orientado a metas e resultados",
      "Direto e objetivo na comunicação",
      "Assume o comando em situações de pressão",
    ],
    comunicacao: [
      "Seja direto e vá ao ponto — sem rodeios",
      "Fale de resultados, prazos e o 'o quê', não o 'como'",
      "Dê autonomia e deixe a decisão com a pessoa",
      "Respeite o tempo: reuniões curtas e objetivas",
    ],
    atencao: [
      "Pode parecer impaciente ou ríspido sob pressão",
      "Tende a atropelar o processo e os detalhes",
      "Escutar mais antes de decidir",
      "Cuidar do impacto do tom nas pessoas",
    ],
  },
  I: {
    fator: "I",
    nome: "Comunicador",
    tagline: "Energia, relacionamento e influência.",
    pontosFortes: [
      "Engaja e inspira pessoas com facilidade",
      "Comunicação entusiasmada e persuasiva",
      "Cria conexões e networking naturalmente",
      "Otimista e criativo diante de problemas",
    ],
    comunicacao: [
      "Comece pelo lado humano e pela visão",
      "Dê espaço para a pessoa falar e trocar ideias",
      "Reconheça publicamente as conquistas",
      "Traga entusiasmo — evite frieza excessiva",
    ],
    atencao: [
      "Pode se dispersar e perder o foco no detalhe",
      "Tende a assumir mais do que consegue entregar",
      "Firmar prazos e acompanhar o follow-up",
      "Equilibrar otimismo com realismo",
    ],
  },
  S: {
    fator: "S",
    nome: "Planejador",
    tagline: "Estabilidade, cooperação e constância.",
    pontosFortes: [
      "Confiável e consistente na entrega",
      "Ótimo ouvinte e mediador de conflitos",
      "Colabora e apoia o time com paciência",
      "Mantém a calma e a harmonia sob estresse",
    ],
    comunicacao: [
      "Traga contexto e segurança antes de mudanças",
      "Seja paciente e evite pressão por decisão imediata",
      "Valorize a lealdade e o trabalho em equipe",
      "Explique o 'porquê' e o passo a passo",
    ],
    atencao: [
      "Resistência a mudanças bruscas",
      "Dificuldade de dizer 'não' e impor limites",
      "Explicitar opiniões em vez de só acomodar",
      "Ganhar velocidade em decisões urgentes",
    ],
  },
  C: {
    fator: "C",
    nome: "Analista",
    tagline: "Precisão, critério e qualidade.",
    pontosFortes: [
      "Atento a detalhes e à qualidade",
      "Analisa com lógica e dados antes de agir",
      "Organizado, metódico e confiável no rigor",
      "Antecipa riscos e evita erros",
    ],
    comunicacao: [
      "Traga dados, fatos e o raciocínio por trás",
      "Dê tempo para análise — evite decisões no impulso",
      "Seja preciso e cumpra o combinado",
      "Estruture a informação de forma organizada",
    ],
    atencao: [
      "Pode travar por excesso de análise (perfeccionismo)",
      "Tende a ser crítico e reservado demais",
      "Aceitar o 'bom o suficiente' quando cabe",
      "Comunicar mais e mais cedo com o time",
    ],
  },
};

export interface DiscResultado {
  scoreD: number;
  scoreI: number;
  scoreS: number;
  scoreC: number;
  percentuais: Record<Fator, number>;
  dominante: Fator;
  secundario: Fator;
}

export function computeDiscResult(respostas: Fator[]): DiscResultado {
  const cont: Record<Fator, number> = { D: 0, I: 0, S: 0, C: 0 };
  for (const f of respostas) {
    if (f in cont) cont[f]++;
  }
  const total = respostas.length || 1;
  const percentuais: Record<Fator, number> = {
    D: Math.round((cont.D / total) * 100),
    I: Math.round((cont.I / total) * 100),
    S: Math.round((cont.S / total) * 100),
    C: Math.round((cont.C / total) * 100),
  };
  // Ajusta arredondamento para somar 100 (adiciona a diferença ao dominante).
  const somaPct = percentuais.D + percentuais.I + percentuais.S + percentuais.C;
  // Ordem canônica de desempate: D > I > S > C.
  const ordenados = [...FATORES].sort((a, b) => {
    if (cont[b] !== cont[a]) return cont[b] - cont[a];
    return FATORES.indexOf(a) - FATORES.indexOf(b);
  });
  if (somaPct !== 100) percentuais[ordenados[0]] += 100 - somaPct;
  return {
    scoreD: cont.D,
    scoreI: cont.I,
    scoreS: cont.S,
    scoreC: cont.C,
    percentuais,
    dominante: ordenados[0],
    secundario: ordenados[1],
  };
}
