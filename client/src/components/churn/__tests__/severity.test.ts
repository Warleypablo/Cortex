import { describe, it, expect } from "vitest";
import { severityLevel, severityHex } from "../severity";
describe("severity", () => {
  it("classifica por faixa", () => {
    expect(severityLevel(0.1)).toBe("ok");
    expect(severityLevel(0.4)).toBe("warn");
    expect(severityLevel(0.6)).toBe("bad");
    expect(severityLevel(0.9)).toBe("critical");
  });
  it("hex muda com severidade", () => {
    expect(severityHex(0.1)).not.toBe(severityHex(0.9));
  });
});
