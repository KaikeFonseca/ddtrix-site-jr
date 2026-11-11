// Interpretador de agendas do WhatsApp por regras (sem IA).
// Princípio: nunca inventar. O que não for encontrado fica null e vira pendência.
import { doisDigitos, limparLinha, normalizar } from "./texto";

export type Categoria = "caixas" | "dedet" | "desr";

export type Modalidade = {
  categoria: Categoria;
  nome: string;
  sufixo: string;
  palavras: string[]; // já normalizadas ou não; são normalizadas na comparação
};

export type Pagamento = {
  forma: string | null; // "Pix", "Dinheiro", "Cartão de débito", "Cartão"...
  valor: string | null; // "R$ 450"
  maquininha: boolean; // cartão: LEVAR A MAQUININHA
};

export type Campo = "cliente" | "telefone" | "data" | "hora" | "servico" | "rua" | "bairro" | "cidade" | "pagamento";

export type Atendimento = {
  indice: number;
  cliente: string | null;
  telefone: string | null;
  data: string | null; // dd/mm/aaaa
  hora: string | null; // HH:MM ou texto vago ("Tarde")
  servico: string | null; // texto exato da agenda
  categoria: Categoria | null;
  sufixo: string | null; // CX, EG, FS, GX, DD, DR
  rua: string | null;
  bairro: string | null;
  cidade: string | null;
  observacoes: string[]; // cada uma inteira, como veio
  pagamento: Pagamento | null;
  origem: Partial<Record<Campo, string>>; // trecho do texto de onde saiu
  pendencias: string[]; // impedem emitir até alguém corrigir ou confirmar
  avisos: string[]; // informação útil, não bloqueia
  textoOriginal: string;
};

export type OpcoesInterpretacao = {
  hoje: { dia: number; mes: number; ano: number }; // data de hoje em America/Sao_Paulo
  cidadePadrao?: string;
  modalidades?: Modalidade[];
};

export const MODALIDADES_PADRAO: Modalidade[] = [
  { categoria: "dedet", nome: "Dedetização", sufixo: "DD", palavras: ["dedetizacao", "dedetizar", "dedetiza", "escorpiao", "barata", "cupim", "formiga", "aranha", "pulga", "carrapato", "percevejo", "mosquito", "traca"] },
  { categoria: "desr", nome: "Desratização", sufixo: "DR", palavras: ["desratizacao", "desratizar", "rato", "ratos", "roedor", "roedores", "ratazana"] },
  { categoria: "caixas", nome: "Caixa de gordura", sufixo: "GX", palavras: ["gordura"] },
  { categoria: "caixas", nome: "Caixa de esgoto", sufixo: "EG", palavras: ["esgoto"] },
  { categoria: "caixas", nome: "Fossa", sufixo: "FS", palavras: ["fossa"] },
  { categoria: "caixas", nome: "Caixa d'água", sufixo: "CX", palavras: ["caixa d agua", "caixa dagua", "caixa de agua", "caixas d agua", "reservatorio", "caixa agua"] },
];

// ---------------------------------------------------------------- rótulos

type Rotulo = "data" | "cliente" | "servico" | "local" | "hora" | "nota" | "preco" | "telefone" | "referencia" | "bairro" | "cidade";

const ROTULOS: [RegExp, Rotulo][] = [
  [/^data( do servico| de execucao)?$/, "data"],
  [/^(cliente|nome|nome do cliente)$/, "cliente"],
  [/^(servico|servicos|tipo|tipo de servico)$/, "servico"],
  [/^(local|endereco|end|localizacao)$/, "local"],
  [/^(horario aproximado|horario|hora|hr|hrs)$/, "hora"],
  [/^(nota|notas|obs|observacao|observacoes|atencao|importante)$/, "nota"],
  [/^(preco|valor|pagamento|forma de pagamento|pgto)$/, "preco"],
  [/^(telefone|tel|fone|contato|celular|whatsapp|whats|zap)$/, "telefone"],
  [/^(referencia|ref|ponto de referencia)$/, "referencia"],
  [/^bairro$/, "bairro"],
  [/^cidade$/, "cidade"],
];

