"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icone } from "@/components/icone";

export type ValoresCliente = { nome: string; telefones: string[]; observacoes: string | null };

async function enviar(url: string, method: string, corpo: unknown): Promise<{ id?: string }> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(r.erro ?? "Não foi possível salvar.");
  return r;
}

/** Dados do cliente (nome, telefones, observações). Sem id, cria um cliente novo com o primeiro endereço. */
export function FormCliente({ id, inicial, cidadePadrao }: { id?: string; inicial: ValoresCliente; cidadePadrao: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial.nome);
  const [telefones, setTelefones] = useState(inicial.telefones.length ? inicial.telefones : [""]);
  const [obs, setObs] = useState(inicial.observacoes ?? "");
  const [end, setEnd] = useState({ rua: "", bairro: "", cidade: cidadePadrao, referencia: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Alguém mudou o cadastro em outro aparelho: atualiza o formulário se não houver edição em andamento.
  const ultimoInicial = useRef(inicial);
  useEffect(() => {
    const ant = ultimoInicial.current;
    if (JSON.stringify(ant) === JSON.stringify(inicial)) return;
    ultimoInicial.current = inicial;
    const limpo = (t: string[]) => JSON.stringify(t.map((x) => x.trim()).filter(Boolean));
    const semEdicao = nome === ant.nome && limpo(telefones) === JSON.stringify(ant.telefones) && (obs.trim() || null) === (ant.observacoes ?? null);
    const igualAoNovo = nome === inicial.nome && limpo(telefones) === JSON.stringify(inicial.telefones) && (obs.trim() || null) === (inicial.observacoes ?? null);
    if (semEdicao && !igualAoNovo) {
      setNome(inicial.nome);
      setTelefones(inicial.telefones.length ? inicial.telefones : [""]);
      setObs(inicial.observacoes ?? "");
    }
  }, [inicial, nome, telefones, obs]);

  const mudou =
    !id ||
    nome !== inicial.nome ||
    JSON.stringify(telefones.map((t) => t.trim()).filter(Boolean)) !== JSON.stringify(inicial.telefones) ||
    (obs.trim() || null) !== (inicial.observacoes ?? null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    setSalvando(true);
    const dados = { nome, telefones: telefones.map((t) => t.trim()).filter(Boolean), observacoes: obs.trim() || null };
    try {
      if (id) {
        await enviar(`/api/clientes/${id}`, "PATCH", dados);
        setOk(true);
        router.refresh();
      } else {
        const r = await enviar("/api/clientes", "POST", {
          ...dados,
          endereco: end.rua.trim() ? { rua: end.rua, bairro: end.bairro || null, cidade: end.cidade, referencia: end.referencia || null } : null,
        });
        router.push(`/clientes/${r.id}`);
        return;
      }
    } catch (e) {
      setErro((e as Error).message);
    }
    setSalvando(false);
  }

  return (
    <form className="bloco secao" onSubmit={salvar}>
      <h2>{id ? "Dados do cliente" : "Novo cliente"}</h2>
      <div className="campo">
        <label htmlFor="c-nome">Nome</label>
        <input id="c-nome" className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </div>
      <div className="campo">
        <span className="rotulo">Telefones</span>
        {telefones.map((t, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              className="entrada"
              inputMode="tel"
              aria-label={`Telefone ${i + 1}`}
              value={t}
              placeholder="(15) 99999-9999"
              onChange={(e) => setTelefones(telefones.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {telefones.length > 1 && (
              <button type="button" className="botao botao-fantasma botao-icone" aria-label="Remover telefone" onClick={() => setTelefones(telefones.filter((_, j) => j !== i))}>
                <Icone nome="x" />
              </button>
            )}
          </div>
        ))}
        <button type="button" className="botao botao-fantasma" style={{ justifySelf: "start" }} onClick={() => setTelefones([...telefones, ""])}>
          <Icone nome="mais" />
          Outro telefone
        </button>
      </div>
      <div className="campo">
        <label htmlFor="c-obs">Observações importantes</label>
        <textarea id="c-obs" className="entrada" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: portão azul, falar com o zelador" />
      </div>

      {!id && (
        <>
          <h3 style={{ margin: "6px 0 0", fontSize: 16 }}>Endereço</h3>
          <div className="campo">
            <label htmlFor="e-rua">Rua e número</label>
            <input id="e-rua" className="entrada" value={end.rua} onChange={(e) => setEnd({ ...end, rua: e.target.value })} />
          </div>
          <div className="grade">
            <div className="campo">
              <label htmlFor="e-bairro">Bairro</label>
              <input id="e-bairro" className="entrada" value={end.bairro} onChange={(e) => setEnd({ ...end, bairro: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="e-cidade">Cidade</label>
              <input id="e-cidade" className="entrada" value={end.cidade} onChange={(e) => setEnd({ ...end, cidade: e.target.value })} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="e-ref">Ponto de referência</label>
            <input id="e-ref" className="entrada" value={end.referencia} onChange={(e) => setEnd({ ...end, referencia: e.target.value })} />
          </div>
        </>
      )}

      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {ok && !mudou && (
        <p className="aviso aviso-ok" role="status">
          <Icone nome="check" />
          <span>Salvo.</span>
        </p>
      )}
      <div className="barra-acoes">
        <button type="submit" className="botao botao-primario" disabled={salvando || !mudou || !nome.trim()}>
          {salvando ? <span className="carregando" /> : null}
          {id ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
      </div>
    </form>
  );
}
