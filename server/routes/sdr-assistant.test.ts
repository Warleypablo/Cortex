import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyDealStatus, searchCompanies } from "./sdr-assistant";

describe("classifyDealStatus", () => {
  it("retorna 'perdido' quando stage contém 'Perdido'", () => {
    expect(classifyDealStatus("Negócio Perdido")).toBe("perdido");
    expect(classifyDealStatus("Perdido - sem interesse")).toBe("perdido");
  });

  it("retorna 'perdido' quando stage contém 'LOSE'", () => {
    expect(classifyDealStatus("LOSE")).toBe("perdido");
    expect(classifyDealStatus("C1:LOSE")).toBe("perdido");
  });

  it("retorna 'ganho' quando stage contém 'Ganho' ou 'WON'", () => {
    expect(classifyDealStatus("Negócio Ganho")).toBe("ganho");
    expect(classifyDealStatus("WON")).toBe("ganho");
    expect(classifyDealStatus("C1:WON")).toBe("ganho");
  });

  it("retorna 'ativo' em qualquer outro caso", () => {
    expect(classifyDealStatus("Proposta enviada")).toBe("ativo");
    expect(classifyDealStatus("Contactado")).toBe("ativo");
    expect(classifyDealStatus("")).toBe("ativo");
  });

  it("é case-insensitive", () => {
    expect(classifyDealStatus("negócio perdido")).toBe("perdido");
    expect(classifyDealStatus("lose")).toBe("perdido");
    expect(classifyDealStatus("negócio ganho")).toBe("ganho");
  });

  it("classifica stages 'Descartado*' como perdido (padrão do Bitrix Turbo)", () => {
    expect(classifyDealStatus("Descartado")).toBe("perdido");
    expect(classifyDealStatus("Descartado/sem fit")).toBe("perdido");
    expect(classifyDealStatus("Descarte - timing")).toBe("perdido");
  });

  it("classifica 'Contrato assinado' como ganho", () => {
    expect(classifyDealStatus("Contrato assinado")).toBe("ganho");
  });

  it("mantém 'Congelado' como ativo (lead em pausa, pode voltar)", () => {
    expect(classifyDealStatus("Congelado")).toBe("ativo");
    expect(classifyDealStatus("Congelados")).toBe("ativo");
  });
});

describe("searchCompanies", () => {
  const mockDb = { execute: vi.fn() } as any;

  beforeEach(() => {
    mockDb.execute.mockReset();
  });

  it("rejeita query com menos de 3 caracteres", async () => {
    await expect(searchCompanies(mockDb, "ab")).rejects.toThrow(/3 caracteres/);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it("rejeita query vazia ou só espaços", async () => {
    await expect(searchCompanies(mockDb, "")).rejects.toThrow(/3 caracteres/);
    await expect(searchCompanies(mockDb, "   ")).rejects.toThrow(/3 caracteres/);
  });

  it("retorna lista vazia quando não há matches", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    const result = await searchCompanies(mockDb, "EmpresaInexistente");
    expect(result).toEqual([]);
  });

  it("retorna lista de matches com deal_count e last_stage", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        { company_name: "Padaria Delícia", deal_count: 3, last_deal_id: 99, last_stage: "Proposta enviada" },
        { company_name: "Padaria Boa",     deal_count: 1, last_deal_id: 50, last_stage: "Negócio Perdido" },
      ],
    });
    const result = await searchCompanies(mockDb, "Padaria");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      company_name: "Padaria Delícia",
      deal_count: 3,
      last_stage: "Proposta enviada",
    });
  });

  it("aceita exatamente 10 resultados (via LIMIT SQL)", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: Array.from({ length: 10 }, (_, i) => ({
        company_name: `Empresa ${i}`,
        deal_count: 1,
        last_deal_id: i,
        last_stage: "Novo",
      })),
    });
    const result = await searchCompanies(mockDb, "Empresa");
    expect(result).toHaveLength(10);
  });
});
