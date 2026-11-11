import { describe, expect, it } from "vitest";
import { baseNumero, proximosNumeros } from "./numeracao";

describe("numeração da O.S.", () => {
  it("monta a data invertida com o sufixo", () => {
    expect(baseNumero("11/11/2026", "CX")).toBe("20261111CX");
    expect(baseNumero("05/03/2027", "DD")).toBe("20270305DD");
  });

  it("uma só no dia fica sem P", () => {
    expect(proximosNumeros("20261111CX", [], 1)).toEqual(["20261111CX"]);
  });

  it("várias no mesmo lote recebem P1, P2...", () => {
    expect(proximosNumeros("20261111DD", [], 4)).toEqual(["20261111DDP1", "20261111DDP2", "20261111DDP3", "20261111DDP4"]);
  });

  it("continua depois das que já existem, sem mudar as antigas", () => {
    expect(proximosNumeros("20261111CX", ["20261111CX"], 1)).toEqual(["20261111CXP2"]);
    expect(proximosNumeros("20261111CX", ["20261111CXP1", "20261111CXP2"], 2)).toEqual(["20261111CXP3", "20261111CXP4"]);
    expect(proximosNumeros("20261111CX", ["20261111DDP1", "20261112CX"], 1)).toEqual(["20261111CX"]);
  });
});
