// Regras de negócio com banco: interpretar e guardar agendas, conferir, numerar e emitir O.S.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { TransactionSql } from "postgres";
import { sql } from "../db";
import { registrarAuditoria } from "../auditoria";
import { classificarServico, interpretarAgenda, MODALIDADES_PADRAO, type Categoria, type Modalidade } from "./agenda";
import { divergenciaDeEndereco, nomeNormalizado, reconhecerCliente, soDigitos, type ClienteCandidato, type EnderecoSalvo } from "./clientes";
import type { CampoModelo, DadosOS } from "./docx";
import { baseNumero, proximosNumeros } from "./numeracao";
import { converterParaPdf, descreverAjuste, gerarComAjuste, type OSGerada } from "./pdf";
import { dadosDoAtendimento, pendenciasDe, type DadosOrdem, type Ordem, type StatusOrdem } from "./tipos";

const exec = promisify(execFile);

export class ErroDeUso extends Error {}

// ---------------------------------------------------------------- configurações

export type ConfigOS = { cidadePadrao: string; cevsValidade: string; fonteMinimaPt: number; marcadorObservacoes: string };

export async function configuracoesOS(): Promise<ConfigOS> {
  const linhas = await sql<{ chave: string; valor: unknown }[]>`select chave, valor from configuracoes`;
  const c = Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
  return {
    cidadePadrao: (c.cidade_padrao as string) ?? "Sorocaba/SP",
    cevsValidade: (c.cevs_validade as string) ?? "",
    fonteMinimaPt: Number(c.fonte_minima_pt ?? 7),
    marcadorObservacoes: (c.marcador_observacoes as string) ?? "Observações",
  };
}

export async function modalidadesAtivas(): Promise<Modalidade[]> {
  const linhas = await sql<{ categoria: Categoria; nome: string; sufixo_os: string; palavras_chave: string[] }[]>`
    select m.categoria, m.nome, m.sufixo_os, m.palavras_chave
    from modalidades_servico m join categorias_servico c on c.codigo = m.categoria
    where m.ativa and c.ativa order by m.ordem`;
  if (!linhas.length) return MODALIDADES_PADRAO;
  // As palavras da categoria (ex.: "escorpião") também valem para a modalidade principal dela.
  const cats = await sql<{ codigo: Categoria; palavras_chave: string[] }[]>`select codigo, palavras_chave from categorias_servico where ativa`;
  return linhas.map((l) => {
    const daCategoria = cats.find((c) => c.codigo === l.categoria)?.palavras_chave ?? [];
    const principal = l.categoria !== "caixas";
    return { categoria: l.categoria, nome: l.nome, sufixo: l.sufixo_os, palavras: principal ? [...l.palavras_chave, ...daCategoria] : l.palavras_chave };
  });
}

export function hojeEmSaoPaulo(): { dia: number; mes: number; ano: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [ano, mes, dia] = p.split("-").map(Number);
  return { dia, mes, ano };
}

// ---------------------------------------------------------------- leitura

type LinhaOrdem = { id: string; numero: string | null; agenda_id: string | null; status: StatusOrdem; dados: DadosOrdem; criado_em: Date; criado_por: string | null };

const paraOrdem = (l: LinhaOrdem): Ordem => ({
  id: l.id,
  numero: l.numero,
  agendaId: l.agenda_id,
  status: l.status,
  dados: l.dados,
  criadoEm: l.criado_em,
  criadoPor: l.criado_por,
});

export async function ordensDaAgenda(agendaId: string): Promise<Ordem[]> {
  const linhas = await sql<LinhaOrdem[]>`
    select id, numero, agenda_id, status, dados, criado_em, criado_por from ordens
    where agenda_id = ${agendaId} order by (dados->>'indice')::int nulls last, criado_em, id`;
  return linhas.map(paraOrdem);
}

export async function buscarOrdem(id: string): Promise<Ordem | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [l] = await sql<LinhaOrdem[]>`select id, numero, agenda_id, status, dados, criado_em, criado_por from ordens where id = ${id}`;
  return l ? paraOrdem(l) : null;
}