function lerRotulo(linha: string): { rotulo: Rotulo; valor: string } | null {
  const m = linha.match(/^([^:]{1,30}):\s*(.*)$/);
  if (!m) return null;
  const chave = normalizar(m[1]);
  for (const [re, rotulo] of ROTULOS) if (re.test(chave)) return { rotulo, valor: m[2].trim() };
  return null;
}

// Prefixos de exportação/cópia do WhatsApp: "[11/11 08:32] Eduarda: ..." ou "11/11/2026 08:32 - Eduarda: ..."
function tirarPrefixoWhatsApp(linha: string): string {
  return linha
    .replace(/^\[[^\]]{3,40}\]\s*[^:]{1,40}:\s*/, "")
    .replace(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*-\s*[^:]{1,40}:\s*/, "");
}

// ---------------------------------------------------------------- datas e horários

const DIAS_SEMANA = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function formatarData(d: Date): string {
  return `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function lerData(texto: string, hoje: OpcoesInterpretacao["hoje"]): string | null {
  const m = texto.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
  if (m) {
    const dia = +m[1];
    const mes = +m[2];
    let ano = m[3] ? +m[3] : hoje.ano;
    if (m[3] && m[3].length === 2) ano = 2000 + ano;
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    return `${doisDigitos(dia)}/${doisDigitos(mes)}/${ano}`;
  }
  const n = normalizar(texto);
  const base = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia));
  if (/\bhoje\b/.test(n)) return formatarData(base);
  if (/\bdepois de amanha\b/.test(n)) return formatarData(new Date(base.getTime() + 2 * 86400000));
  if (/\bamanha\b/.test(n)) return formatarData(new Date(base.getTime() + 86400000));
  const idx = DIAS_SEMANA.findIndex((d) => new RegExp(`\\b${d}`).test(n));
  if (idx >= 0) {
    const diff = (idx - base.getUTCDay() + 7) % 7;
    return formatarData(new Date(base.getTime() + diff * 86400000));
  }
  return null;
}

export function lerHora(texto: string): { hora: string | null; vaga: boolean } {
  const t = texto.trim();
  const m = t.match(/(\d{1,2})\s*(?:[:hH]\s*(\d{2}))?\s*(?:h|hs|hrs?|horas?)?(?![\d/])/i);
  if (m) {
    const h = +m[1];
    const min = m[2] ? +m[2] : 0;
    if (h <= 23 && min <= 59) return { hora: `${doisDigitos(h)}:${doisDigitos(min)}`, vaga: false };
  }
  const n = normalizar(t);
  if (/manha|tarde|noite|comercial|qualquer/.test(n)) {
    // Período vago: mantém o texto como veio (sem emojis) e sinaliza.
    return { hora: limparLinha(t), vaga: true };
  }
  return { hora: null, vaga: false };
}

// ---------------------------------------------------------------- serviço

export function classificarServico(
  servico: string,
  modalidades: Modalidade[] = MODALIDADES_PADRAO,
): { categoria: Categoria; sufixo: string } | null {
  const n = ` ${normalizar(servico)} `;
  const acha = (m: Modalidade) => {
    let melhor = -1;
    for (const p of m.palavras) {
      const i = n.indexOf(` ${normalizar(p)}`);
      if (i >= 0 && (melhor < 0 || i < melhor)) melhor = i;
    }
    return melhor;
  };
  // "Dedetização/Desratização" é dedetização: dedet tem prioridade, depois desr, depois caixas.
  for (const cat of ["dedet", "desr"] as const) {
    const m = modalidades.find((x) => x.categoria === cat && acha(x) >= 0);
    if (m) return { categoria: cat, sufixo: m.sufixo };
  }
  const caixas = modalidades
    .filter((x) => x.categoria === "caixas")
    .map((x) => ({ x, i: acha(x) }))
    .filter((r) => r.i >= 0)
    .sort((a, b) => a.i - b.i);
  if (caixas.length) return { categoria: "caixas", sufixo: caixas[0].x.sufixo };
  if (/\bcaixa\b/.test(n)) {
    const agua = modalidades.find((x) => x.categoria === "caixas" && x.sufixo === "CX");
    if (agua) return { categoria: "caixas", sufixo: agua.sufixo };
  }
  return null;
}

// ---------------------------------------------------------------- pagamento

export function lerPagamento(texto: string): Pagamento {
  const n = normalizar(texto);
  let forma: string | null = null;
  if (/\bpix\b/.test(n)) forma = "Pix";
  else if (/\bdebito\b/.test(n)) forma = "Cartão de débito";
  else if (/\bcredito\b/.test(n)) forma = "Cartão de crédito";
  else if (/\bcartao\b|\bcartoes\b/.test(n)) forma = "Cartão";
  else if (/\bdinheiro\b|\bespecie\b/.test(n)) forma = "Dinheiro";
  else if (/\bboleto\b/.test(n)) forma = "Boleto";
  else if (/\btransferencia\b|\bted\b|\bdeposito\b/.test(n)) forma = "Transferência";
  else if (/\bcontrato\b/.test(n)) forma = "Contrato";

  let valor: string | null = null;
  const v = texto.match(/R\$\s*([\d.]+(?:,\d{2})?)/i) ?? texto.match(/(\d[\d.]*(?:,\d{2})?)\s*(?:reais|real)\b/i);
  if (v) valor = `R$ ${v[1]}`;

  return { forma, valor, maquininha: forma !== null && forma.startsWith("Cartão") };
}

export function textoPagamento(p: Pagamento): string | null {
  if (!p.forma) return null; // sem forma informada, nada é escrito
  return [`Pagamento: ${p.forma}`, p.valor].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------- endereço

const ABREVIACOES = new Set([
  "av", "r", "al", "trav", "tv", "est", "rod", "pq", "pque", "jd", "jdm", "vl", "lot", "res", "cond", "n", "no", "nº",
  "dr", "dra", "prof", "profa", "sta", "sto", "s", "cel", "gal", "eng", "sr", "sra", "ap", "apto", "bl", "cj", "q",
  "qd", "lt", "km", "ref", "pres", "mal", "cap", "ten", "sgt", "dom", "pe", "fr", "vila", "c",
]);

/** Separa o endereço (primeira frase) do resto (referências, instruções), sem perder texto. */
function separarFrases(texto: string): { endereco: string; resto: string } {
  const re = /\.\s+(?=\S)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const antes = texto.slice(0, m.index);
    const palavra = normalizar(antes.split(/\s+/).pop() ?? "");
    if (ABREVIACOES.has(palavra) || palavra.length <= 1) continue;
    return { endereco: antes.trim(), resto: texto.slice(m.index + 1).trim() };
  }
  return { endereco: texto.replace(/\.$/, "").trim(), resto: "" };
}

function comUF(cidade: string): string {
  return /\/\s*[A-Za-z]{2}$/.test(cidade) || /\s-\s*[A-Za-z]{2}$/.test(cidade) ? cidade : `${cidade}/SP`;
}

export function lerEndereco(
  texto: string,
  cidadePadrao: string,
): { rua: string | null; bairro: string | null; cidade: string | null; cidadeDaAgenda: boolean; resto: string; temNumero: boolean } {
  const { endereco, resto } = separarFrases(texto.trim());
  const partes = endereco.split(/\s*[,;]\s*|\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  const ehNumero = (p: string) => /^(n[º°o]?\.?\s*)?(\d+[A-Za-z]?|s\/?n)$/i.test(p);

  let idx = partes.findIndex((p, i) => i > 0 && ehNumero(p));
  if (idx < 0 && partes.length) {
    const m = partes[0].match(/^(.*\D)\s+(?:n[º°o]?\.?\s*)?(\d+[A-Za-z]?)$/i);
    if (m) {
      partes.splice(0, 1, m[1].trim(), m[2]);
      idx = 1;
    }
  }

  if (idx < 0) {
    return { rua: endereco || null, bairro: null, cidade: cidadePadrao, cidadeDaAgenda: false, resto, temNumero: false };
  }

  const numero = partes[idx].replace(/^n[º°o]?\.?\s*/i, "");
  const rua = `${partes.slice(0, idx).join(", ")}, ${numero}`;
  const depois = partes.slice(idx + 1).filter((p) => !/^cep\b|^\d{5}-?\d{3}$/i.test(p));
  let bairro: string | null = depois[0] ?? null;
  let cidade: string | null = depois[1] ?? null;
  // "Rua X, 10, Sorocaba" sem bairro: a única parte é a cidade padrão
  if (bairro && !cidade && normalizar(bairro) === normalizar(cidadePadrao.split("/")[0])) {
    cidade = bairro;
    bairro = null;
  }
  const cidadeDaAgenda = cidade !== null;
  return { rua, bairro, cidade: cidade ? comUF(cidade) : cidadePadrao, cidadeDaAgenda, resto, temNumero: true };
}

// ---------------------------------------------------------------- blocos

type Linha = { rotulo: Rotulo | null; valor: string; bruta: string };

function separarBlocos(texto: string): { cabecalho: string[]; blocos: string[][] } {
  const linhas = texto.replace(/\r/g, "").split("\n").map(tirarPrefixoWhatsApp);
  const numeradas = linhas.filter((l) => /^\s*\d{1,2}\s*[.)](?!\d)/.test(l)).length;
  const cabecalho: string[] = [];
  const blocos: string[][] = [];
  let atual: string[] | null = null;
  let vistos = new Set<Rotulo>();

  for (const bruta of linhas) {
    if (!bruta.trim()) continue;
    const num = bruta.match(/^\s*\d{1,2}\s*[.)](?!\d)\s*(.*)$/);
    if (numeradas > 0 && num) {
      atual = [];
      blocos.push(atual);
      vistos = new Set();
      if (num[1].trim()) atual.push(num[1]);
      continue;
    }
    const rot = lerRotulo(limparLinha(bruta));
    if (numeradas === 0 && rot && (rot.rotulo === "cliente" || rot.rotulo === "data") && vistos.has(rot.rotulo)) {
      atual = null; // rótulo repetido sem numeração: começa outro atendimento
    }
    if (!atual) {
      if (!rot && blocos.length === 0) {
        cabecalho.push(bruta);
        continue;
      }
      atual = [];
      blocos.push(atual);
      vistos = new Set();
    }
    if (rot) vistos.add(rot.rotulo);
    atual.push(bruta);
  }
  return { cabecalho, blocos: blocos.filter((b) => b.length > 0) };
}

// ---------------------------------------------------------------- principal

export function interpretarAgenda(texto: string, opcoes: OpcoesInterpretacao): Atendimento[] {
  const cidadePadrao = opcoes.cidadePadrao ?? "Sorocaba/SP";
  const modalidades = opcoes.modalidades ?? MODALIDADES_PADRAO;
  const { cabecalho, blocos } = separarBlocos(texto);

  const linhaData = cabecalho.find((l) => /\d{1,2}\/\d{1,2}/.test(l) || /agenda/i.test(l));
  const dataCabecalho = linhaData ? lerData(limparLinha(linhaData), opcoes.hoje) : null;

  return blocos.map((bloco, i) => {
    const linhas: Linha[] = [];
    for (const bruta of bloco) {
      const limpa = limparLinha(bruta);
      if (!limpa) continue;
      const rot = lerRotulo(limpa);
      if (rot) linhas.push({ rotulo: rot.rotulo, valor: rot.valor, bruta: limpa });
      else if (linhas.length && ["nota", "local", "referencia", "servico", "preco"].includes(linhas[linhas.length - 1].rotulo ?? "")) {
        // continuação da linha anterior (texto quebrado em várias linhas)
        linhas[linhas.length - 1].valor += ` ${limpa}`;
      } else linhas.push({ rotulo: null, valor: limpa, bruta: limpa });
    }

    const a: Atendimento = {
      indice: i + 1,
      cliente: null,
      telefone: null,
      data: null,
      hora: null,
      servico: null,
      categoria: null,
      sufixo: null,
      rua: null,
      bairro: null,
      cidade: null,
      observacoes: [],
      pagamento: null,
      origem: {},
      pendencias: [],
      avisos: [],
      textoOriginal: bloco.join("\n"),
    };

    const valoresDe = (r: Rotulo) => linhas.filter((l) => l.rotulo === r).map((l) => l.valor).filter(Boolean);
    const unico = (r: Rotulo, nome: string): string | null => {
      const v = [...new Set(valoresDe(r))];
      if (v.length > 1) a.pendencias.push(`A agenda tem ${nome} diferentes: ${v.map((x) => `"${x}"`).join(" e ")}. Escolha o certo.`);
      return v[0] ?? null;
    };

    // Cliente
    const cliente = unico("cliente", "clientes");
    if (cliente) {
      let nome = cliente;
      const fone = nome.match(/(\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4})/);
      if (fone) {
        a.telefone = fone[1].trim();
        a.origem.telefone = cliente;
        nome = nome.replace(fone[1], "").replace(/[\s\-–,]+$/, "").trim();
      }
      a.cliente = nome;
      a.origem.cliente = cliente;
      if (/\d/.test(nome)) a.pendencias.push(`Confira o nome do cliente: "${nome}" tem números.`);
    } else a.pendencias.push("Nome do cliente não encontrado.");

    // Telefone
    const tel = unico("telefone", "telefones");
    if (tel) {
      a.telefone = tel;
      a.origem.telefone = tel;
    }

    // Data
    const dataTexto = unico("data", "datas");
    if (dataTexto) {
      a.data = lerData(dataTexto, opcoes.hoje);
      a.origem.data = dataTexto;
      if (!a.data) a.pendencias.push(`Não entendi a data "${dataTexto}".`);
    } else if (dataCabecalho) {
      a.data = dataCabecalho;
      a.origem.data = limparLinha(linhaData ?? "");
      a.avisos.push("Data tirada do título da agenda.");
    } else a.pendencias.push("Data não encontrada.");

    // Horário
    const horaTexto = unico("hora", "horários");
    if (horaTexto) {
      const { hora, vaga } = lerHora(horaTexto);
      a.hora = hora;
      a.origem.hora = horaTexto;
      if (!hora) a.pendencias.push(`Não entendi o horário "${horaTexto}".`);
      else if (vaga) a.avisos.push(`Horário vago ("${hora}"). Vai assim na O.S.`);
    } else a.pendencias.push("Horário não encontrado.");

    // Serviço
    const servico = unico("servico", "serviços");
    if (servico) {
      a.servico = servico;
      a.origem.servico = servico;
      const c = classificarServico(servico, modalidades);
      if (c) {
        a.categoria = c.categoria;
        a.sufixo = c.sufixo;
      } else a.pendencias.push(`Não consegui saber se "${servico}" é caixa, dedetização ou desratização. Escolha a categoria.`);
    } else a.pendencias.push("Serviço não encontrado.");

    // Endereço
    const local = unico("local", "endereços");
    if (local) {
      const e = lerEndereco(local, cidadePadrao);
      a.rua = e.rua;
      a.bairro = e.bairro;
      a.cidade = e.cidade;
      a.origem.rua = local;
      a.origem.bairro = local;
      a.origem.cidade = e.cidadeDaAgenda ? local : "Cidade padrão";
      if (e.resto) a.observacoes.push(e.resto);
      if (!e.temNumero) a.pendencias.push("Confira o endereço: não achei o número.");
      if (!e.bairro) a.pendencias.push("Bairro não encontrado.");
    } else a.pendencias.push("Endereço não encontrado.");
    const bairro = unico("bairro", "bairros");
    if (bairro) {
      a.bairro = bairro;
      a.origem.bairro = bairro;
      a.pendencias = a.pendencias.filter((p) => p !== "Bairro não encontrado.");
    }
    const cidade = unico("cidade", "cidades");
    if (cidade) {
      a.cidade = comUF(cidade);
      a.origem.cidade = cidade;
    }

    // Referência, notas e linhas sem rótulo vão inteiras para as observações
    for (const r of valoresDe("referencia")) a.observacoes.push(`Referência: ${r}`);
    for (const n of valoresDe("nota")) a.observacoes.push(n);
    const soltas = linhas.filter((l) => l.rotulo === null).map((l) => l.valor);
    if (soltas.length) {
      a.observacoes.push(...soltas);
      a.avisos.push("Algumas linhas não tinham rótulo e foram para as observações. Confira.");
    }

    // Pagamento
    const preco = valoresDe("preco").join(" ");
    if (preco) {
      a.pagamento = lerPagamento(preco);
      a.origem.pagamento = preco;
      if (!a.pagamento.forma) a.avisos.push("A agenda tem valor mas não diz a forma de pagamento. Nada sobre pagamento vai na O.S.");
    }

    return a;
  });
}
