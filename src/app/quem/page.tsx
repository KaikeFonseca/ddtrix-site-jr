"use client";

import { useEffect, useState } from "react";

const CHAVE_NOMES = "ddtrix_nomes_recentes";

export default function QuemEstaUsando() {
  const [recentes, setRecentes] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Só libera o botão depois que a página carregou de vez (evita envio antes da hora em celular lento).
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);

  useEffect(() => {
    try {
      setRecentes(JSON.parse(localStorage.getItem(CHAVE_NOMES) ?? "[]"));
    } catch {
      setRecentes([]);
    }
  }, []);

  async function escolher(valor: string) {
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/quem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: valor }),
      });
      const corpo = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(corpo.erro ?? "Não foi possível salvar o nome.");
        setEnviando(false);
        return;
      }
      try {
        const lista = [corpo.nome, ...recentes.filter((n) => n !== corpo.nome)].slice(0, 5);
        localStorage.setItem(CHAVE_NOMES, JSON.stringify(lista));
      } catch {
        // sem armazenamento local: tudo bem, o nome já ficou no cookie
      }
      window.location.href = "/";
    } catch {
      setErro("Sem conexão com o sistema. Verifique a internet e tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <main className="centro">
      <form
        className="formulario cartao"
        onSubmit={(e) => {
          e.preventDefault();
          escolher(String(new FormData(e.currentTarget).get("nome") ?? ""));
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Quem está usando?</h1>
        <p className="suave" style={{ margin: 0 }}>
          Seu nome fica salvo neste aparelho e aparece no histórico de alterações.
        </p>
        {recentes.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recentes.map((n) => (
              <button key={n} type="button" className="botao" disabled={enviando} onClick={() => escolher(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
        <label>
          Seu nome
          <input name="nome" autoComplete="name" required minLength={2} maxLength={60} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" type="submit" disabled={!pronto || enviando}>
          Continuar
        </button>
      </form>
    </main>
  );
}
