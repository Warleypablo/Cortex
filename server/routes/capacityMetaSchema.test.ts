import { describe, it, expect } from "vitest";
import { capacityMetaSchema } from "./capacity";

// Payload legado válido, exceto pela chave em teste (cap_clientes).
const basePayload = {
  nome: "Fulano",
  match_responsavel: "Fulano",
  categoria: "Squadra",
  cap_recorrente: null,
  cap_mrr: null,
  cap_pontual: null,
  cap_contas: 10,
  ordem: 0,
  ativo: true,
};

describe("capacityMetaSchema — cap_clientes tolerante a payload legado", () => {
  it("payload sem a chave cap_clientes → parse com sucesso e cap_clientes === null", () => {
    const parsed = capacityMetaSchema.safeParse(basePayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cap_clientes).toBeNull();
      // undefined nunca deve escapar para o SQL — precisa ser null de verdade.
      expect(parsed.data.cap_clientes).not.toBeUndefined();
      expect("cap_clientes" in parsed.data).toBe(true);
    }
  });

  it("payload com cap_clientes: null → sucesso, null", () => {
    const parsed = capacityMetaSchema.safeParse({ ...basePayload, cap_clientes: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cap_clientes).toBeNull();
    }
  });

  it("payload com cap_clientes: 15 → sucesso, 15", () => {
    const parsed = capacityMetaSchema.safeParse({ ...basePayload, cap_clientes: 15 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cap_clientes).toBe(15);
    }
  });

  it("payload com cap_clientes: -1 → falha", () => {
    const parsed = capacityMetaSchema.safeParse({ ...basePayload, cap_clientes: -1 });
    expect(parsed.success).toBe(false);
  });
});
