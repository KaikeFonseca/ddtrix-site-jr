// Área administrativa: modelos versionados, categorias e modalidades, configurações
// (especificação, seções 13 e 14). Trocar o modelo nunca exige reprogramar o sistema.
import JSZip from "jszip";
import { sql } from "./db";
import { registrarAuditoria } from "./auditoria";
import type { Categoria } from "./os/agenda";
import { textoDosParagrafos, type CampoModelo, type DadosOS } from "./os/docx";
import { descreverAjuste, gerarComAjuste } from "./os/pdf";
import { configuracoesOS, ErroDeUso, pdfParaPng } from "./os/servico";
import { NOMES_CAMPOS } from "./nomes-campos";

// ---------------------------------------------------------------- modelos

export type VersaoModelo = {
  id: string;
  numero: number;
  oficial: boolean;
  notas: string | null;
  criadoEm: Date;
  criadoPor: string | null;
  campos: CampoModelo[];
  usadaEm: number; // quantas O.S. emitidas usaram esta versão
};

export type Modelo = { id: string; categoria: Categoria; nome: string; versoes: VersaoModelo[] };

export { NOMES_CAMPOS };

export async function listarModelos(): Promise<Modelo[]> {
  const modelos = await sql<{ id: string; categoria: Categoria; nome: string }[]>`select id, categoria, nome from modelos order by categoria`;
  const versoes = await sql<{ id: string; modelo_id: string; numero: number; oficial: boolean; notas: string | null; criado_em: Date; criado_por: string | null; campos: CampoModelo[]; usada_em: number }[]>`
    select v.id, v.modelo_id, v.numero, v.oficial, v.notas, v.criado_em, v.criado_por, v.campos,
      (select count(*)::int from ordens o where o.modelo_versao_id = v.id) as usada_em
    from modelo_versoes v order by v.numero desc`;
  return modelos.map((m) => ({
    ...m,
    versoes: versoes
      .filter((v) => v.modelo_id === m.id)
      .map((v) => ({ id: v.id, numero: v.numero, oficial: v.oficial, notas: v.notas, criadoEm: v.criado_em, criadoPor: v.criado_por, campos: v.campos, usadaEm: v.usada_em })),
  }));
}

async function versao(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroDeUso("Versão não encontrada.");
  const [v] = await sql<{ id: string; modelo_id: string; numero: number; oficial: boolean; arquivo: Buffer; campos: CampoModelo[]; categoria: Categoria; nome: string }[]>`
    select v.id, v.modelo_id, v.numero, v.oficial, v.arquivo, v.campos, m.categoria, m.nome
    from modelo_versoes v join modelos m on m.id = v.modelo_id where v.id = ${id}`;
  if (!v?.arquivo) throw new ErroDeUso("Versão não encontrada.");
  return { ...v, arquivo: new Uint8Array(v.arquivo) };
}

export async function arquivoDaVersao(id: string): Promise<{ arquivo: Uint8Array; nome: string }> {
  const v = await versao(id);
  return { arquivo: v.arquivo, nome: `${v.nome.replace(/[^\p{L}\p{N}]+/gu, "_")}_v${v.numero}.docx` };
}

export type ConferenciaCampo = CampoModelo & { encontrado: boolean; vezes: number };

/** Procura o texto de exemplo de cada campo no modelo, como o motor de preenchimento faz. */
export async function conferirCampos(arquivo: Uint8Array, campos: CampoModelo[]): Promise<ConferenciaCampo[]> {
  const paragrafos = await textoDosParagrafos(arquivo);
  return campos.map((c) => {
    let vezes = 0;
    if (c.s) {
      for (const p of paragrafos) {
        let j = -1;
        while ((j = p.indexOf(c.s, j + 1)) >= 0) vezes++;
      }
    }
    return { ...c, vezes, encontrado: !!c.s && vezes >= c.n };
  });
}

export async function conferirVersao(id: string): Promise<ConferenciaCampo[]> {
  const v = await versao(id);
  return conferirCampos(v.arquivo, v.campos);
}

async function validarDocx(arquivo: Uint8Array): Promise<void> {
  if (arquivo.length > 15 * 1024 * 1024) throw new ErroDeUso("O arquivo passa de 15 MB.");
  try {
    const zip = await JSZip.loadAsync(arquivo);
    if (!zip.file("word/document.xml")) throw new Error();
  } catch {
    throw new ErroDeUso("Esse arquivo não é um .docx do Word. Salve o modelo como .docx e tente de novo.");
  }
}

