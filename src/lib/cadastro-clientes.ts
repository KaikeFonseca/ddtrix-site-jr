// Cadastro de clientes (especificação, seção 6). Nada é sobrescrito sozinho:
// toda mudança aqui vem de alguém editando, e fica na auditoria.
import { sql } from "./db";
import { registrarAuditoria } from "./auditoria";
import { nomeNormalizado } from "./os/clientes";
import { ErroDeUso } from "./os/servico";

export type ResumoCliente = {
  id: string;
  nome: string;
  telefones: string[];
  endereco: string | null;
  enderecos: number;
  ordens: number;
  ultima: string | null; // aaaa-mm-dd
};

export type Endereco = { id: string; rua: string; bairro: string | null; cidade: string; referencia: string | null; principal: boolean };

export type Cliente = {
  id: string;
  nome: string;
  telefones: string[];
  observacoes: string | null;
  criadoEm: Date;
  criadoPor: string | null;
  enderecos: Endereco[];
};

const uuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function listarClientes(q: string, limite = 60): Promise<ResumoCliente[]> {
  const termo = q.trim() ? `%${q.trim().slice(0, 100)}%` : null;
  const digitos = q.replace(/\D/g, "");
  const tel = digitos.length >= 4 ? `%${digitos}%` : null;
  const linhas = await sql<{ id: string; nome: string; telefones: string[]; rua: string | null; bairro: string | null; enderecos: number; ordens: number; ultima: string | null }[]>`
    select c.id, c.nome, c.telefones,
      (select e.rua from cliente_enderecos e where e.cliente_id = c.id order by e.principal desc, e.rua limit 1) as rua,
      (select e.bairro from cliente_enderecos e where e.cliente_id = c.id order by e.principal desc, e.rua limit 1) as bairro,
      (select count(*)::int from cliente_enderecos e where e.cliente_id = c.id) as enderecos,
      (select count(*)::int from ordens o where o.cliente_id = c.id) as ordens,
      (select to_char(max(o.data_execucao), 'YYYY-MM-DD') from ordens o where o.cliente_id = c.id) as ultima
    from clientes c
    where ${termo}::text is null
       or unaccent(lower(c.nome)) like unaccent(lower(${termo}))
       or (${tel}::text is not null and regexp_replace(array_to_string(c.telefones, ' '), '\\D', '', 'g') like ${tel})
       or exists (select 1 from cliente_enderecos e where e.cliente_id = c.id
                  and unaccent(lower(e.rua || ' ' || coalesce(e.bairro, ''))) like unaccent(lower(${termo})))
    order by unaccent(lower(c.nome))
    limit ${limite}`;
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    telefones: l.telefones,
    endereco: l.rua ? [l.rua, l.bairro].filter(Boolean).join(" · ") : null,
    enderecos: l.enderecos,
    ordens: l.ordens,
    ultima: l.ultima,
  }));
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  if (!uuid(id)) return null;
  const [c] = await sql<{ id: string; nome: string; telefones: string[]; observacoes: string | null; criado_em: Date; criado_por: string | null }[]>`
    select id, nome, telefones, observacoes, criado_em, criado_por from clientes where id = ${id}`;
  if (!c) return null;
  const enderecos = await sql<Endereco[]>`
    select id, rua, bairro, cidade, referencia, principal from cliente_enderecos
    where cliente_id = ${id} order by principal desc, rua`;
  return { id: c.id, nome: c.nome, telefones: c.telefones, observacoes: c.observacoes, criadoEm: c.criado_em, criadoPor: c.criado_por, enderecos };
}

export type DadosCliente = { nome: string; telefones: string[]; observacoes: string | null };

function limpar(d: DadosCliente): DadosCliente {
  const nome = d.nome.trim();
  if (!nome) throw new ErroDeUso("O nome do cliente não pode ficar vazio.");
  const telefones = [...new Set(d.telefones.map((t) => t.trim()).filter(Boolean))];
  return { nome, telefones, observacoes: d.observacoes?.trim() || null };
}

export async function criarCliente(d: DadosCliente & { endereco?: Omit<Endereco, "id" | "principal"> | null }, quem: string | null): Promise<string> {
  const c = limpar(d);
  return sql.begin(async (tx) => {
    const [{ id }] = await tx<{ id: string }[]>`
      insert into clientes (nome, nome_normalizado, telefones, observacoes, criado_por)
      values (${c.nome}, ${nomeNormalizado(c.nome)}, ${c.telefones}, ${c.observacoes}, ${quem}) returning id`;
    const e = d.endereco;
    if (e?.rua.trim()) {
      await tx`insert into cliente_enderecos (cliente_id, rua, bairro, cidade, referencia, principal)
        values (${id}, ${e.rua.trim()}, ${e.bairro?.trim() || null}, ${e.cidade.trim() || "Sorocaba/SP"}, ${e.referencia?.trim() || null}, true)`;
    }
    await registrarAuditoria({ quem, acao: "criar", entidade: "cliente", entidadeId: id, depois: { ...c, endereco: e ?? null } }, tx);
    return id;
  });
}

