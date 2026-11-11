// Conversão .docx → PDF com o LibreOffice (sem custo) e ajuste para caber em uma folha A4.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import { preencherModelo, type CampoModelo, type DadosOS, type Escala } from "./docx";

const exec = promisify(execFile);
const SOFFICE = process.env.SOFFICE_PATH ?? "soffice";

// O LibreOffice não gosta de duas conversões ao mesmo tempo no mesmo perfil: fila simples.
let fila: Promise<unknown> = Promise.resolve();
function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const r = fila.then(tarefa, tarefa);
  fila = r.catch(() => undefined);
  return r;
}

/** Converte vários .docx de uma vez (bem mais rápido que um por um). */
export function converterParaPdf(arquivos: Uint8Array[]): Promise<Uint8Array[]> {
  return naFila(async () => {
    const dir = await mkdtemp(join(tmpdir(), "ddtrix-pdf-"));
    try {
      const nomes = arquivos.map((_, i) => join(dir, `os-${i}.docx`));
      await Promise.all(arquivos.map((a, i) => writeFile(nomes[i], a)));
      await exec(
        SOFFICE,
        ["--headless", "--norestore", `-env:UserInstallation=file://${join(tmpdir(), "ddtrix-lo-perfil")}`, "--convert-to", "pdf", "--outdir", dir, ...nomes],
        { timeout: 120_000 },
      );
      return Promise.all(nomes.map(async (n) => new Uint8Array(await readFile(n.replace(/\.docx$/, ".pdf")))));
    } catch (e) {
      throw new Error(`Não foi possível gerar o PDF. ${(e as Error).message}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

export async function contarPaginas(pdf: Uint8Array): Promise<number> {
  return (await PDFDocument.load(pdf)).getPageCount();
}

// Primeiro reduz a fonte aos poucos, depois os espaçamentos (seção 9 da especificação).
export const NIVEIS_AJUSTE: Escala[] = [
  { fonte: 1, espaco: 1 },
  { fonte: 1, espaco: 0.85 },
  { fonte: 0.95, espaco: 0.85 },
  { fonte: 0.9, espaco: 0.8 },
  { fonte: 0.85, espaco: 0.7 },
  { fonte: 0.8, espaco: 0.6 },
  { fonte: 0.75, espaco: 0.5 },
];

export type OSParaGerar = { modelo: Uint8Array; campos: CampoModelo[]; dados: DadosOS };

export type OSGerada = {
  docx: Uint8Array;
  pdf: Uint8Array;
  paginas: number;
  cabe: boolean; // cabe em uma folha A4
  escala: Escala;
  faltando: string[];
  semCampoObservacoes: boolean;
};

/**
 * Gera o PDF de cada O.S. e ajusta até caber em uma folha.
 * Se nem no último nível couber, devolve a versão do último nível com `cabe: false`
 * (nunca corta texto).
 */
export async function gerarComAjuste(lista: OSParaGerar[], fonteMinimaPt = 7): Promise<OSGerada[]> {
  const resultado: (OSGerada | null)[] = lista.map(() => null);
  let pendentes = lista.map((_, i) => i);

  for (let n = 0; n < NIVEIS_AJUSTE.length && pendentes.length; n++) {
    const escala = NIVEIS_AJUSTE[n];
    const preenchidos = await Promise.all(
      pendentes.map((i) => preencherModelo(lista[i].modelo, lista[i].campos, lista[i].dados, { escala, fonteMinimaPt })),
    );
    const pdfs = await converterParaPdf(preenchidos.map((p) => p.docx));
    const ultimos = n === NIVEIS_AJUSTE.length - 1;
    const proximos: number[] = [];
    for (let k = 0; k < pendentes.length; k++) {
      const paginas = await contarPaginas(pdfs[k]);
      const cabe = paginas <= 1;
      if (cabe || ultimos) {
        const p = preenchidos[k];
        resultado[pendentes[k]] = { docx: p.docx, pdf: pdfs[k], paginas, cabe, escala, faltando: p.faltando, semCampoObservacoes: p.semCampoObservacoes };
      } else proximos.push(pendentes[k]);
    }
    pendentes = proximos;
  }
  return resultado as OSGerada[];
}

/** Junta vários PDFs em um só (uma O.S. por folha). */
export async function juntarPdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const final = await PDFDocument.create();
  for (const b of pdfs) {
    const doc = await PDFDocument.load(b);
    const paginas = await final.copyPages(doc, doc.getPageIndices());
    paginas.forEach((p) => final.addPage(p));
  }
  return final.save();
}

/** Texto curto que a prévia mostra sobre o ajuste aplicado. */
export function descreverAjuste(g: Pick<OSGerada, "escala" | "cabe">): string {
  if (!g.cabe) return "Não coube em uma folha mesmo com a menor fonte permitida. Encurte as observações.";
  if (g.escala.fonte === 1 && g.escala.espaco === 1) return "A4 · fonte normal";
  if (g.escala.fonte === 1) return "A4 · espaçamento reduzido";
  return `A4 · fonte reduzida para ${Math.round(g.escala.fonte * 100)}%`;
}
