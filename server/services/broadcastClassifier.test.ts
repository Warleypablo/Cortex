import { describe, it, expect } from "vitest";
import { inferirBase } from "./broadcastClassifier";

/**
 * Tags canônicas (pós-migração). inferirBase deve reconhecer tanto estas quanto
 * as legacy (via LEGACY_TAG_ALIASES, resolvidas dentro de contatoSatisfazBase).
 */
const CREATORS = "[lead]_creators";
const GERAL = "[lead]_geral";
const MQL = "[status]_mql";
const FAT_0_30 = "[faturamento]_0_30k";
const FAT_50_100 = "[faturamento]_50k_100k";
const CLIENTE = "[status]_cliente";

// helper: gera N destinatários com o mesmo conjunto de tags
const nRecips = (n: number, tags: string[]) => Array.from({ length: n }, () => tags);

describe("inferirBase", () => {
  it("blast amplo p/ todos os Creators (faturamento variado) → 'Creators - Todos'", () => {
    const recipientTags = [
      ...nRecips(42, [CREATORS, FAT_0_30]),
      ...nRecips(58, [CREATORS, FAT_50_100]),
    ];
    // nenhuma sub-base atinge 90% (0-30k=42%, 50-100k=58%), só a "- Todos" cobre 100%
    expect(inferirBase(recipientTags).base).toBe("Creators - Todos");
  });

  it("blast segmentado p/ Creators <30k → sub-base específica, não a '- Todos'", () => {
    const recipientTags = [
      ...nRecips(97, [CREATORS, FAT_0_30]),
      ...nRecips(3, [CREATORS, FAT_50_100]), // ruído < 10%
    ];
    const { base, matchPct } = inferirBase(recipientTags);
    expect(base).toBe("Creators - Abaixo de 30k"); // cobertura 97% >= 90% e mais específica
    expect(matchPct).toBeCloseTo(0.97, 2);
  });

  it("blast p/ MQLs de Creators → 'Creators - MQLs' (tagsAll não deve zerar)", () => {
    // regressão: aliases expandidos em tagsAll faziam a sub-base zerar mesmo aqui
    const recipientTags = nRecips(50, [CREATORS, MQL, FAT_0_30]);
    expect(inferirBase(recipientTags).base).toBe("Creators - MQLs");
  });

  it("blast misto Geral+Creators (nenhuma base >=90%) → base dominante, nunca null", () => {
    const recipientTags = [
      ...nRecips(60, [CREATORS, FAT_50_100]),
      ...nRecips(40, [GERAL, FAT_50_100]),
    ];
    expect(inferirBase(recipientTags).base).toBe("Creators - Todos"); // dominante (60%)
  });

  it("base independente disjunta das '- Todos' → 'Clientes'", () => {
    expect(inferirBase(nRecips(30, [CLIENTE])).base).toBe("Clientes");
  });

  it("reconhece tags legacy (alias) tão bem quanto as canônicas", () => {
    // '[creators]' é alias legacy de '[lead]_creators'; 'abaixo de 100k' não bate 0-30k
    const recipientTags = nRecips(20, ["[creators]", "[faturamento] r$0 - r$30.000"]);
    expect(inferirBase(recipientTags).base).toBe("Creators - Abaixo de 30k");
  });

  it("fallback com base dominante majoritária (56%) → rotula a dominante", () => {
    const recipientTags = [
      ...nRecips(56, [CREATORS, FAT_50_100]),
      ...nRecips(44, [GERAL, FAT_0_30]),
    ];
    expect(inferirBase(recipientTags).base).toBe("Creators - Todos");
  });

  it("fallback com cobertura irrisória (poucos congelados no meio) → null, não inventa rótulo", () => {
    const recipientTags = [
      ...nRecips(3, ["[status]_congelado"]),
      ...nRecips(97, ["[tag]_sem_base"]),
    ];
    expect(inferirBase(recipientTags).base).toBeNull();
  });

  it("sem destinatários → null", () => {
    expect(inferirBase([]).base).toBeNull();
  });

  it("destinatários sem tag conhecida → null (não força uma base)", () => {
    expect(inferirBase(nRecips(15, ["[tag]_inexistente"])).base).toBeNull();
  });
});