export async function buscarAgenda(id: string): Promise<{ id: string; texto: string; criadoEm: Date; criadoPor: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [a] = await sql<{ id: string; texto_original: string; criado_em: Date; criado_por: string | null }[]>`
    select id, texto_original, criado_em, criado_por from agendas where id = ${id}`;
  return a ? { id: a.id, texto: a.texto_original, criadoEm: a.criado_em, criadoPor: a.criado_por } : null;
}

// ---------------------------------------------------------------- numeração

async function numerar(tx: TransactionSql, data: string, sufixo: string, quantidade: number): Promise<string[]> {
  const base = baseNumero(data, sufixo);
  await tx`select pg_advisory_xact_lock(hashtext(${base}))`;
  const existentes = await tx<{ numero: string }[]>`select numero from ordens where numero like ${base + "%"}`;
  return proximosNumeros(base, existentes.map((e) => e.numero), quantidade);
}

// ---------------------------------------------------------------- interpretar

async function candidatos(): Promise<ClienteCandidato[]> {
  return sql<ClienteCandidato[]>`select id, nome, telefones from clientes`;
}

async function enderecosDe(clienteId: string): Promise<EnderecoSalvo[]> {
  return sql<EnderecoSalvo[]>`
    select id, rua, bairro, cidade, referencia, principal from cliente_enderecos
    where cliente_id = ${clienteId} order by principal desc, rua`;
}

/** Interpreta a agenda, cria um rascunho de O.S. por atendimento e devolve o id da agenda. */
export async function interpretarEGuardar(texto: string, quem: string | null): Promise<{ agendaId: string; quantidade: number }> {
  const limpo = texto.trim();
  if (!limpo) throw new ErroDeUso("Cole a agenda antes de interpretar.");
  if (limpo.length > 50_000) throw new ErroDeUso("A agenda é grande demais. Divida em partes.");

  const config = await configuracoesOS();
  const atendimentos = interpretarAgenda(limpo, { hoje: hojeEmSaoPaulo(), cidadePadrao: config.cidadePadrao, modalidades: await modalidadesAtivas() });
  if (!atendimentos.length) throw new ErroDeUso("Não encontrei nenhum atendimento nesse texto. Confira se colou a agenda inteira.");

  const lista = await candidatos();
  const dados: DadosOrdem[] = [];
  for (const a of atendimentos) {
    const rec = reconhecerCliente(a.cliente, a.telefone, lista);
    const salvo = rec.tipo === "reconhecido" ? divergenciaDeEndereco(a.rua, await enderecosDe(rec.clienteId)) : null;
    dados.push({ ...dadosDoAtendimento(a, rec, salvo), indice: a.indice });
  }

  return sql.begin(async (tx) => {
    const [{ id: agendaId }] = await tx<{ id: string }[]>`
      insert into agendas (texto_original, criado_por) values (${limpo}, ${quem}) returning id`;

    // Números reservados agora, por data e sufixo, para o lote inteiro.
    const grupos = new Map<string, number[]>();
    dados.forEach((d, i) => {
      if (!d.data || !d.sufixo) return;
      const k = `${d.data}|${d.sufixo}`;
      grupos.set(k, [...(grupos.get(k) ?? []), i]);
    });
    const numeros: (string | null)[] = dados.map(() => null);
    for (const [k, idx] of grupos) {
      const [data, sufixo] = k.split("|");
      const n = await numerar(tx, data, sufixo, idx.length);
      idx.forEach((i, j) => (numeros[i] = n[j]));
    }

    for (let i = 0; i < dados.length; i++) {
      const d = dados[i];
      const [{ id }] = await tx<{ id: string }[]>`
        insert into ordens (numero, agenda_id, categoria, sufixo, servico, cliente_nome, data_execucao, hora, rua, bairro, cidade, observacoes, pagamento_forma, status, dados, criado_por)
        values (${numeros[i]}, ${agendaId}, ${d.categoria}, ${d.sufixo}, ${d.servico}, ${d.cliente}, ${dataSql(d.data)}, ${d.hora}, ${d.rua}, ${d.bairro}, ${d.cidade},
                ${d.observacoes.join("\n") || null}, ${d.pagamento?.forma ?? null}, 'rascunho', ${tx.json(d as never)}, ${quem})
        returning id`;
      await registrarAuditoria({ quem, acao: "criar", entidade: "ordem", entidadeId: id, depois: { numero: numeros[i], ...d } }, tx);
    }
    return { agendaId, quantidade: dados.length };
  });
}