/** Importa uma versão nova. Copia o mapeamento da versão oficial como ponto de partida. */
export async function importarVersao(modeloId: string, arquivo: Uint8Array, notas: string | null, quem: string | null): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(modeloId)) throw new ErroDeUso("Modelo não encontrado.");
  await validarDocx(arquivo);
  return sql.begin(async (tx) => {
    const [m] = await tx<{ id: string }[]>`select id from modelos where id = ${modeloId} for update`;
    if (!m) throw new ErroDeUso("Modelo não encontrado.");
    const [base] = await tx<{ campos: CampoModelo[] }[]>`
      select campos from modelo_versoes where modelo_id = ${modeloId} order by oficial desc, numero desc limit 1`;
    const [{ proximo }] = await tx<{ proximo: number }[]>`select coalesce(max(numero), 0) + 1 as proximo from modelo_versoes where modelo_id = ${modeloId}`;
    const [{ id }] = await tx<{ id: string }[]>`
      insert into modelo_versoes (modelo_id, numero, arquivo, campos, oficial, notas, criado_por)
      values (${modeloId}, ${proximo}, ${Buffer.from(arquivo)}, ${tx.json((base?.campos ?? []) as never)}, false, ${notas?.trim() || null}, ${quem})
      returning id`;
    await registrarAuditoria({ quem, acao: "importar", entidade: "modelo_versao", entidadeId: id, depois: { modeloId, numero: proximo, notas } }, tx);
    return id;
  });
}

/** O mapeamento só muda em versões que ainda não são oficiais e nunca foram usadas. */
export async function salvarCampos(id: string, campos: CampoModelo[], quem: string | null): Promise<void> {
  const v = await versao(id);
  if (v.oficial) throw new ErroDeUso("Esta versão é a oficial. Para mudar os campos, importe uma versão nova.");
  const [{ usada }] = await sql<{ usada: number }[]>`select count(*)::int as usada from ordens where modelo_versao_id = ${id}`;
  if (usada) throw new ErroDeUso("Esta versão já foi usada em O.S. emitidas e não pode mudar.");
  const limpos = campos.map((c) => ({ k: c.k, s: c.s, n: Math.max(1, Math.floor(c.n || 1)) }));
  await sql.begin(async (tx) => {
    await tx`update modelo_versoes set campos = ${tx.json(limpos as never)} where id = ${id}`;
    await registrarAuditoria({ quem, acao: "alterar", entidade: "modelo_versao", entidadeId: id, antes: { campos: v.campos }, depois: { campos: limpos } }, tx);
  });
}

/** Marca como oficial (também serve para voltar a uma versão antiga). Exige todos os campos encontrados. */
export async function tornarOficial(id: string, quem: string | null): Promise<void> {
  const v = await versao(id);
  if (v.oficial) return;
  const faltando = (await conferirCampos(v.arquivo, v.campos)).filter((c) => !c.encontrado);
  if (faltando.length) {
    throw new ErroDeUso(`Ainda há campos não encontrados no modelo: ${faltando.map((c) => NOMES_CAMPOS[c.k] ?? c.k).join(", ")}.`);
  }
  await sql.begin(async (tx) => {
    const [anterior] = await tx<{ id: string; numero: number }[]>`select id, numero from modelo_versoes where modelo_id = ${v.modelo_id} and oficial`;
    await tx`update modelo_versoes set oficial = false where modelo_id = ${v.modelo_id} and oficial`;
    await tx`update modelo_versoes set oficial = true where id = ${id}`;
    await registrarAuditoria(
      { quem, acao: "tornar_oficial", entidade: "modelo_versao", entidadeId: id, antes: anterior ? { versaoOficial: anterior.numero } : null, depois: { versaoOficial: v.numero, modelo: v.nome } },
      tx,
    );
  });
}

const DADOS_DE_TESTE: Record<Categoria, DadosOS> = {
  caixas: { osnum: "20260101CX", data: "01/01/2026", hora: "09:00", cliente: "Cliente de Teste", rua: "Rua de Teste, 123", bairro: "Bairro Teste", cidade: "Sorocaba/SP", servico: "Limpeza de caixa d'água (teste)" },
  dedet: { osnum: "20260101DD", data: "01/01/2026", hora: "09:00", cliente: "Cliente de Teste", rua: "Rua de Teste, 123", bairro: "Bairro Teste", cidade: "Sorocaba/SP", servico: "Dedetização (teste)" },
  desr: { osnum: "20260101DR", data: "01/01/2026", hora: "09:00", cliente: "Cliente de Teste", rua: "Rua de Teste, 123", bairro: "Bairro Teste", cidade: "Sorocaba/SP", servico: "Desratização (teste)" },
};

