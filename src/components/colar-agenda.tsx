"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icone } from "./icone";

export function ColarAgenda({ grande = false }: { grande?: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [podeColar, setPodeColar] = useState(false);
  // Antes de o JavaScript carregar, o formulário não funciona: deixa desabilitado.
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setPronto(true);
    setPodeColar(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
  }, []);

  async function colar() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setTexto(t);
    } catch {
      setErro("O navegador não deixou colar automaticamente. Toque no campo e cole.");
    }
  }

  async function interpretar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!texto.trim()) {
      setErro("Cole a agenda antes de interpretar.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/agendas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(corpo.erro ?? "Não foi possível interpretar a agenda.");
      router.push(`/emitir/${corpo.agendaId}`);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <form className="bloco colar" onSubmit={interpretar}>
      <div>
        <h2>Interpretar agenda</h2>
        <p className="sub">Cole a agenda do WhatsApp, com um ou vários clientes.</p>
      </div>
      <label className="rotulo" htmlFor="agenda" style={{ position: "absolute", left: -9999 }}>
        Agenda
      </label>
      <textarea
        id="agenda"
        className="entrada"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={"AGENDA (Quarta-Feira) 11/11\n1.\n📅 DATA: 11/11/2026\n👤 CLIENTE: …"}
        style={grande ? { minHeight: 260 } : undefined}
        spellCheck={false}
        disabled={!pronto}
      />
      {erro && <p className="erro" role="alert">{erro}</p>}
      <div className="colar-acoes">
        <button className="botao botao-primario" type="submit" disabled={enviando || !pronto}>
          {enviando ? <span className="carregando" aria-hidden="true" /> : <Icone nome="varinha" />}
          {enviando ? "Interpretando…" : "Interpretar"}
        </button>
        {podeColar && (
          <button className="botao botao-secundario" type="button" onClick={colar} disabled={enviando}>
            <Icone nome="colar" />
            Colar
          </button>
        )}
        {texto && !enviando && (
          <button className="botao botao-fantasma" type="button" onClick={() => setTexto("")}>
            Limpar
          </button>
        )}
      </div>
    </form>
  );
}
