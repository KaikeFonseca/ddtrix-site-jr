import { describe, expect, it } from "vitest";
import { divergenciaDeEndereco, reconhecerCliente, ruaNormalizada } from "./clientes";

const CANDIDATOS = [
  { id: "1", nome: "Condomínio Portal do Ipanema", telefones: [] },
  { id: "2", nome: "Cond. Residencial Vista Ipanema", telefones: ["(15) 99654-1111"] },
  { id: "3", nome: "Pedro Luiz Silva Pinto", telefones: [] },
];

describe("reconhecimento de clientes", () => {
  it("reconhece com acento, maiúsculas e abreviação diferentes", () => {
    expect(reconhecerCliente("condominio portal do ipanema", null, CANDIDATOS)).toMatchObject({ tipo: "reconhecido", clienteId: "1" });
    expect(reconhecerCliente("Residencial Vista Ipanema", null, CANDIDATOS)).toMatchObject({ tipo: "reconhecido", clienteId: "2" });
    expect(reconhecerCliente("Pedro Luis Silva Pinto", null, CANDIDATOS)).toMatchObject({ tipo: "reconhecido", clienteId: "3" });
  });

  it("reconhece pelo telefone", () => {
    expect(reconhecerCliente("Outro nome", "15 996541111", CANDIDATOS)).toMatchObject({ tipo: "reconhecido", clienteId: "2", por: "telefone" });
  });

  it("parecido demais para ignorar, diferente demais para assumir: pergunta", () => {
    expect(reconhecerCliente("Pedro Silva Pinto", null, CANDIDATOS)).toMatchObject({ tipo: "possivel", clienteId: "3" });
  });

  it("cliente novo", () => {
    expect(reconhecerCliente("Marcus Souza", null, CANDIDATOS)).toEqual({ tipo: "novo" });
    expect(reconhecerCliente("Condomínio Mirante Ipanema", null, CANDIDATOS).tipo).not.toBe("reconhecido");
  });
});

describe("endereços", () => {
  const salvos = [{ id: "e1", rua: "Avenida Italia, 277", bairro: "Parque Monte Bianco", cidade: "Araçoiaba da Serra/SP", referencia: null, principal: true }];

  it("abreviação e acento não contam como diferença", () => {
    expect(ruaNormalizada("Av. Itália, 277")).toBe("avenida italia 277");
    expect(divergenciaDeEndereco("Av. Itália, 277", salvos)).toBeNull();
  });

  it("endereço diferente gera alerta com o salvo", () => {
    expect(divergenciaDeEndereco("R. Imola, 40", salvos)).toMatchObject({ id: "e1" });
  });

  it("cliente sem endereço salvo não gera alerta", () => {
    expect(divergenciaDeEndereco("R. Imola, 40", [])).toBeNull();
  });
});
