import { describe, it, expect } from "vitest";
import { gerarSemanas, parSemanas } from "./semanas";

describe("gerarSemanas", () => {
  it("devolve a quantidade pedida, em ordem cronológica", () => {
    const s = gerarSemanas("2026-07-21", 12);
    expect(s).toHaveLength(12);
    expect(s[0].inicio < s[11].inicio).toBe(true);
  });

  it("toda janela vai de segunda a domingo", () => {
    for (const semana of gerarSemanas("2026-07-21", 12)) {
      expect(new Date(semana.inicio + "T00:00:00Z").getUTCDay()).toBe(1); // segunda
      expect(new Date(semana.fim + "T00:00:00Z").getUTCDay()).toBe(0); // domingo
    }
  });

  it("a última janela é a semana que contém hoje", () => {
    // 2026-07-21 é uma terça-feira
    const s = gerarSemanas("2026-07-21", 3);
    expect(s[2]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26" });
  });

  it("marca só a semana corrente como parcial", () => {
    const s = gerarSemanas("2026-07-21", 3);
    expect(s.map((x) => x.parcial)).toEqual([false, false, true]);
  });

  it("domingo ainda é semana corrente e parcial (o dia não acabou)", () => {
    const s = gerarSemanas("2026-07-26", 2); // 2026-07-26 é domingo
    expect(s[1]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26", parcial: true });
  });

  it("segunda-feira abre uma semana nova, e a anterior já conta como fechada", () => {
    const s = gerarSemanas("2026-07-27", 2); // segunda
    expect(s[1]).toMatchObject({ inicio: "2026-07-27", fim: "2026-08-02", parcial: true });
    expect(s[0]).toMatchObject({ inicio: "2026-07-20", fim: "2026-07-26", parcial: false });
  });

  it("atravessa virada de mês sem quebrar", () => {
    const s = gerarSemanas("2026-07-02", 2); // quinta
    expect(s[0]).toMatchObject({ inicio: "2026-06-22", fim: "2026-06-28" });
    expect(s[1]).toMatchObject({ inicio: "2026-06-29", fim: "2026-07-05" });
  });

  it("atravessa virada de ano sem quebrar", () => {
    const s = gerarSemanas("2027-01-07", 2); // quinta
    expect(s[0]).toMatchObject({ inicio: "2026-12-28", fim: "2027-01-03" });
    expect(s[1]).toMatchObject({ inicio: "2027-01-04", fim: "2027-01-10" });
  });

  it("label é dia/mês do início da semana", () => {
    expect(gerarSemanas("2026-07-21", 1)[0].label).toBe("20/07");
  });

  it("quantidade 1 devolve só a semana corrente", () => {
    expect(gerarSemanas("2026-07-21", 1)).toHaveLength(1);
  });
});

describe("parSemanas", () => {
  it("sem 'ate', devolve a última semana FECHADA e a anterior", () => {
    // 2026-07-24 é sexta. A semana corrente (20–26/07) está em curso e não entra.
    const { atual, anterior } = parSemanas("2026-07-24");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
    expect(anterior).toMatchObject({ inicio: "2026-07-06", fim: "2026-07-12" });
  });

  it("no domingo, a semana que termina hoje ainda NÃO é a fechada", () => {
    // o dia ainda não acabou: a foto do snapshot de domingo pode não existir
    const { atual } = parSemanas("2026-07-19");
    expect(atual).toMatchObject({ inicio: "2026-07-06", fim: "2026-07-12" });
  });

  it("na segunda, a semana recém-encerrada já é a fechada", () => {
    const { atual } = parSemanas("2026-07-20");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
  });

  it("com 'ate', ancora o par na semana que contém aquela data", () => {
    const { atual, anterior } = parSemanas("2026-07-24", "2026-06-24");
    expect(atual).toMatchObject({ inicio: "2026-06-22", fim: "2026-06-28" });
    expect(anterior).toMatchObject({ inicio: "2026-06-15", fim: "2026-06-21" });
  });

  it("nenhuma das duas semanas do par vem marcada como parcial", () => {
    const { atual, anterior } = parSemanas("2026-07-24");
    expect(atual.parcial).toBe(false);
    expect(anterior.parcial).toBe(false);
  });

  it("'ate' na semana corrente cai para a última fechada, nunca devolve semana em curso", () => {
    const { atual } = parSemanas("2026-07-24", "2026-07-22");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
  });

  it("'ate' futuro é ignorado: não dá para navegar para o futuro", () => {
    const { atual } = parSemanas("2026-07-24", "2026-12-01");
    expect(atual).toMatchObject({ inicio: "2026-07-13", fim: "2026-07-19" });
  });

  it("CONTRATO DE ÂNCORA: 'ate' em um dia da semana X devolve a semana ANTERIOR a X", () => {
    // É o que o botão 'Semana anterior' do front depende. Passar o domingo da
    // semana que se quer ver NÃO funciona: aquela semana vira a 'corrente' e é
    // descartada. Para ver 06–12/07, a âncora tem que cair em 13–19/07.
    const { atual } = parSemanas("2026-07-24", "2026-07-13");
    expect(atual).toMatchObject({ inicio: "2026-07-06", fim: "2026-07-12" });
  });
});
