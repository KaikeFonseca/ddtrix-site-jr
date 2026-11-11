// Gera PDFs de verdade com o LibreOffice. Pulado onde ele não estiver instalado.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CampoModelo } from "./docx";
import { gerarComAjuste, juntarPdfs, contarPaginas } from "./pdf";

let temLibreOffice = true;
try {
  execFileSync(process.env.SOFFICE_PATH ?? "soffice", ["--version"], { stdio: "ignore" });
} catch {
  temLibreOffice = false;
}

const pasta = join(process.cwd(), "db", "modelos-iniciais");
const campos = JSON.parse(readFileSync(join(pasta, "campos.json"), "utf8")) as Record<string, CampoModelo[]>;
const modelo = new Uint8Array(readFileSync(join(pasta, "OS_DDT.docx")));
const dados = {
  osnum: "20261111DDP1",
  data: "11/11/2026",
  hora: "09:00",
  cliente: "Condomínio Portal do Ipanema",
  rua: "Avenida Ipanema, 6055",
  bairro: "Jd Novo Horizonte",
  cidade: "Sorocaba/SP",
  servico: "Dedetização Completa/Desratização Mensal",
};

describe.skipIf(!temLibreOffice)("PDF em uma folha A4", () => {
  it("cabe em uma folha, inclusive com observação longa", { timeout: 120_000 }, async () => {
    const longa = "Quando verificar os dispositivos de desratização, conferir se não estão em lugares que facilitam para virar e espalhar. ".repeat(6);
    const [curta, comLonga] = await gerarComAjuste([
      { modelo, campos: campos.dedet, dados },
      { modelo, campos: campos.dedet, dados: { ...dados, observacoes: [longa], pagamento: { forma: "Cartão", valor: null, maquininha: true } } },
    ]);
    expect(curta.cabe).toBe(true);
    expect(curta.paginas).toBe(1);
    expect(comLonga.cabe).toBe(true);
    expect(comLonga.paginas).toBe(1);

    const unico = await juntarPdfs([curta.pdf, comLonga.pdf]);
    expect(await contarPaginas(unico)).toBe(2);
  });

  it("avisa quando nem no menor tamanho cabe, sem cortar texto", { timeout: 180_000 }, async () => {
    const enorme = "Texto de observação muito comprido que não cabe de jeito nenhum. ".repeat(120);
    const [g] = await gerarComAjuste([{ modelo, campos: campos.dedet, dados: { ...dados, observacoes: [enorme] } }]);
    expect(g.cabe).toBe(false);
    expect(g.paginas).toBeGreaterThan(1);
  });
});
