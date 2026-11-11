// Testes com o banco de teste (DATABASE_URL_TESTE). Pulados se não houver banco.
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL_TESTE;
process.env.DATABASE_URL = url ?? "";

describe.skipIf(!url)("banco", async () => {
  const { sql } = await import("./db");
  const { registrarAuditoria } = await import("./auditoria");
  const { bloqueado, registrarTentativa, MAX_TENTATIVAS } = await import("./login");

  afterAll(async () => {
    await sql.end();
  });

  it("grava auditoria com quem, antes e depois", async () => {
    const id = crypto.randomUUID();
    await registrarAuditoria({
      quem: "Eduarda",
      acao: "alterar",
      entidade: "cliente",
      entidadeId: id,
      antes: { hora: "09:00" },
      depois: { hora: "15:00" },
    });
    const [linha] = await sql`select quem, acao, antes, depois from auditoria where entidade_id = ${id}`;
    expect(linha.quem).toBe("Eduarda");
    expect(linha.antes).toEqual({ hora: "09:00" });
    expect(linha.depois).toEqual({ hora: "15:00" });
  });

  it("bloqueia depois de tentativas erradas seguidas e libera após acerto", async () => {
    const ip = `teste-${crypto.randomUUID()}`;
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) await registrarTentativa(ip, false);
    expect(await bloqueado(ip)).toBe(false);
    await registrarTentativa(ip, false);
    expect(await bloqueado(ip)).toBe(true);

    const ip2 = `teste-${crypto.randomUUID()}`;
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) await registrarTentativa(ip2, false);
    await registrarTentativa(ip2, true);
    await registrarTentativa(ip2, false);
    expect(await bloqueado(ip2)).toBe(false);
  });

  it("vem com as categorias e modalidades da Ddtrix", async () => {
    const cats = await sql`select codigo from categorias_servico order by codigo`;
    expect(cats.map((c) => c.codigo)).toEqual(["caixas", "dedet", "desr"]);
    const sufixos = await sql`select sufixo_os from modalidades_servico order by sufixo_os`;
    expect(sufixos.map((s) => s.sufixo_os)).toEqual(["CX", "DD", "DR", "EG", "FS", "GX"]);
  });

  it("não deixa repetir número de O.S.", async () => {
    const numero = `T${Date.now()}`;
    await sql`insert into ordens (numero, dados) values (${numero}, '{}')`;
    await expect(sql`insert into ordens (numero, dados) values (${numero}, '{}')`).rejects.toThrow();
  });
});
