// Histórico, cadastro de clientes e administração, com banco de teste.
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL_TESTE;
process.env.DATABASE_URL = url ?? "";
let temLibreOffice = true;
try {
  execFileSync("soffice", ["--version"], { stdio: "ignore" });
} catch {
  temLibreOffice = false;
}

const AGENDA = `1.
📅 DATA: 12/11/2026
👤 CLIENTE: Joana Prado
📍 SERVIÇO: Limpeza de caixa d'água
🚗 LOCAL: Rua das Acácias, 45 - Vila Hortência
⏰ HORÁRIO: 10:00
2.
📅 DATA: 12/11/2026
👤 CLIENTE: Padaria São Jorge
📍 SERVIÇO: Dedetização baratas
🚗 LOCAL: Av. São Paulo, 900 - Centro
⏰ HORÁRIO: 15:00`;

describe.skipIf(!url || !temLibreOffice)("passo 4", async () => {
  const { sql } = await import("./db");
  const s = await import("./os/servico");
  const h = await import("./historico");
  const c = await import("./cadastro-clientes");
  const adm = await import("./administracao");

  let ids: string[] = [];

  beforeAll(async () => {
    await sql`truncate ordens, agendas, cliente_enderecos, clientes restart identity cascade`;
    const { agendaId } = await s.interpretarEGuardar(AGENDA, "Teste");
    const ordens = await s.ordensDaAgenda(agendaId);
    ids = ordens.map((o) => o.id);
    for (const id of ids) await s.alterarOrdem(id, { conferida: true }, "Teste");
    await s.emitirOrdens([ids[0]], "Teste");
  }, 120_000);
  afterAll(async () => {
    await sql.end();
  });

  it("busca no histórico por nome sem acento, número e categoria", async () => {
    expect((await h.buscarHistorico({ q: "sao jorge" })).itens.map((i) => i.cliente)).toEqual(["Padaria São Jorge"]);
    expect((await h.buscarHistorico({ q: "20261112CX" })).itens).toHaveLength(1);
    expect((await h.buscarHistorico({ categoria: "dedet" })).itens.map((i) => i.cliente)).toEqual(["Padaria São Jorge"]);
    expect((await h.buscarHistorico({ situacao: "emitida" })).total).toBe(1);
    expect((await h.buscarHistorico({ de: "2026-11-13" })).total).toBe(0);
  });

  it("reaproveita uma O.S. sem copiar data, horário nem número", async () => {
    const novoId = await h.reaproveitarOrdem(ids[0], "Teste");
    const nova = await s.buscarOrdem(novoId);
    expect(nova?.numero).toBeNull();
    expect(nova?.dados.data).toBeNull();
    expect(nova?.dados.hora).toBeNull();
    expect(nova?.dados.cliente).toBe("Joana Prado");
    expect(nova?.dados.reconhecimento.tipo).toBe("reconhecido");
    const alterada = await s.alterarOrdem(novoId, { data: "20/11/2026", hora: "08:00" }, "Teste");
    expect(alterada.numero).toBe("20261120CX");
  });

  it("cliente: busca, edita só o que mudou e cuida dos endereços", async () => {
    const [joana] = await c.listarClientes("joana");
    expect(joana.ordens).toBe(2); // a emitida e a reaproveitada
    expect((await c.listarClientes("acacias"))[0]?.id).toBe(joana.id);

    await c.alterarCliente(joana.id, { nome: "Joana Prado", telefones: ["(15) 99999-0000"], observacoes: null }, "Teste");
    expect((await c.listarClientes("99999"))[0]?.id).toBe(joana.id);
    const [aud] = await sql<{ antes: unknown; depois: unknown }[]>`select antes, depois from auditoria where entidade = 'cliente' and acao = 'alterar' order by id desc limit 1`;
    expect(aud.depois).toEqual({ telefones: ["(15) 99999-0000"] });

    const novo = await c.adicionarEndereco(joana.id, { rua: "Rua Nova, 1", bairro: null, cidade: "Votorantim/SP", referencia: "Portão azul" }, "Teste");
    await c.tornarPrincipal(joana.id, novo, "Teste");
    let ficha = await c.buscarCliente(joana.id);
    expect(ficha?.enderecos[0]).toMatchObject({ rua: "Rua Nova, 1", principal: true });
    await c.removerEndereco(joana.id, novo, "Teste");
    ficha = await c.buscarCliente(joana.id);
    expect(ficha?.enderecos).toHaveLength(1);
    expect(ficha?.enderecos[0].principal).toBe(true);
  });

  it("modelos: importa, confere campos, só oficializa com tudo encontrado e volta à versão antiga", async () => {
    const [modelo] = (await adm.listarModelos()).filter((m) => m.categoria === "caixas");
    const oficial = modelo.versoes.find((v) => v.oficial)!;
    const { arquivo } = await adm.arquivoDaVersao(oficial.id);

    await expect(adm.importarVersao(modelo.id, new Uint8Array([1, 2, 3]), null, "Teste")).rejects.toThrow(/docx/);
    const nova = await adm.importarVersao(modelo.id, arquivo, "teste", "Teste");
    expect((await adm.conferirVersao(nova)).every((c) => c.encontrado)).toBe(true);

    const campos = oficial.campos.map((c) => (c.k === "cliente" ? { ...c, s: "Texto que não existe" } : c));
    await adm.salvarCampos(nova, campos, "Teste");
    await expect(adm.tornarOficial(nova, "Teste")).rejects.toThrow(/Cliente/);
    await adm.salvarCampos(nova, oficial.campos, "Teste");

    const teste = await adm.testarVersao(nova);
    expect(teste.faltando).toEqual([]);
    expect(teste.png.length).toBeGreaterThan(1000);

    await adm.tornarOficial(nova, "Teste");
    await expect(adm.salvarCampos(nova, oficial.campos, "Teste")).rejects.toThrow(/oficial/);
    await adm.tornarOficial(oficial.id, "Teste"); // voltar à versão anterior
    const depois = (await adm.listarModelos()).find((m) => m.id === modelo.id)!;
    expect(depois.versoes.find((v) => v.oficial)?.id).toBe(oficial.id);
    await sql`delete from modelo_versoes where id = ${nova}`;
  }, 120_000);

  it("modalidades e configurações validam e ficam na auditoria", async () => {
    await expect(adm.criarModalidade("caixas", { nome: "Outra", sufixo: "CX", palavras: [], ativa: true }, "Teste")).rejects.toThrow(/já é usado/);
    await expect(adm.criarModalidade("caixas", { nome: "Outra", sufixo: "C1", palavras: [], ativa: true }, "Teste")).rejects.toThrow(/duas letras/);
    const id = await adm.criarModalidade("caixas", { nome: "Poço", sufixo: "pc", palavras: ["Poço", "poco"], ativa: true }, "Teste");
    const { modalidades } = await adm.listarCategorias();
    expect(modalidades.find((m) => m.id === id)).toMatchObject({ sufixo: "PC", palavras: ["poço", "poco"] });
    await sql`delete from modalidades_servico where id = ${id}`;

    const antes = await s.configuracoesOS();
    await expect(adm.salvarConfiguracoes({ ...antes, cevsValidade: "2027" }, "Teste")).rejects.toThrow(/dd\/mm\/aaaa/);
    await adm.salvarConfiguracoes({ ...antes, cevsValidade: "10/11/2027" }, "Teste");
    expect((await s.configuracoesOS()).cevsValidade).toBe("10/11/2027");
    const [aud] = await sql<{ antes: unknown; depois: unknown }[]>`select antes, depois from auditoria where entidade = 'configuracoes' order by id desc limit 1`;
    expect(aud).toEqual({ antes: { cevsValidade: antes.cevsValidade }, depois: { cevsValidade: "10/11/2027" } });
    await adm.salvarConfiguracoes(antes, "Teste");
  });
});
