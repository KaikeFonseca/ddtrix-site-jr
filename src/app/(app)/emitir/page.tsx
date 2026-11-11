import Link from "next/link";
import { ColarAgenda } from "@/components/colar-agenda";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Emitir() {
  const agendas = await sql<{ id: string; criado_em: Date; criado_por: string | null; total: number; emitidas: number; primeira: string | null }[]>`
    select a.id, a.criado_em, a.criado_por,
      count(o.id)::int as total,
      count(o.id) filter (where o.status = 'emitida')::int as emitidas,
      min(o.cliente_nome) as primeira
    from agendas a left join ordens o on o.agenda_id = a.id
    group by a.id order by a.criado_em desc limit 12`;
  const formato = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Emitir O.S.</h1>
          <p className="sub">Cole a agenda. O sistema separa cada atendimento e monta as O.S.</p>
        </div>
      </div>
      <div className="inicio">
        <ColarAgenda grande />
        <section className="bloco" style={{ alignSelf: "start" }}>
          <h2 style={{ padding: "20px 20px 8px" }}>Agendas recentes</h2>
          {agendas.length === 0 ? (
            <p style={{ padding: "0 20px 20px", color: "var(--texto-3)" }}>Nenhuma agenda interpretada ainda.</p>
          ) : (
            <ul className="lista-simples">
              {agendas.map((a) => (
                <li key={a.id}>
                  <Link href={`/emitir/${a.id}`}>
                    <span>
                      <strong style={{ display: "block", fontWeight: 650 }}>
                        {a.total} {a.total === 1 ? "atendimento" : "atendimentos"}
                        {a.primeira ? ` · ${a.primeira}${a.total > 1 ? "…" : ""}` : ""}
                      </strong>
                      <span style={{ fontSize: 13, color: "var(--texto-3)" }}>
                        {formato.format(a.criado_em)}
                        {a.criado_por ? ` · ${a.criado_por}` : ""}
                      </span>
                    </span>
                    <span className={`etiqueta ${a.emitidas === a.total && a.total > 0 ? "etq-ok" : "etq-neutra"}`}>
                      {a.emitidas}/{a.total} emitidas
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
