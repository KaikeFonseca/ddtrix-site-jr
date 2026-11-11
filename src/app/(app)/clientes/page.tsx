import Link from "next/link";
import { Icone } from "@/components/icone";
import { listarClientes } from "@/lib/cadastro-clientes";
import { BuscaClientes } from "./busca";

export const dynamic = "force-dynamic";

const dataCurta = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const clientes = await listarClientes(q);
  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Clientes</h1>
          <p className="sub">Cadastro compartilhado. Quem atende vê os mesmos dados.</p>
        </div>
        <Link className="botao botao-primario" href="/clientes/novo">
          <Icone nome="mais" />
          Novo cliente
        </Link>
      </div>
      <BuscaClientes inicial={q} />
      <div className="bloco">
        {clientes.length ? (
          <>
            <div className="cabecalho-lista cab-clientes">
              <span>Cliente</span>
              <span>Endereço principal</span>
              <span>Último serviço</span>
              <span />
            </div>
            <ul className="lista lista-clientes">
              {clientes.map((c) => (
                <li key={c.id}>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/clientes/${c.id}`} className="t link-limpo">
                      {c.nome}
                    </Link>
                    <div className="d">
                      {c.telefones[0] ?? "Sem telefone"}
                      <span className="so-celular">{c.endereco ? ` · ${c.endereco}` : ""}</span>
                    </div>
                  </div>
                  <div className="d so-pc">
                    {c.endereco ?? "Sem endereço"}
                    {c.enderecos > 1 ? ` (+${c.enderecos - 1})` : ""}
                  </div>
                  <div className="d so-pc">
                    {dataCurta(c.ultima)} · {c.ordens === 1 ? "1 O.S." : `${c.ordens} O.S.`}
                  </div>
                  <div className="meta">
                    <Link className="botao botao-fantasma botao-icone" href={`/clientes/${c.id}`} aria-label={`Abrir ${c.nome}`}>
                      <Icone nome="lapis" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="vazio">
            <h3>{q ? "Nenhum cliente encontrado" : "Ainda não há clientes"}</h3>
            <p>{q ? "Confira o nome ou busque pelo telefone ou pela rua." : "Os clientes entram aqui sozinhos quando a primeira O.S. deles é emitida."}</p>
          </div>
        )}
      </div>
    </>
  );
}
