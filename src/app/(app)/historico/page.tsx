import Link from "next/link";
import { Suspense } from "react";
import { ListaOS } from "@/components/lista-os";
import { buscarHistorico, POR_PAGINA, type FiltroHistorico } from "@/lib/historico";
import { FiltrosHistorico } from "./filtros";

export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Historico({ searchParams }: { searchParams: Promise<Busca> }) {
  const p = await searchParams;
  const filtro: FiltroHistorico = {
    q: um(p.q),
    categoria: (["caixas", "dedet", "desr"].includes(um(p.categoria)) ? um(p.categoria) : "") as FiltroHistorico["categoria"],
    de: um(p.de),
    ate: um(p.ate),
    situacao: (["emitida", "rascunho"].includes(um(p.situacao)) ? um(p.situacao) : "") as FiltroHistorico["situacao"],
    pagina: Number(um(p.pagina)) || 1,
  };
  const { itens, total } = await buscarHistorico(filtro);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(filtro.pagina ?? 1, paginas);
  const linkPagina = (n: number) => {
    const q = new URLSearchParams(Object.entries(p).flatMap(([k, v]) => (k === "pagina" || !um(v) ? [] : [[k, um(v)]])));
    if (n > 1) q.set("pagina", String(n));
    return `/historico${q.size ? `?${q}` : ""}`;
  };
  const filtrando = !!(filtro.q || filtro.categoria || filtro.de || filtro.ate || filtro.situacao);

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Histórico</h1>
          <p className="sub">
            {total === 0 ? "Nenhuma O.S." : total === 1 ? "1 O.S." : `${total} O.S.`}
            {filtrando ? " encontradas com esses filtros" : " no sistema"}
          </p>
        </div>
      </div>
      <Suspense>
        <FiltrosHistorico />
      </Suspense>
      <div className="bloco">
        {itens.length ? (
          <ListaOS itens={itens} />
        ) : (
          <div className="vazio">
            <h3>{filtrando ? "Nada encontrado" : "Ainda não há O.S."}</h3>
            <p>{filtrando ? "Tente outro nome, número ou tire algum filtro." : "As O.S. aparecem aqui assim que uma agenda é interpretada."}</p>
          </div>
        )}
      </div>
      {paginas > 1 && (
        <nav className="paginacao" aria-label="Páginas">
          {pagina > 1 ? <Link className="botao botao-secundario" href={linkPagina(pagina - 1)}>Anteriores</Link> : <span />}
          <span className="suave">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? <Link className="botao botao-secundario" href={linkPagina(pagina + 1)}>Próximas</Link> : <span />}
        </nav>
      )}
    </>
  );
}