/** Preenche a versão com dados falsos e devolve a imagem da folha. */
export async function testarVersao(id: string): Promise<{ png: Uint8Array; ajuste: string; cabe: boolean; faltando: string[] }> {
  const v = await versao(id);
  const config = await configuracoesOS();
  const dados: DadosOS = {
    ...DADOS_DE_TESTE[v.categoria],
    validade: config.cevsValidade || undefined,
    observacoes: ["Observação de teste: confira se este texto aparece inteiro na parte de observações."],
    pagamento: { forma: "Cartão", valor: "R$ 100,00", maquininha: true },
  };
  const [g] = await gerarComAjuste([{ modelo: v.arquivo, campos: v.campos, dados }], config.fonteMinimaPt);
  return { png: await pdfParaPng(g.pdf), ajuste: descreverAjuste(g), cabe: g.cabe, faltando: g.faltando };
}

// ---------------------------------------------------------------- categorias e modalidades

export type CategoriaAdm = { codigo: Categoria; nome: string; palavras: string[]; ativa: boolean };
export type ModalidadeAdm = { id: string; categoria: Categoria; nome: string; sufixo: string; palavras: string[]; ordem: number; ativa: boolean };

export async function listarCategorias(): Promise<{ categorias: CategoriaAdm[]; modalidades: ModalidadeAdm[] }> {
  const categorias = await sql<{ codigo: Categoria; nome: string; palavras_chave: string[]; ativa: boolean }[]>`
    select codigo, nome, palavras_chave, ativa from categorias_servico order by array_position(array['caixas','dedet','desr'], codigo)`;
  const modalidades = await sql<{ id: string; categoria: Categoria; nome: string; sufixo_os: string; palavras_chave: string[]; ordem: number; ativa: boolean }[]>`
    select id, categoria, nome, sufixo_os, palavras_chave, ordem, ativa from modalidades_servico order by categoria, ordem, nome`;
  return {
    categorias: categorias.map((c) => ({ codigo: c.codigo, nome: c.nome, palavras: c.palavras_chave, ativa: c.ativa })),
    modalidades: modalidades.map((m) => ({ id: m.id, categoria: m.categoria, nome: m.nome, sufixo: m.sufixo_os, palavras: m.palavras_chave, ordem: m.ordem, ativa: m.ativa })),
  };
}

const palavrasLimpas = (p: string[]) => [...new Set(p.map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 60);

export async function alterarCategoria(codigo: Categoria, d: { nome: string; palavras: string[] }, quem: string | null): Promise<void> {
  const nome = d.nome.trim();
  if (!nome) throw new ErroDeUso("O nome da categoria não pode ficar vazio.");
  const [atual] = await sql<{ nome: string; palavras_chave: string[] }[]>`select nome, palavras_chave from categorias_servico where codigo = ${codigo}`;
  if (!atual) throw new ErroDeUso("Categoria não encontrada.");
  const palavras = palavrasLimpas(d.palavras);
  await sql.begin(async (tx) => {
    await tx`update categorias_servico set nome = ${nome}, palavras_chave = ${palavras} where codigo = ${codigo}`;
    await registrarAuditoria({ quem, acao: "alterar", entidade: "categoria", antes: { codigo, nome: atual.nome, palavras: atual.palavras_chave }, depois: { codigo, nome, palavras } }, tx);
  });
}

export type DadosModalidade = { nome: string; sufixo: string; palavras: string[]; ativa: boolean };

async function validarModalidade(d: DadosModalidade, ignorarId: string | null): Promise<DadosModalidade> {
  const nome = d.nome.trim();
  const sufixo = d.sufixo.trim().toUpperCase();
  if (!nome) throw new ErroDeUso("Dê um nome para a modalidade.");
  if (!/^[A-Z]{2}$/.test(sufixo)) throw new ErroDeUso("O sufixo do número precisa ter duas letras, como CX ou DD.");
  if (d.ativa) {
    const [repetido] = await sql<{ nome: string }[]>`
      select nome from modalidades_servico where sufixo_os = ${sufixo} and ativa and (${ignorarId}::uuid is null or id <> ${ignorarId}::uuid)`;
    if (repetido) throw new ErroDeUso(`O sufixo ${sufixo} já é usado por "${repetido.nome}".`);
  }
  return { nome, sufixo, palavras: palavrasLimpas(d.palavras), ativa: d.ativa };
}

export async function criarModalidade(categoria: Categoria, d: DadosModalidade, quem: string | null): Promise<string> {
  const v = await validarModalidade(d, null);
  return sql.begin(async (tx) => {
    const [{ ordem }] = await tx<{ ordem: number }[]>`select coalesce(max(ordem), 0) + 1 as ordem from modalidades_servico where categoria = ${categoria}`;
    const [{ id }] = await tx<{ id: string }[]>`
      insert into modalidades_servico (categoria, nome, sufixo_os, palavras_chave, ordem, ativa)
      values (${categoria}, ${v.nome}, ${v.sufixo}, ${v.palavras}, ${ordem}, ${v.ativa}) returning id`;
    await registrarAuditoria({ quem, acao: "criar", entidade: "modalidade", entidadeId: id, depois: { categoria, ...v } }, tx);
    return id;
  });
}

export async function alterarModalidade(id: string, d: DadosModalidade, quem: string | null): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErroDeUso("Modalidade não encontrada.");
  const [atual] = await sql<{ nome: string; sufixo_os: string; palavras_chave: string[]; ativa: boolean }[]>`
    select nome, sufixo_os, palavras_chave, ativa from modalidades_servico where id = ${id}`;
  if (!atual) throw new ErroDeUso("Modalidade não encontrada.");
  const v = await validarModalidade(d, id);
  await sql.begin(async (tx) => {
    await tx`update modalidades_servico set nome = ${v.nome}, sufixo_os = ${v.sufixo}, palavras_chave = ${v.palavras}, ativa = ${v.ativa} where id = ${id}`;
    await registrarAuditoria(
      { quem, acao: "alterar", entidade: "modalidade", entidadeId: id, antes: { nome: atual.nome, sufixo: atual.sufixo_os, palavras: atual.palavras_chave, ativa: atual.ativa }, depois: v },
      tx,
    );
  });
}

