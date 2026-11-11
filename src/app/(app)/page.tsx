import Link from "next/link";
import { ColarAgenda } from "@/components/colar-agenda";
import { Icone } from "@/components/icone";
import { sql } from "@/lib/db";
import { hojeEmSaoPaulo } from "@/lib/os/servico";
import { horaCurta } from "@/lib/os/rotulos";
import { pendenciasDe, type DadosOrdem } from "@/lib/os/tipos";
import { quemEsta } from "@/lib/quem-servidor";

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function saudacao(): string {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function Inicio() {
  const quem = await quemEsta();
  const hoje = hojeEmSaoPaulo();
  const iso = `${hoje.ano}-${String(hoje.mes).padStart(2, "0")}-${String(hoje.dia).padStart(2, "0")}`;
  const diaSemana = DIAS[new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia)).getUTCDay()];

  const ordens = await sql<{ id: string; status: string; dados: DadosOrdem }[]>`
    select id, status, dados from ordens where data_execucao = ${iso}
    order by hora nulls last, criado_em limit 30`;
  const [{ clientes }] = await sql<{ clientes: number }[]>`select count(*)::int as clientes from clientes`;

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>
            {saudacao()}, {quem}
          </h1>
          <p className="sub">
            {diaSemana}, {hoje.dia} de {MESES[hoje.mes - 1]}
          </p>
        </div>
      </div>
      <div className="inicio">
        <ColarAgenda />
        <div className="lado">
          <nav className="atalhos" aria-label="Atalhos">
            <Link className="atalho" href="/clientes">
              <span className="ico"><Icone nome="pessoas" /></span>
              <strong>Clientes</strong>
              <span>{clientes === 1 ? "1 cadastrado" : `${clientes} cadastrados`}</span>
            </Link>
            <Link className="atalho" href="/historico">
              <span className="ico"><Icone nome="relogio" /></span>
              <strong>Histórico</strong>
              <span>O.S. emitidas</span>
            </Link>
            <Link className="atalho" href="/administracao">
              <span className="ico"><Icone nome="engrenagem" /></span>
              <strong>Admin.</strong>
              <span>Modelos e ajustes</span>
            </Link>
          </nav>
          <section className="bloco hoje">
            <div className="hoje-topo">
              <h2>Hoje</h2>
              <Link href="/emitir">Ver agendas</Link>
            </div>
            {ordens.length === 0 ? (
              <p className="suave" style={{ color: "var(--texto-3)", padding: "8px 0" }}>Nenhuma O.S. para hoje ainda.</p>
            ) : (
              <ul className="mini-lista">
                {ordens.map((o) => {
                  const pend = o.status !== "emitida" && pendenciasDe(o.dados).length > 0;
                  return (
                    <li key={o.id}>
                      <span className="hora">{horaCurta(o.dados.hora)}</span>
                      <Link href={`/os/${o.id}`} style={{ textDecoration: "none" }}>
                        <div className="cli">{o.dados.cliente ?? "Sem nome"}</div>
                        <div className="srv">{o.dados.servico}</div>
                      </Link>
                      <span className={`etiqueta ${o.status === "emitida" ? "etq-ok" : pend ? "etq-pend" : "etq-neutra"}`}>
                        {o.status === "emitida" ? "Emitida" : pend ? "Pendência" : "Pronta"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
