import Link from "next/link";
import type { LinhaHistorico } from "@/lib/historico";
import { CLASSE_CATEGORIA, etiquetaServico, horaCurta } from "@/lib/os/rotulos";
import { AcoesOS } from "./acoes-os";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function tituloDoDia(iso: string | null): string {
  if (!iso) return "Sem data";
  const [a, m, d] = iso.split("-").map(Number);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${dia}, ${d} de ${MESES[m - 1]} de ${a}`;
}

/** Lista de O.S. agrupada por dia, com ações (histórico e ficha do cliente). */
export function ListaOS({ itens, mostrarCliente = true }: { itens: LinhaHistorico[]; mostrarCliente?: boolean }) {
  const grupos: { data: string | null; itens: LinhaHistorico[] }[] = [];
  for (const i of itens) {
    const g = grupos.at(-1);
    if (g && g.data === i.data) g.itens.push(i);
    else grupos.push({ data: i.data, itens: [i] });
  }
  return (
    <>
      <div className="cabecalho-lista cab-hist">
        <span>Número</span>
        <span>{mostrarCliente ? "Cliente" : "Endereço"}</span>
        <span>Serviço</span>
        <span>Por</span>
        <span />
      </div>
      {grupos.map((g) => (
        <section key={g.data ?? "sem-data"}>
          <div className="grupo-data">{tituloDoDia(g.data)}</div>
          <ul className="lista lista-hist">
            {g.itens.map((i) => (
              <li key={i.id}>
                <span className="so-pc">{i.numero ? <span className="numero-os">{i.numero}</span> : <span className="suave">sem número</span>}</span>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/os/${i.id}`} className="t link-limpo">
                    {mostrarCliente ? (i.cliente ?? "Cliente não identificado") : i.endereco || "Sem endereço"}
                  </Link>
                  <div className="d">
                    <span className="so-celular">{i.numero ?? "sem número"} · </span>
                    {horaCurta(i.hora)}
                    {mostrarCliente && i.endereco ? ` · ${i.endereco}` : ""}
                  </div>
                  <div className="chips so-celular" style={{ marginTop: 6 }}>
                    <span className={`etiqueta ${i.categoria ? CLASSE_CATEGORIA[i.categoria] : "etq-pend"}`}>{etiquetaServico(i.categoria, i.sufixo)}</span>
                    {i.status !== "emitida" && <span className="etiqueta etq-pend">Não emitida</span>}
                  </div>
                </div>
                <div className="d so-pc">
                  <span className={`etiqueta ${i.categoria ? CLASSE_CATEGORIA[i.categoria] : "etq-pend"}`}>{etiquetaServico(i.categoria, i.sufixo)}</span>
                  {i.status !== "emitida" && (
                    <span className="etiqueta etq-pend" style={{ marginLeft: 6 }}>
                      Não emitida
                    </span>
                  )}
                  <div style={{ marginTop: 4 }}>{i.servico}</div>
                </div>
                <div className="d so-pc">{i.criadoPor ?? "—"}</div>
                <AcoesOS id={i.id} numero={i.numero} cliente={i.cliente} emitida={i.status === "emitida"} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