/** Altera só os campos que vieram diferentes e registra antes/depois. */
export async function alterarCliente(id: string, d: DadosCliente, quem: string | null): Promise<void> {
  const atual = await buscarCliente(id);
  if (!atual) throw new ErroDeUso("Cliente não encontrado.");
  const novo = limpar(d);
  const antes: Partial<DadosCliente> = {};
  const depois: Partial<DadosCliente> = {};
  if (novo.nome !== atual.nome) [antes.nome, depois.nome] = [atual.nome, novo.nome];
  if (JSON.stringify(novo.telefones) !== JSON.stringify(atual.telefones)) [antes.telefones, depois.telefones] = [atual.telefones, novo.telefones];
  if (novo.observacoes !== atual.observacoes) [antes.observacoes, depois.observacoes] = [atual.observacoes, novo.observacoes];
  if (!Object.keys(depois).length) return;
  await sql.begin(async (tx) => {
    await tx`update clientes set nome = ${novo.nome}, nome_normalizado = ${nomeNormalizado(novo.nome)}, telefones = ${novo.telefones},
      observacoes = ${novo.observacoes}, atualizado_em = now() where id = ${id}`;
    await registrarAuditoria({ quem, acao: "alterar", entidade: "cliente", entidadeId: id, antes, depois }, tx);
  });
}

export type DadosEndereco = { rua: string; bairro: string | null; cidade: string; referencia: string | null };

function limparEndereco(e: DadosEndereco): DadosEndereco {
  const rua = e.rua.trim();
  if (!rua) throw new ErroDeUso("Informe a rua e o número.");
  return { rua, bairro: e.bairro?.trim() || null, cidade: e.cidade.trim() || "Sorocaba/SP", referencia: e.referencia?.trim() || null };
}

export async function adicionarEndereco(clienteId: string, e: DadosEndereco, quem: string | null): Promise<string> {
  if (!(await buscarCliente(clienteId))) throw new ErroDeUso("Cliente não encontrado.");
  const d = limparEndereco(e);
  return sql.begin(async (tx) => {
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from cliente_enderecos where cliente_id = ${clienteId}`;
    const [{ id }] = await tx<{ id: string }[]>`
      insert into cliente_enderecos (cliente_id, rua, bairro, cidade, referencia, principal)
      values (${clienteId}, ${d.rua}, ${d.bairro}, ${d.cidade}, ${d.referencia}, ${n === 0}) returning id`;
    await registrarAuditoria({ quem, acao: "criar", entidade: "cliente_endereco", entidadeId: id, depois: { clienteId, ...d } }, tx);
    return id;
  });
}

async function enderecoDoCliente(clienteId: string, enderecoId: string): Promise<Endereco> {
  if (!uuid(enderecoId)) throw new ErroDeUso("Endereço não encontrado.");
  const [e] = await sql<Endereco[]>`select id, rua, bairro, cidade, referencia, principal from cliente_enderecos where id = ${enderecoId} and cliente_id = ${clienteId}`;
  if (!e) throw new ErroDeUso("Endereço não encontrado.");
  return e;
}

export async function alterarEndereco(clienteId: string, enderecoId: string, e: DadosEndereco, quem: string | null): Promise<void> {
  const atual = await enderecoDoCliente(clienteId, enderecoId);
  const d = limparEndereco(e);
  await sql.begin(async (tx) => {
    await tx`update cliente_enderecos set rua = ${d.rua}, bairro = ${d.bairro}, cidade = ${d.cidade}, referencia = ${d.referencia} where id = ${enderecoId}`;
    await registrarAuditoria(
      { quem, acao: "alterar", entidade: "cliente_endereco", entidadeId: enderecoId, antes: { rua: atual.rua, bairro: atual.bairro, cidade: atual.cidade, referencia: atual.referencia }, depois: d },
      tx,
    );
  });
}

export async function tornarPrincipal(clienteId: string, enderecoId: string, quem: string | null): Promise<void> {
  const e = await enderecoDoCliente(clienteId, enderecoId);
  if (e.principal) return;
  await sql.begin(async (tx) => {
    await tx`update cliente_enderecos set principal = false where cliente_id = ${clienteId}`;
    await tx`update cliente_enderecos set principal = true where id = ${enderecoId}`;
    await registrarAuditoria({ quem, acao: "alterar", entidade: "cliente_endereco", entidadeId: enderecoId, depois: { principal: true, rua: e.rua } }, tx);
  });
}

export async function removerEndereco(clienteId: string, enderecoId: string, quem: string | null): Promise<void> {
  const e = await enderecoDoCliente(clienteId, enderecoId);
  await sql.begin(async (tx) => {
    await tx`delete from cliente_enderecos where id = ${enderecoId}`;
    if (e.principal) {
      await tx`update cliente_enderecos set principal = true where id = (select id from cliente_enderecos where cliente_id = ${clienteId} order by rua limit 1)`;
    }
    await registrarAuditoria({ quem, acao: "excluir", entidade: "cliente_endereco", entidadeId: enderecoId, antes: { clienteId, rua: e.rua, bairro: e.bairro, cidade: e.cidade } }, tx);
  });
}
