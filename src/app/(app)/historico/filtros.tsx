"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icone } from "@/components/icone";

const CATEGORIAS = [
  ["", "Todas"],
  ["caixas", "Caixas"],
  ["dedet", "Dedetização"],
  ["desr", "Desratização"],
] as const;

/** Filtros do histórico na própria URL, para poder voltar e compartilhar a busca. */
export function FiltrosHistorico() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ir(mudar: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudar)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("pagina");
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current);
  }, []);

  const categoria = params.get("categoria") ?? "";
  const mostrarFiltros = !!(params.get("de") || params.get("ate") || params.get("situacao"));

  return (
    <div className="ferramentas" style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div className="busca">
          <Icone nome="lupa" />
          <label htmlFor="busca-historico" className="oculto">
            Buscar
          </label>
          <input
            id="busca-historico"
            className="entrada"
            type="search"
            placeholder="Buscar por cliente, número, serviço ou endereço"
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              if (espera.current) clearTimeout(espera.current);
              espera.current = setTimeout(() => ir({ q: v.trim() }), 300);
            }}
          />
        </div>
        <div className="filtros" role="group" aria-label="Categoria">
          {CATEGORIAS.map(([v, t]) => (
            <button key={v} type="button" className="filtro" aria-pressed={categoria === v} onClick={() => ir({ categoria: v })}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <details className="mais-filtros" open={mostrarFiltros}>
        <summary>Período e situação</summary>
        <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: 10 }}>
          <div className="campo">
            <label htmlFor="f-de">De</label>
            <input id="f-de" className="entrada" type="date" defaultValue={params.get("de") ?? ""} onChange={(e) => ir({ de: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="f-ate">Até</label>
            <input id="f-ate" className="entrada" type="date" defaultValue={params.get("ate") ?? ""} onChange={(e) => ir({ ate: e.target.value })} />
          </div>
          <div className="campo">
            <label htmlFor="f-situacao">Situação</label>
            <select id="f-situacao" className="entrada" defaultValue={params.get("situacao") ?? ""} onChange={(e) => ir({ situacao: e.target.value })}>
              <option value="">Todas</option>
              <option value="emitida">Emitidas</option>
              <option value="rascunho">Ainda não emitidas</option>
            </select>
          </div>
        </div>
      </details>
    </div>
  );
}
