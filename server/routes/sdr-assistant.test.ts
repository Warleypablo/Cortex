import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyDealStatus, searchCompanies, getCompanyTimeline } from "./sdr-assistant";

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

describe("getCompanyTimeline", () => {
  const mockDb = { execute: vi.fn() } as any;
  beforeEach(() => {
    mockDb.execute.mockReset();
  });

  it("retorna array vazio quando empresa não tem deals", async () => {
    mockDb.execute.mockResolvedValueOnce({ rows: [] });
    const result = await getCompanyTimeline(mockDb, "Inexistente LTDA");
    expect(result).toEqual([]);
  });

  it("classifica status correto em cada deal", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        {
          id: 3, title: "X - Prospect", stage_name: "Proposta enviada",
          categoria: "Comercial", source: null,
          valor_recorrente: 1000, valor_pontual: null,
          date_create: "2026-04-01", data_fechamento: null,
          comments: null, motivo_perda: null,
          responsavel: "Laura", closer: null,
        },
        {
          id: 2, title: "X - retry", stage_name: "Descartado/sem fit",
          categoria: "Comercial", source: null,
          valor_recorrente: null, valor_pontual: null,
          date_create: "2024-08-01", data_fechamento: "2024-08-15",
          comments: "já tem agência", motivo_perda: null,
          responsavel: "Kaike", closer: null,
        },
        {
          id: 1, title: "X - fechado", stage_name: "Negócio Ganho",
          categoria: "Comercial", source: null,
          valor_recorrente: 2000, valor_pontual: null,
          date_create: "2023-11-01", data_fechamento: "2023-11-20",
          comments: null, motivo_perda: null,
          responsavel: "Guilherme", closer: "João",
        },
      ],
    });
    const result = await getCompanyTimeline(mockDb, "X");
    expect(result).toHaveLength(3);
    expect(result[0].status).toBe("ativo");
    expect(result[1].status).toBe("perdido"); // "Descartado/sem fit"
    expect(result[2].status).toBe("ganho");
    expect(result[2].closer).toBe("João");
  });

  it("converte date_create ISO para YYYY-MM-DD", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        {
          id: 10, title: "X", stage_name: "Ativo",
          categoria: null, source: null,
          valor_recorrente: null, valor_pontual: null,
          date_create: new Date("2026-04-10T12:34:56Z"),
          data_fechamento: null, comments: null, motivo_perda: null,
          responsavel: "João", closer: null,
        },
      ],
    });
    const result = await getCompanyTimeline(mockDb, "X");
    expect(result[0].criado_em).toBe("2026-04-10");
  });

  it("converte valores numéricos Decimal para Number", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        {
          id: 1, title: "X", stage_name: "Ativo",
          categoria: null, source: null,
          valor_recorrente: "1500.00", valor_pontual: "500.00",
          date_create: "2026-04-01", data_fechamento: null,
          comments: null, motivo_perda: null,
          responsavel: null, closer: null,
        },
      ],
    });
    const result = await getCompanyTimeline(mockDb, "X");
    expect(result[0].valor_mrr).toBe(1500);
    expect(result[0].valor_pontual).toBe(500);
  });

  it("trata responsavel e closer nulos sem quebrar", async () => {
    mockDb.execute.mockResolvedValueOnce({
      rows: [
        {
          id: 1, title: "X", stage_name: "Ativo",
          categoria: null, source: null,
          valor_recorrente: null, valor_pontual: null,
          date_create: "2026-04-01", data_fechamento: null,
          comments: null, motivo_perda: null,
          responsavel: null, closer: null,
        },
      ],
    });
    const result = await getCompanyTimeline(mockDb, "X");
    expect(result[0].sdr).toBeNull();
    expect(result[0].closer).toBeNull();
    expect(result[0].valor_mrr).toBeNull();
  });
});
