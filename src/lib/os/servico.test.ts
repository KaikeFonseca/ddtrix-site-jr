// Fluxo completo com banco de teste: interpretar, conferir, numerar, emitir e reconhecer na próxima agenda.
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

const AGENDA = `AGENDA (Quarta-Feira) 11/11
1.
· 📅 DATA: 11/11/2026
· 👤 CLIENTE: Pedro Luiz Silva Pinto
· 📍 SERVIÇO: Limpeza de caixa D'água
· 🚗 LOCAL: Av. Italia, 277, parque Monte Bianco, Aracoiaba da Serra. Chácara de esquina com a rua Imola.
· ⏰ HORÁRIO APROXIMADO: 09Hrs
2.
· 📆 DATA: 11/11/2026
· 👤 CLIENTE: Condomínio Portal do Ipanema
· 📍 SERVIÇO: Dedetização Completa/Desratização Mensal
· 🚗 LOCAL: Avenida Ipanema, 6055 - Jd Novo Horizonte
· ⏰ HORÁRIO APROXIMADO: 09Hrs
3.
· 📅 DATA: 11/11/2026
· 👤 CLIENTE: Marcus Souza 1234
· 📍 SERVIÇO: Dedetização foco (escorpião)
· 🚗 LOCAL: Rua sarapu Banirei, 862 – jardim Simus
· ⏰ HORÁRIO APROXIMADO: 16:15Hrs
· 💰 Preço: R$ 450 reais cartão débito`;

describe.skipIf(!url || !temLibreOffice)("fluxo de emissão", async () => {
  const { sql } = await import("../db");
  const s = await import("./servico");
  const { pendenciasDe } = await import("./tipos");

  beforeAll(async () => {
    await sql`truncate ordens, agendas, cliente_enderecos, clientes restart identity cascade`;
  });
  afterAll(async () => {
    await sql.end();
  });

  let agenda1 = "";

  it("interpreta e cria rascunhos numerados", async () => {
    const r = await s.interpretarEGuardar(AGENDA, "Eduarda");
    agenda1 = r.agendaId;
    expect(r.quantidade).toBe(3);
    const ordens = await s.ordensDaAgenda(r.agendaId);
    expect(ordens.map((o) => o.numero)).toEqual(["20261111CX", "20261111DDP1", "20261111DDP2"]);
    expect(ordens.map((o) => o.dados.reconhecimento.tipo)).toEqual(["novo", "novo", "novo"]);
    expect(pendenciasDe(ordens[2].dados).length).toBeGreaterThan(0);
  });

  it("não emite com pendência", async () => {
    const ordens = await s.ordensDaAgenda(agenda1);
    await expect(s.emitirOrdens([ordens[2].id], "Eduarda")).rejects.toThrow(/pendências/);
  });

  it("alterar só o horário muda só o horário", async () => {
    const [o] = await s.ordensDaAgenda(agenda1);
    const depois = await s.alterarOrdem(o.id, { hora: "15:00" }, "Eduarda");
    expect(depois.dados.hora).toBe("15:00");
    const { hora: _a, ...restoAntes } = o.dados;
    const { hora: _b, ...restoDepois } = depois.dados;
    expect(restoDepois).toEqual(restoAntes);
    expect(depois.numero).toBe(o.numero);
    const [aud] = await sql`select antes, depois, quem from auditoria where entidade_id = ${o.id} and acao = 'alterar' order by id desc limit 1`;
    expect(aud).toMatchObject({ quem: "Eduarda", antes: { hora: "09:00" }, depois: { hora: "15:00" } });
  });

  it("corrigir o nome e conferir libera a emissão; emite com PDF de uma folha", { timeout: 120_000 }, async () => {
    const ordens = await s.ordensDaAgenda(agenda1);
    await s.alterarOrdem(ordens[2].id, { cliente: "Marcus Souza", conferida: true }, "Eduarda");
    const emitidas = await s.emitirOrdens(ordens.map((o) => o.id), "Eduarda");
    expect(emitidas).toHaveLength(3);
    expect(emitidas.every((e) => e.cabe)).toBe(true);
    const [{ n }] = await sql`select count(*)::int as n from clientes`;
    expect(n).toBe(3);
    const depois = await s.ordensDaAgenda(agenda1);
    expect(depois.every((o) => o.status === "emitida" && o.dados.modeloVersaoId)).toBe(true);
    await expect(s.alterarOrdem(depois[0].id, { hora: "10:00" }, "Eduarda")).rejects.toThrow(/já foi emitida/);
  });

  it("na próxima agenda reconhece os clientes, avisa endereço diferente e continua a numeração", async () => {
    const nova = AGENDA.replace("Av. Italia, 277, parque Monte Bianco, Aracoiaba da Serra", "R. Imola, 40, parque Monte Bianco, Aracoiaba da Serra");
    const r = await s.interpretarEGuardar(nova, "Juninho");
    const ordens = await s.ordensDaAgenda(r.agendaId);
    expect(ordens.map((o) => o.numero)).toEqual(["20261111CXP2", "20261111DDP3", "20261111DDP4"]);
    expect(ordens.map((o) => o.dados.reconhecimento.tipo)).toEqual(["reconhecido", "reconhecido", "reconhecido"]);
    expect(ordens[0].dados.divergencia?.salvo.rua).toBe("Av. Italia, 277");
    expect(ordens[1].dados.divergencia).toBeNull();

    // Escolher manter o endereço antigo usa o salvo e libera.
    const o = await s.alterarOrdem(ordens[0].id, { escolhaEndereco: "manter_antigo" }, "Juninho");
    expect(o.dados.rua).toBe("Av. Italia, 277");
    expect(pendenciasDe(o.dados)).toEqual([]);
  });

  it("mudar a categoria refaz o número do rascunho", async () => {
    const [a] = await sql`select id from agendas order by criado_em desc limit 1`;
    const ordens = await s.ordensDaAgenda(a.id);
    const o = await s.alterarOrdem(ordens[1].id, { categoria: "desr" }, "Juninho");
    expect(o.numero).toBe("20261111DR");
  });
});
