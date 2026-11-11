import { beforeAll, describe, expect, it } from "vitest";
import { criarSessao, lerQuem, sessaoValida } from "./sessao";

beforeAll(() => {
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef-teste";
});

describe("sessão", () => {
  it("aceita token assinado e recusa token adulterado", async () => {
    const token = await criarSessao();
    expect(await sessaoValida(token)).toBe(true);
    expect(await sessaoValida(token.slice(0, -2) + "xx")).toBe(false);
    expect(await sessaoValida(undefined)).toBe(false);
  });

  it("lê o nome de quem está usando", () => {
    expect(lerQuem(encodeURIComponent("Eduarda"))).toBe("Eduarda");
    expect(lerQuem(encodeURIComponent("  João  "))).toBe("João");
    expect(lerQuem("")).toBeNull();
    expect(lerQuem("%E0%A4%A")).toBeNull();
    expect(lerQuem("a".repeat(61))).toBeNull();
  });
});
