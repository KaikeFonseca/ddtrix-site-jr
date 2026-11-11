"use client";

import { useEffect, useState } from "react";

export default function Entrar() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Só libera o botão depois que a página carregou de vez (evita envio antes da hora em celular lento).
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/entrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ usuario: form.get("usuario"), senha: form.get("senha") }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const corpo = await res.json().catch(() => ({}));
      setErro(corpo.erro ?? "Não foi possível entrar. Tente de novo.");
    } catch {
      setErro("Sem conexão com o sistema. Verifique a internet e tente de novo.");
    }
    setEnviando(false);
  }

  return (
    <main className="centro">
      <form className="formulario cartao" onSubmit={enviar}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ddtrix.jpg" alt="Ddtrix Desentupidora e Dedetizadora" />
        <h1 style={{ margin: 0, fontSize: 20 }}>Entrar no sistema</h1>
        <label>
          Usuário
          <input name="usuario" autoComplete="username" required autoFocus />
        </label>
        <label>
          Senha
          <input name="senha" type="password" autoComplete="current-password" required />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="botao" type="submit" disabled={!pronto || enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
