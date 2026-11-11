// Motor de preenchimento dos modelos .docx, portado do protótipo (gerador-os-ddtrix.html).
// Cada campo é achado pelo texto de exemplo do modelo e pela ocorrência (n-ésima vez).
// As posições são achadas no documento original antes de qualquer troca e aplicadas de trás
// para frente, para um valor novo nunca ser confundido com o exemplo de outro campo.
import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Document as XDoc, type Element as XEl } from "@xmldom/xmldom";
import type { Pagamento } from "./agenda";
import { normalizar } from "./texto";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type CampoModelo = { k: string; s: string; n: number };

export type DadosOS = {
  validade?: string;
  osnum?: string;
  data?: string;
  hora?: string;
  cliente?: string;
  rua?: string;
  bairro?: string;
  cidade?: string;
  servico?: string;
  observacoes?: string[];
  pagamento?: Pagamento | null;
};

export type Escala = { fonte: number; espaco: number };

export type OpcoesPreenchimento = {
  escala?: Escala;
  fonteMinimaPt?: number; // piso de legibilidade (padrão 7 pt)
  marcadorObservacoes?: string; // texto do campo de observações no modelo
};

export type ResultadoPreenchimento = { docx: Uint8Array; faltando: string[]; semCampoObservacoes: boolean };

const els = (n: XDoc | XEl, tag: string) => Array.from(n.getElementsByTagName(tag)) as XEl[];

/** Endereço completo em linha contínua (bloco de serviço). */
export function enderecoCompleto(d: DadosOS): string {
  return [d.rua, d.bairro, d.cidade].filter((x) => x && x.trim()).join(" - ");
}

function trocarCampos(doc: XDoc, campos: CampoModelo[], valores: Record<string, string | undefined>): string[] {
  const paragrafos = els(doc, "w:p").map((p) => {
    const t = els(p, "w:t");
    return { t, s: t.map((x) => x.textContent ?? "").join("") };
  });
  const trocas: { i: number; j: number; len: number; v: string }[] = [];
  const faltando: string[] = [];

  for (const f of campos) {
    const v = valores[f.k];
    if (v === undefined) continue;
    if (v === f.s) continue;
    let c = 0;
    let achou: (typeof trocas)[number] | null = null;
    for (let i = 0; i < paragrafos.length && !achou; i++) {
      let j = -1;
      while ((j = paragrafos[i].s.indexOf(f.s, j + 1)) >= 0) {
        if (++c === f.n) {
          achou = { i, j, len: f.s.length, v };
          break;
        }
      }
    }
    if (achou) trocas.push(achou);
    else faltando.push(f.k);
  }

  trocas.sort((a, b) => b.i - a.i || b.j - a.j);
  for (const o of trocas) {
    const p = paragrafos[o.i];
    let pos = 0;
    let primeiro = true;
    const fim = o.j + o.len;
    for (const n of p.t) {
      const s = n.textContent ?? "";
      const a = pos;
      const e = pos + s.length;
      pos = e;
      if (e <= o.j || a >= fim) continue;
      n.textContent = primeiro ? s.slice(0, o.j - a) + o.v + (fim < e ? s.slice(fim - a) : "") : fim < e ? s.slice(fim - a) : "";
      n.setAttribute("xml:space", "preserve");
      primeiro = false;
    }
  }
  return faltando;
}

// ---------------------------------------------------------------- observações e pagamento