// ---------------------------------------------------------------- configurações

export type Configuracoes = { cevsValidade: string; cidadePadrao: string; fonteMinimaPt: number; marcadorObservacoes: string };

export async function salvarConfiguracoes(novas: Configuracoes, quem: string | null): Promise<void> {
  const cevs = novas.cevsValidade.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(cevs)) throw new ErroDeUso("Use a validade do CEVS no formato dd/mm/aaaa.");
  const cidade = novas.cidadePadrao.trim();
  if (!cidade) throw new ErroDeUso("Informe a cidade padrão.");
  const fonte = Number(novas.fonteMinimaPt);
  if (!Number.isFinite(fonte) || fonte < 6 || fonte > 11) throw new ErroDeUso("O tamanho mínimo de fonte precisa ficar entre 6 e 11.");
  const marcador = novas.marcadorObservacoes.trim();
  if (!marcador) throw new ErroDeUso("Informe o texto que marca as observações no modelo.");

  const atual = await configuracoesOS();
  const pares: [keyof Configuracoes, string, unknown][] = [
    ["cevsValidade", "cevs_validade", cevs],
    ["cidadePadrao", "cidade_padrao", cidade],
    ["fonteMinimaPt", "fonte_minima_pt", fonte],
    ["marcadorObservacoes", "marcador_observacoes", marcador],
  ];
  const mudou = pares.filter(([k, , v]) => atual[k] !== v);
  if (!mudou.length) return;
  await sql.begin(async (tx) => {
    for (const [, chave, v] of mudou) {
      await tx`insert into configuracoes (chave, valor) values (${chave}, ${tx.json(v as never)})
        on conflict (chave) do update set valor = excluded.valor`;
    }
    await registrarAuditoria(
      {
        quem,
        acao: "alterar",
        entidade: "configuracoes",
        antes: Object.fromEntries(mudou.map(([k]) => [k, atual[k]])),
        depois: Object.fromEntries(mudou.map(([k, , v]) => [k, v])),
      },
      tx,
    );
  });
}

// ---------------------------------------------------------------- histórico de alterações

export type LinhaAuditoria = { id: string; quando: Date; quem: string | null; acao: string; entidade: string; entidadeId: string | null; antes: unknown; depois: unknown };

export async function listarAuditoria(pagina = 1, porPagina = 40): Promise<{ linhas: LinhaAuditoria[]; total: number }> {
  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from auditoria`;
  const linhas = await sql<{ id: string; quando: Date; quem: string | null; acao: string; entidade: string; entidade_id: string | null; antes: unknown; depois: unknown }[]>`
    select id::text, quando, quem, acao, entidade, entidade_id, antes, depois from auditoria
    order by quando desc, id desc limit ${porPagina} offset ${(Math.max(1, pagina) - 1) * porPagina}`;
  return { total, linhas: linhas.map((l) => ({ ...l, entidadeId: l.entidade_id })) };
}
