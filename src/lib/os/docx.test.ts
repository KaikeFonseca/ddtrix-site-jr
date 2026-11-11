import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { preencherModelo, textoDosParagrafos, xmlDoDocumento, type CampoModelo } from "./docx";

const pasta = join(process.cwd(), "db", "modelos-iniciais");
const campos = JSON.parse(readFileSync(join(pasta, "campos.json"), "utf8")) as Record<string, CampoModelo[]>;
const ARQ = { caixas: "OS_Limp_Cx.docx", dedet: "OS_DDT.docx", desr: "OS_DSR.docx" } as const;
const modelo = (k: keyof typeof ARQ) => new Uint8Array(readFileSync(join(pasta, ARQ[k])));

const DADOS = {
  validade: "10/11/2027",
  osnum: "20261111CX",
  data: "11/11/2026",
  hora: "09:00",
  cliente: "Condomínio Campolim", // contém "Campolim", que é texto de exemplo de outro campo
  rua: "Av. Itália, 277",
  bairro: "Parque Monte Bianco",
  cidade: "Araçoiaba da Serra/SP",
  servico: "Limpeza de caixa D'água",
};

describe("preenchimento dos modelos", () => {
  for (const k of Object.keys(ARQ) as (keyof typeof ARQ)[]) {
    it(`${k}: preenche todos os campos e muda só eles`, async () => {
      const antes = await textoDosParagrafos(modelo(k));
      const r = await preencherModelo(modelo(k), campos[k], DADOS);
      expect(r.faltando).toEqual([]);
      const depois = await textoDosParagrafos(r.docx);
      expect(depois).toHaveLength(antes.length);

      const tudo = depois.join("\n");
      expect(tudo).toContain("20261111CX");
      expect(tudo).toContain("Condomínio Campolim");
      expect(tudo).toContain("Av. Itália, 277 - Parque Monte Bianco - Araçoiaba da Serra/SP");
      expect(tudo).toContain("10/11/2027");

      // Parágrafos sem campo ficam idênticos (garantia, produtos, responsável técnico...).
      const exemplos = campos[k].map((f) => f.s);
      antes.forEach((p, i) => {
        if (!exemplos.some((s) => p.includes(s))) expect(depois[i]).toBe(p);
      });
    });
  }

  it("a garantia e o responsável técnico continuam no lugar", async () => {
    const r = await preencherModelo(modelo("dedet"), campos.dedet, DADOS);
    const t = (await textoDosParagrafos(r.docx)).join("\n");
    expect(t).toContain("03 meses");
    expect(t).toContain("JOANA DE ALENCAR BORGES FORTES");
  });

  it("observações inteiras e pagamento em cartão com LEVAR A MAQUININHA em vermelho e realce amarelo", async () => {
    const obs = ["Primeira observação; com ponto e vírgula.", "Segunda observação, também inteira."];
    const r = await preencherModelo(modelo("dedet"), campos.dedet, {
      ...DADOS,
      observacoes: obs,
      pagamento: { forma: "Cartão de débito", valor: "R$ 450", maquininha: true },
    });
    const p = await textoDosParagrafos(r.docx);
    const i = p.findIndex((x) => x.startsWith("Observações:"));
    expect(p[i]).toBe(`Observações: ${obs[0]}`);
    expect(p[i + 1]).toBe(obs[1]);
    expect(p[i + 2]).toBe("Pagamento: Cartão de débito · R$ 450 · LEVAR A MAQUININHA");
    const xml = await xmlDoDocumento(r.docx);
    expect(xml).toMatch(/<w:color w:val="FF0000"\/>.*?<w:highlight w:val="yellow"\/>.*?LEVAR A MAQUININHA/);
  });

  it("sem forma de pagamento, nada de pagamento é escrito", async () => {
    const r = await preencherModelo(modelo("caixas"), campos.caixas, {
      ...DADOS,
      observacoes: ["Só a observação."],
      pagamento: { forma: null, valor: "R$ 300", maquininha: false },
    });
    const t = (await textoDosParagrafos(r.docx)).join("\n");
    expect(t).toContain("Observações: Só a observação.");
    expect(t).not.toContain("Pagamento");
    expect(t).not.toContain("R$ 300");
  });

  it("aplica escala de fonte sem passar do piso", async () => {
    const r = await preencherModelo(modelo("desr"), campos.desr, DADOS, { escala: { fonte: 0.5, espaco: 0.8 }, fonteMinimaPt: 7 });
    const xml = await xmlDoDocumento(r.docx);
    const tamanhos = [...xml.matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => +m[1]);
    const original = [...(await xmlDoDocumento(modelo("desr"))).matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => +m[1]);
    tamanhos.forEach((t, i) => expect(t).toBe(original[i] <= 14 ? original[i] : Math.max(14, Math.round(original[i] * 0.5))));
  });

  it("aponta campo que não existe no modelo", async () => {
    const r = await preencherModelo(modelo("caixas"), [...campos.caixas, { k: "cliente", s: "TEXTO QUE NÃO EXISTE", n: 1 }], DADOS);
    expect(r.faltando).toEqual(["cliente"]);
  });
});