function criarRun(doc: XDoc, texto: string, opcoes: { negrito?: boolean; cor?: string; realce?: boolean } = {}): XEl {
  const r = doc.createElementNS(W, "w:r");
  const rPr = doc.createElementNS(W, "w:rPr");
  const fonts = doc.createElementNS(W, "w:rFonts");
  for (const a of ["w:ascii", "w:eastAsia", "w:hAnsi", "w:cs"]) fonts.setAttributeNS(W, a, "Arial");
  rPr.appendChild(fonts);
  if (opcoes.negrito) {
    rPr.appendChild(doc.createElementNS(W, "w:b"));
    rPr.appendChild(doc.createElementNS(W, "w:bCs"));
  }
  const cor = doc.createElementNS(W, "w:color");
  cor.setAttributeNS(W, "w:val", opcoes.cor ?? "0F243E");
  rPr.appendChild(cor);
  for (const tag of ["w:sz", "w:szCs"]) {
    const sz = doc.createElementNS(W, tag);
    sz.setAttributeNS(W, "w:val", "20");
    rPr.appendChild(sz);
  }
  if (opcoes.realce) {
    const h = doc.createElementNS(W, "w:highlight");
    h.setAttributeNS(W, "w:val", "yellow");
    rPr.appendChild(h);
  }
  r.appendChild(rPr);
  texto.split("\n").forEach((linha, i) => {
    if (i > 0) r.appendChild(doc.createElementNS(W, "w:br"));
    const t = doc.createElementNS(W, "w:t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = linha;
    r.appendChild(t);
  });
  return r;
}

function novoParagrafoComo(doc: XDoc, modelo: XEl): XEl {
  const p = doc.createElementNS(W, "w:p");
  const pPr = els(modelo, "w:pPr")[0];
  if (pPr) p.appendChild(pPr.cloneNode(true));
  return p;
}

function inserirObservacoes(doc: XDoc, marcador: string, observacoes: string[], pagamento: Pagamento | null | undefined): boolean {
  const alvo = normalizar(marcador);
  const p = els(doc, "w:p").find((x) => normalizar(els(x, "w:t").map((t) => t.textContent ?? "").join("")).startsWith(alvo));
  if (!p) return false;
  const obs = observacoes.map((o) => o.trim()).filter(Boolean);
  let ultimo: XEl = p;
  obs.forEach((o, i) => {
    if (i === 0) {
      p.appendChild(criarRun(doc, ` ${o}`));
      return;
    }
    const np = novoParagrafoComo(doc, p);
    np.appendChild(criarRun(doc, o));
    ultimo.parentNode!.insertBefore(np, ultimo.nextSibling);
    ultimo = np;
  });
  if (pagamento?.forma) {
    const np = novoParagrafoComo(doc, p);
    const texto = [`Pagamento: ${pagamento.forma}`, pagamento.valor].filter(Boolean).join(" · ");
    np.appendChild(criarRun(doc, texto, { realce: true }));
    if (pagamento.maquininha) {
      np.appendChild(criarRun(doc, " · ", { realce: true }));
      np.appendChild(criarRun(doc, "LEVAR A MAQUININHA", { negrito: true, cor: "FF0000", realce: true }));
    }
    ultimo.parentNode!.insertBefore(np, ultimo.nextSibling);
  }
  return true;
}

// ---------------------------------------------------------------- ajuste para A4

function aplicarEscala(doc: XDoc, escala: Escala, fonteMinimaPt: number) {
  const piso = Math.round(fonteMinimaPt * 2); // w:sz é em meio-ponto
  if (escala.fonte !== 1) {
    for (const tag of ["w:sz", "w:szCs"]) {
      for (const e of els(doc, tag)) {
        const v = Number(e.getAttribute("w:val"));
        if (!v || v <= piso) continue;
        e.setAttribute("w:val", String(Math.max(piso, Math.round(v * escala.fonte))));
      }
    }
  }
  if (escala.espaco !== 1) {
    for (const e of els(doc, "w:spacing")) {
      for (const a of ["w:before", "w:after"]) {
        const v = Number(e.getAttribute(a));
        if (v) e.setAttribute(a, String(Math.round(v * escala.espaco)));
      }
      if (e.getAttribute("w:lineRule") === "auto") {
        const v = Number(e.getAttribute("w:line"));
        if (v > 200) e.setAttribute("w:line", String(Math.max(200, Math.round(v * (0.5 + escala.espaco / 2)))));
      }
    }
    for (const e of els(doc, "w:trHeight")) {
      const v = Number(e.getAttribute("w:val"));
      if (v) e.setAttribute("w:val", String(Math.round(v * escala.espaco)));
    }
  }
}

// ---------------------------------------------------------------- principal

export async function preencherModelo(
  modelo: Uint8Array,
  campos: CampoModelo[],
  dados: DadosOS,
  opcoes: OpcoesPreenchimento = {},
): Promise<ResultadoPreenchimento> {
  const zip = await JSZip.loadAsync(modelo);
  const arquivo = zip.file("word/document.xml");
  if (!arquivo) throw new Error("O arquivo não é um modelo .docx válido.");
  const xml = await arquivo.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  const valores: Record<string, string | undefined> = {
    validade: dados.validade,
    osnum: dados.osnum,
    data: dados.data,
    hora: dados.hora,
    cliente: dados.cliente,
    rua: dados.rua,
    bairro: dados.bairro,
    cidade: dados.cidade,
    servico: dados.servico,
    endfull: dados.rua !== undefined ? enderecoCompleto(dados) : undefined,
  };
  const faltando = trocarCampos(doc, campos, valores);

  let semCampoObservacoes = false;
  if ((dados.observacoes?.length ?? 0) > 0 || dados.pagamento?.forma) {
    semCampoObservacoes = !inserirObservacoes(doc, opcoes.marcadorObservacoes ?? "Observações", dados.observacoes ?? [], dados.pagamento);
  }

  if (opcoes.escala) aplicarEscala(doc, opcoes.escala, opcoes.fonteMinimaPt ?? 7);

  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  const docx = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { docx, faltando, semCampoObservacoes };
}

/** Texto de cada parágrafo do documento (usado nos testes e na conferência de modelos). */
export async function textoDosParagrafos(docx: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file("word/document.xml")!.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return els(doc, "w:p").map((p) => els(p, "w:t").map((t) => t.textContent ?? "").join(""));
}

export async function xmlDoDocumento(docx: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  return zip.file("word/document.xml")!.async("string");
}
