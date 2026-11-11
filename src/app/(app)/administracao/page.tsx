import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Linha = { id: string; quando: Date; quem: string | null; acao: string; entidade: string };

// Por enquanto mostra só o histórico de alterações (quem mudou o quê e quando).
// Modelos, categorias e configurações entram na etapa 4.
export default async function Administracao() {
  const linhas = await sql<Linha[]>`
    select id::text, quando, quem, acao, entidade from auditoria order by quando desc limit 50`;
  const formato = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
  return (
    <>
        <div className="titulo-tela"><div><h1>Administração</h1><p className="sub">Modelos, categorias e configurações entram na próxima etapa.</p></div></div>
        <section className="bloco" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Histórico de alterações</h2>
          {linhas.length === 0 ? (
            <p className="suave">Nada registrado ainda.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>Quando</th><th>Quem</th><th>O quê</th></tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id}>
                      <td>{formato.format(l.quando)}</td>
                      <td>{l.quem ?? "—"}</td>
                      <td>{l.acao} · {l.entidade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
    </>
  );
}