function dataSql(data: string | null): string | null {
  const m = data?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// ---------------------------------------------------------------- conferir e alterar

export type MudancasOrdem = Partial<
  Pick<DadosOrdem, "cliente" | "telefone" | "data" | "hora" | "servico" | "categoria" | "rua" | "bairro" | "cidade" | "observacoes" | "pagamento" | "clienteEscolhido">
> & { escolhaEndereco?: "so_nesta" | "salvar_novo" | "manter_antigo"; conferida?: boolean };

const SUFIXO_PADRAO: Record<Categoria, string> = { caixas: "CX", dedet: "DD", desr: "DR" };

/**
 * Altera somente o que foi pedido. Se data ou categoria mudarem num rascunho,
 * o número é refeito; numa O.S. emitida nada muda.
 */
export async function alterarOrdem(id: string, mudancas: MudancasOrdem, quem: string | null): Promise<Ordem> {
  const atual = await buscarOrdem(id);
  if (!atual) throw new ErroDeUso("O.S. não encontrada.");
  if (atual.status === "emitida") throw new ErroDeUso("Esta O.S. já foi emitida e não pode mais ser alterada. Crie uma nova a partir dela.");

  const antes = atual.dados;
  const d: DadosOrdem = { ...antes };
  const texto = (v: string | null | undefined) => (v === undefined ? undefined : v === null ? null : v.trim() || null);
  for (const k of ["cliente", "telefone", "data", "hora", "servico", "rua", "bairro", "cidade"] as const) {
    const v = texto(mudancas[k]);
    if (v !== undefined) d[k] = v;
  }
  if (mudancas.observacoes !== undefined) d.observacoes = mudancas.observacoes.map((o) => o.trim()).filter(Boolean);
  if (mudancas.pagamento !== undefined) d.pagamento = mudancas.pagamento;
  if (mudancas.clienteEscolhido !== undefined) d.clienteEscolhido = mudancas.clienteEscolhido;
  if (mudancas.categoria !== undefined) d.categoria = mudancas.categoria;

  if (mudancas.categoria !== undefined || mudancas.servico !== undefined) {
    const c = d.servico ? classificarServico(d.servico, await modalidadesAtivas()) : null;
    d.sufixo = d.categoria ? (c && c.categoria === d.categoria ? c.sufixo : SUFIXO_PADRAO[d.categoria]) : null;
  }

  if (mudancas.escolhaEndereco && d.divergencia) {
    d.divergencia = { ...d.divergencia, escolha: mudancas.escolhaEndereco };
    if (mudancas.escolhaEndereco === "manter_antigo") {
      d.rua = d.divergencia.salvo.rua;
      d.bairro = d.divergencia.salvo.bairro;
      d.cidade = d.divergencia.salvo.cidade;
    }
  }
  if (mudancas.conferida) d.conferida = true;

  if (d.data && !/^\d{2}\/\d{2}\/\d{4}$/.test(d.data)) throw new ErroDeUso("Use a data no formato dd/mm/aaaa.");

  return sql.begin(async (tx) => {
    let numero = atual.numero;
    const mudouChave = d.data !== antes.data || d.sufixo !== antes.sufixo;
    if (mudouChave || (!numero && d.data && d.sufixo)) {
      numero = d.data && d.sufixo ? (await numerar(tx, d.data, d.sufixo, 1))[0] : null;
    }
    const status: StatusOrdem = pendenciasDe(d).length ? "rascunho" : atual.status === "confirmada" ? "confirmada" : "rascunho";
    await tx`
      update ordens set numero = ${numero}, categoria = ${d.categoria}, sufixo = ${d.sufixo}, servico = ${d.servico}, cliente_nome = ${d.cliente},
        data_execucao = ${dataSql(d.data)}, hora = ${d.hora}, rua = ${d.rua}, bairro = ${d.bairro}, cidade = ${d.cidade},
        observacoes = ${d.observacoes.join("\n") || null}, pagamento_forma = ${d.pagamento?.forma ?? null},
        status = ${status}, dados = ${tx.json(d as never)}, atualizado_em = now()
      where id = ${id}`;
    const mudou = Object.fromEntries(
      Object.keys(d).filter((k) => JSON.stringify(d[k as keyof DadosOrdem]) !== JSON.stringify(antes[k as keyof DadosOrdem])).map((k) => [k, d[k as keyof DadosOrdem]]),
    );
    const mudouAntes = Object.fromEntries(Object.keys(mudou).map((k) => [k, antes[k as keyof DadosOrdem]]));
    if (numero !== atual.numero) {
      mudou.numero = numero;
      mudouAntes.numero = atual.numero;
    }
    await registrarAuditoria({ quem, acao: "alterar", entidade: "ordem", entidadeId: id, antes: mudouAntes, depois: mudou }, tx);
    return { ...atual, numero, status, dados: d };
  });
}

export async function excluirRascunho(id: string, quem: string | null): Promise<void> {
  const o = await buscarOrdem(id);
  if (!o) return;
  if (o.status === "emitida") throw new ErroDeUso("O.S. emitida não pode ser excluída.");
  await sql.begin(async (tx) => {
    await tx`delete from ordens where id = ${id}`;
    await registrarAuditoria({ quem, acao: "excluir", entidade: "ordem", entidadeId: id, antes: { numero: o.numero, ...o.dados } }, tx);
  });
}

// ---------------------------------------------------------------- geração

type ModeloOficial = { versaoId: string; arquivo: Uint8Array; campos: CampoModelo[] };

async function modeloOficial(categoria: Categoria): Promise<ModeloOficial> {
  const [m] = await sql<{ id: string; arquivo: Buffer; campos: CampoModelo[] }[]>`
    select v.id, v.arquivo, v.campos from modelo_versoes v join modelos m on m.id = v.modelo_id
    where m.categoria = ${categoria} and v.oficial order by v.numero desc limit 1`;
  if (!m?.arquivo) throw new ErroDeUso("Não há modelo oficial para esta categoria. Cadastre um em Administração.");
  return { versaoId: m.id, arquivo: new Uint8Array(m.arquivo), campos: m.campos };
}

async function modeloPorVersao(versaoId: string): Promise<ModeloOficial> {
  const [m] = await sql<{ id: string; arquivo: Buffer; campos: CampoModelo[] }[]>`
    select id, arquivo, campos from modelo_versoes where id = ${versaoId}`;
  if (!m?.arquivo) throw new ErroDeUso("O modelo usado nesta O.S. não existe mais.");
  return { versaoId: m.id, arquivo: new Uint8Array(m.arquivo), campos: m.campos };
}

function paraDocumento(numero: string | null, d: DadosOrdem, validade: string): DadosOS {
  return {
    validade: d.cevsValidade || validade || undefined,
    osnum: numero ?? "",
    data: d.data ?? "",
    hora: d.hora ?? "",
    cliente: d.cliente ?? "",
    rua: d.rua ?? "",
    bairro: d.bairro ?? "",
    cidade: d.cidade ?? "",
    servico: d.servico ?? "",
    observacoes: d.observacoes,
    pagamento: d.pagamento,
  };
}

// Cache pequeno de prévias, para não converter de novo o que não mudou.
const cachePrevia = new Map<string, { png: Uint8Array; ajuste: string; cabe: boolean }>();

export async function previaDaOrdem(id: string): Promise<{ png: Uint8Array; ajuste: string; cabe: boolean }> {
  const o = await buscarOrdem(id);
  if (!o) throw new ErroDeUso("O.S. não encontrada.");
  if (!o.dados.categoria) throw new ErroDeUso("Escolha a categoria para ver a prévia.");
  const config = await configuracoesOS();
  const modelo = o.status === "emitida" && o.dados.modeloVersaoId ? await modeloPorVersao(o.dados.modeloVersaoId) : await modeloOficial(o.dados.categoria);
  const doc = paraDocumento(o.numero, o.dados, config.cevsValidade);
  const chave = createHash("sha1").update(JSON.stringify([modelo.versaoId, doc, config.fonteMinimaPt])).digest("hex");
  const guardado = cachePrevia.get(chave);
  if (guardado) return guardado;

  const [g] = await gerarComAjuste([{ modelo: modelo.arquivo, campos: modelo.campos, dados: doc }], config.fonteMinimaPt);
  const png = await pdfParaPng(g.pdf);
  const r = { png, ajuste: descreverAjuste(g), cabe: g.cabe };
  cachePrevia.set(chave, r);
  if (cachePrevia.size > 60) cachePrevia.delete(cachePrevia.keys().next().value!);
  return r;
}

async function pdfParaPng(pdf: Uint8Array): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), "ddtrix-png-"));
  try {
    await writeFile(join(dir, "os.pdf"), pdf);
    await exec(process.env.PDFTOPPM_PATH ?? "pdftoppm", ["-png", "-r", "110", "-f", "1", "-l", "1", "-singlefile", join(dir, "os.pdf"), join(dir, "os")], { timeout: 60_000 });
    return new Uint8Array(await readFile(join(dir, "os.png")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Cadastra ou atualiza o cliente conforme as escolhas feitas na conferência. */
async function resolverCliente(tx: TransactionSql, d: DadosOrdem, quem: string | null): Promise<string | null> {
  if (!d.cliente) return null;
  const usarExistente = d.reconhecimento.tipo === "reconhecido" || (d.reconhecimento.tipo === "possivel" && d.clienteEscolhido === "existente");
  if (usarExistente && d.reconhecimento.tipo !== "novo") {
    const clienteId = d.reconhecimento.clienteId;
    if (d.telefone) {
      const [c] = await tx<{ telefones: string[] }[]>`select telefones from clientes where id = ${clienteId}`;
      if (c && !c.telefones.some((t) => soDigitos(t) === soDigitos(d.telefone!))) {
        await tx`update clientes set telefones = array_append(telefones, ${d.telefone}), atualizado_em = now() where id = ${clienteId}`;
        await registrarAuditoria({ quem, acao: "alterar", entidade: "cliente", entidadeId: clienteId, antes: { telefones: c.telefones }, depois: { telefones: [...c.telefones, d.telefone] } }, tx);
      }
    }
    const precisaEndereco = d.divergencia?.escolha === "salvar_novo" || (!d.divergencia && d.rua);
    if (precisaEndereco && d.rua) {
      const enderecos = await tx<{ rua: string }[]>`select rua from cliente_enderecos where cliente_id = ${clienteId}`;
      const { mesmoEndereco } = await import("./clientes");
      if (!enderecos.some((e) => mesmoEndereco(e, { rua: d.rua! }))) {
        const [e] = await tx<{ id: string }[]>`
          insert into cliente_enderecos (cliente_id, rua, bairro, cidade, principal)
          values (${clienteId}, ${d.rua}, ${d.bairro}, ${d.cidade ?? "Sorocaba/SP"}, ${enderecos.length === 0}) returning id`;
        await registrarAuditoria({ quem, acao: "criar", entidade: "cliente_endereco", entidadeId: e.id, depois: { clienteId, rua: d.rua, bairro: d.bairro, cidade: d.cidade } }, tx);
      }
    }
    return clienteId;
  }
  const [c] = await tx<{ id: string }[]>`
    insert into clientes (nome, nome_normalizado, telefones, criado_por)
    values (${d.cliente}, ${nomeNormalizado(d.cliente)}, ${d.telefone ? [d.telefone] : []}, ${quem}) returning id`;
  if (d.rua) {
    await tx`insert into cliente_enderecos (cliente_id, rua, bairro, cidade, principal) values (${c.id}, ${d.rua}, ${d.bairro}, ${d.cidade ?? "Sorocaba/SP"}, true)`;
  }
  await registrarAuditoria({ quem, acao: "criar", entidade: "cliente", entidadeId: c.id, depois: { nome: d.cliente, telefone: d.telefone, rua: d.rua, bairro: d.bairro, cidade: d.cidade } }, tx);
  return c.id;
}

export type Emitida = { id: string; numero: string; cliente: string; pdf: Uint8Array; cabe: boolean; ajuste: string };

/**
 * Emite as O.S. escolhidas: confere pendências, gera os PDFs (ajustando para A4),
 * cadastra/atualiza clientes e grava o snapshot com a versão do modelo usada.
 * O.S. já emitidas são só geradas de novo, a partir do snapshot.
 */
export async function emitirOrdens(ids: string[], quem: string | null): Promise<Emitida[]> {
  if (!ids.length) throw new ErroDeUso("Escolha pelo menos uma O.S.");
  const ordens = (await Promise.all(ids.map(buscarOrdem))).filter((o): o is Ordem => !!o);
  const comPendencia = ordens.filter((o) => o.status !== "emitida" && pendenciasDe(o.dados).length);
  if (comPendencia.length) {
    throw new ErroDeUso(`Resolva as pendências antes de gerar: ${comPendencia.map((o) => o.dados.cliente ?? "sem nome").join(", ")}.`);
  }

  const config = await configuracoesOS();
  const modelos = new Map<string, ModeloOficial>();
  const lista: { o: Ordem; modelo: ModeloOficial }[] = [];
  for (const o of ordens) {
    const chave = o.status === "emitida" && o.dados.modeloVersaoId ? `v:${o.dados.modeloVersaoId}` : `c:${o.dados.categoria}`;
    if (!modelos.has(chave)) {
      modelos.set(chave, chave.startsWith("v:") ? await modeloPorVersao(chave.slice(2)) : await modeloOficial(o.dados.categoria!));
    }
    lista.push({ o, modelo: modelos.get(chave)! });
  }

  const geradas: OSGerada[] = await gerarComAjuste(
    lista.map(({ o, modelo }) => ({ modelo: modelo.arquivo, campos: modelo.campos, dados: paraDocumento(o.numero, o.dados, config.cevsValidade) })),
    config.fonteMinimaPt,
  );

  await sql.begin(async (tx) => {
    for (let i = 0; i < lista.length; i++) {
      const { o, modelo } = lista[i];
      if (o.status === "emitida") continue;
      const clienteId = await resolverCliente(tx, o.dados, quem);
      const snapshot: DadosOrdem = { ...o.dados, modeloVersaoId: modelo.versaoId, cevsValidade: config.cevsValidade, conferida: true };
      await tx`
        update ordens set status = 'emitida', cliente_id = ${clienteId}, modelo_versao_id = ${modelo.versaoId},
          dados = ${tx.json(snapshot as never)}, atualizado_em = now()
        where id = ${o.id}`;
      await registrarAuditoria({ quem, acao: "emitir", entidade: "ordem", entidadeId: o.id, depois: { numero: o.numero, modeloVersaoId: modelo.versaoId } }, tx);
    }
  });

  return lista.map(({ o }, i) => ({
    id: o.id,
    numero: o.numero ?? "sem-numero",
    cliente: o.dados.cliente ?? "",
    pdf: geradas[i].pdf,
    cabe: geradas[i].cabe,
    ajuste: descreverAjuste(geradas[i]),
  }));
}

export { converterParaPdf };
