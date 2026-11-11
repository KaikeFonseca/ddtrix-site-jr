import Link from "next/link";
import { notFound } from "next/navigation";
import { Icone } from "@/components/icone";
import { ListaOS } from "@/components/lista-os";
import { buscarCliente } from "@/lib/cadastro-clientes";
import { buscarHistorico } from "@/lib/historico";
import { configuracoesOS } from "@/lib/os/servico";
import { Enderecos } from "../enderecos";
import { FormCliente } from "../form-cliente";

export const dynamic = "force-dynamic";

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await buscarCliente(id);
  if (!cliente) notFound();
  const [{ itens, total }, config] = await Promise.all([buscarHistorico({ clienteId: id }), configuracoesOS()]);

  return (
    <>
      <Link href="/clientes" className="botao botao-fantasma" style={{ margin: "-8px 0 8px -12px" }}>
        <Icone nome="voltar" />
        Clientes
      </Link>
      <div className="titulo-tela">
        <div>
          <h1>{cliente.nome}</h1>
          <p className="sub">
            Cliente desde {cliente.criadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {total === 1 ? "1 O.S." : `${total} O.S.`}
          </p>
        </div>
      </div>
      <div className="ficha">
        <div style={{ display: "grid", gap: 20 }}>
          <FormCliente id={cliente.id} inicial={{ nome: cliente.nome, telefones: cliente.telefones, observacoes: cliente.observacoes }} cidadePadrao={config.cidadePadrao} />
          <Enderecos clienteId={cliente.id} enderecos={cliente.enderecos} cidadePadrao={config.cidadePadrao} />
        </div>
        <section className="bloco">
          <div className="secao" style={{ paddingBottom: 8 }}>
            <h2>Serviços feitos</h2>
          </div>
          {itens.length ? (
            <div className="lista-compacta">
              <ListaOS itens={itens} mostrarCliente={false} />
            </div>
          ) : (
            <div className="vazio">
              <p>Nenhuma O.S. emitida para este cliente ainda.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
