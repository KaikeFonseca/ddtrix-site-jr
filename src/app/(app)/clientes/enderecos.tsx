"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icone } from "@/components/icone";
import type { Endereco } from "@/lib/cadastro-clientes";

type Edicao = { rua: string; bairro: string; cidade: string; referencia: string };

const vazio = (cidade: string): Edicao => ({ rua: "", bairro: "", cidade, referencia: "" });

/** Endereços do cliente. Nada muda sozinho: só quem edita aqui altera. */
export function Enderecos({ clienteId, enderecos, cidadePadrao }: { clienteId: string; enderecos: Endereco[]; cidadePadrao: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [valores, setValores] = useState<Edicao>(vazio(cidadePadrao));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(url: string, method: string, corpo?: unknown) {
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.erro ?? "Não foi possível salvar.");
      setEditando(null);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  function abrir(e: Endereco | null) {
    setErro(null);
    setEditando(e ? e.id : "novo");
    setValores(e ? { rua: e.rua, bairro: e.bairro ?? "", cidade: e.cidade, referencia: e.referencia ?? "" } : vazio(cidadePadrao));
  }

  function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    const corpo = { rua: valores.rua, bairro: valores.bairro || null, cidade: valores.cidade, referencia: valores.referencia || null };
    if (editando === "novo") chamar(`/api/clientes/${clienteId}/enderecos`, "POST", corpo);
    else chamar(`/api/clientes/${clienteId}/enderecos/${editando}`, "PATCH", corpo);
  }

  const formulario = (
    <form className="versao" onSubmit={salvar}>
      <div className="campo">
        <label htmlFor="ed-rua">Rua e número</label>
        <input id="ed-rua" className="entrada" value={valores.rua} onChange={(e) => setValores({ ...valores, rua: e.target.value })} required autoFocus />
      </div>
      <div className="grade">
        <div className="campo">
          <label htmlFor="ed-bairro">Bairro</label>
          <input id="ed-bairro" className="entrada" value={valores.bairro} onChange={(e) => setValores({ ...valores, bairro: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor="ed-cidade">Cidade</label>
          <input id="ed-cidade" className="entrada" value={valores.cidade} onChange={(e) => setValores({ ...valores, cidade: e.target.value })} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="ed-ref">Ponto de referência</label>
        <input id="ed-ref" className="entrada" value={valores.referencia} onChange={(e) => setValores({ ...valores, referencia: e.target.value })} />
      </div>
      <div className="barra-acoes">
        <button type="button" className="botao botao-fantasma" onClick={() => setEditando(null)}>
          Cancelar
        </button>
        <button type="submit" className="botao botao-primario" disabled={ocupado}>
          {ocupado ? <span className="carregando" /> : null}
          Salvar endereço
        </button>
      </div>
    </form>
  );

  return (
    <section className="bloco secao">
      <div className="secao-topo">
        <h2>Endereços</h2>
        {editando === null && (
          <button type="button" className="botao botao-secundario" onClick={() => abrir(null)}>
            <Icone nome="mais" />
            Adicionar
          </button>
        )}
      </div>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {editando === "novo" && formulario}
      {enderecos.length === 0 && editando !== "novo" && <p className="suave">Nenhum endereço cadastrado.</p>}
      {enderecos.map((e) =>
        editando === e.id ? (
          <div key={e.id}>{formulario}</div>
        ) : (
          <div className="endereco-item" key={e.id}>
            <div style={{ minWidth: 0 }}>
              <div className="r">
                {e.rua} {e.principal && <span className="etiqueta etq-ok" style={{ marginLeft: 6 }}>Principal</span>}
              </div>
              <div className="d">{[e.bairro, e.cidade].filter(Boolean).join(" · ")}</div>
              {e.referencia && <div className="d">Referência: {e.referencia}</div>}
            </div>
            <div className="meta acoes-os">
              {!e.principal && (
                <button type="button" className="botao botao-fantasma botao-icone" aria-label="Tornar principal" title="Tornar principal" disabled={ocupado} onClick={() => chamar(`/api/clientes/${clienteId}/enderecos/${e.id}`, "PATCH", { principal: true })}>
                  <Icone nome="estrela" />
                </button>
              )}
              <button type="button" className="botao botao-fantasma botao-icone" aria-label="Editar endereço" title="Editar" disabled={ocupado} onClick={() => abrir(e)}>
                <Icone nome="lapis" />
              </button>
              <button
                type="button"
                className="botao botao-fantasma botao-icone"
                aria-label="Remover endereço"
                title="Remover"
                disabled={ocupado}
                onClick={() => window.confirm(`Remover o endereço "${e.rua}"? As O.S. já emitidas não mudam.`) && chamar(`/api/clientes/${clienteId}/enderecos/${e.id}`, "DELETE")}
              >
                <Icone nome="lixo" />
              </button>
            </div>
          </div>
        ),
      )}
    </section>
  );
}
