"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icone } from "@/components/icone";
import type { CategoriaAdm, ModalidadeAdm } from "@/lib/administracao";
import type { Categoria } from "@/lib/os/agenda";

const paraLista = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

async function chamar(url: string, method: string, corpo: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  const r = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(r.erro ?? "Não foi possível salvar.");
}

export function CategoriasAdm({ categorias, modalidades }: { categorias: CategoriaAdm[]; modalidades: ModalidadeAdm[] }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <p className="sub" style={{ margin: 0 }}>
        As palavras-chave ensinam o sistema a reconhecer o serviço na agenda. O sufixo entra no número da O.S. (ex.: 20261111<b>CX</b>).
      </p>
      {categorias.map((c) => (
        <CartaoCategoria key={c.codigo} categoria={c} modalidades={modalidades.filter((m) => m.categoria === c.codigo)} />
      ))}
    </div>
  );
}

function CartaoCategoria({ categoria, modalidades }: { categoria: CategoriaAdm; modalidades: ModalidadeAdm[] }) {
  const router = useRouter();
  const [nome, setNome] = useState(categoria.nome);
  const [palavras, setPalavras] = useState(categoria.palavras.join(", "));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [nova, setNova] = useState(false);
  const mudou = nome !== categoria.nome || JSON.stringify(paraLista(palavras)) !== JSON.stringify(categoria.palavras);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await chamar(`/api/admin/categorias/${categoria.codigo}`, "PATCH", { nome, palavras: paraLista(palavras) });
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  return (
    <section className="bloco secao">
      <form style={{ display: "grid", gap: 12 }} onSubmit={salvar}>
        <div className="grade">
          <div className="campo">
            <label htmlFor={`cat-${categoria.codigo}`}>Categoria</label>
            <input id={`cat-${categoria.codigo}`} className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor={`catp-${categoria.codigo}`}>Palavras-chave (separe por vírgula)</label>
            <input id={`catp-${categoria.codigo}`} className="entrada" value={palavras} onChange={(e) => setPalavras(e.target.value)} />
          </div>
        </div>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        {mudou && (
          <div className="barra-acoes">
            <button type="submit" className="botao botao-primario" disabled={ocupado}>
              Salvar categoria
            </button>
          </div>
        )}
      </form>
      <div style={{ display: "grid", gap: 10 }}>
        <div className="secao-topo">
          <h3 style={{ margin: 0, fontSize: 15 }}>Serviços desta categoria</h3>
          {!nova && (
            <button type="button" className="botao botao-fantasma" onClick={() => setNova(true)}>
              <Icone nome="mais" />
              Novo serviço
            </button>
          )}
        </div>
        {modalidades.map((m) => (
          <LinhaModalidade key={m.id} m={m} />
        ))}
        {nova && <LinhaModalidade categoria={categoria.codigo} aoFechar={() => setNova(false)} />}
      </div>
    </section>
  );
}

function LinhaModalidade({ m, categoria, aoFechar }: { m?: ModalidadeAdm; categoria?: Categoria; aoFechar?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ nome: m?.nome ?? "", sufixo: m?.sufixo ?? "", palavras: (m?.palavras ?? []).join(", "), ativa: m?.ativa ?? true });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const mudou = !m || v.nome !== m.nome || v.sufixo !== m.sufixo || v.ativa !== m.ativa || JSON.stringify(paraLista(v.palavras)) !== JSON.stringify(m.palavras);
  const id = m?.id ?? `nova-${categoria}`;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const corpo = { nome: v.nome, sufixo: v.sufixo, palavras: paraLista(v.palavras), ativa: v.ativa };
      if (m) await chamar(`/api/admin/modalidades/${m.id}`, "PATCH", corpo);
      else await chamar("/api/admin/modalidades", "POST", { ...corpo, categoria });
      aoFechar?.();
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  return (
    <form className="versao" onSubmit={salvar} style={!v.ativa ? { opacity: 0.7 } : undefined}>
      <div className="grade" style={{ gridTemplateColumns: "minmax(0, 2fr) 90px" }}>
        <div className="campo">
          <label htmlFor={`${id}-nome`}>Serviço</label>
          <input id={`${id}-nome`} className="entrada" value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
        </div>
        <div className="campo">
          <label htmlFor={`${id}-suf`}>Sufixo</label>
          <input id={`${id}-suf`} className="entrada" maxLength={2} value={v.sufixo} onChange={(e) => setV({ ...v, sufixo: e.target.value.toUpperCase() })} style={{ textTransform: "uppercase" }} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor={`${id}-pal`}>Palavras-chave (separe por vírgula)</label>
        <input id={`${id}-pal`} className="entrada" value={v.palavras} onChange={(e) => setV({ ...v, palavras: e.target.value })} />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
        <input type="checkbox" checked={v.ativa} onChange={(e) => setV({ ...v, ativa: e.target.checked })} />
        Em uso
      </label>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {mudou && (
        <div className="barra-acoes">
          {aoFechar && (
            <button type="button" className="botao botao-fantasma" onClick={aoFechar}>
              Cancelar
            </button>
          )}
          <button type="submit" className="botao botao-primario" disabled={ocupado}>
            {m ? "Salvar serviço" : "Adicionar serviço"}
          </button>
        </div>
      )}
    </form>
  );
}
