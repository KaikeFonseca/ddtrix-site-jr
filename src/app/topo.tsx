"use client";

import Link from "next/link";

export function Topo({ quem }: { quem: string | null }) {
  async function sair() {
    await fetch("/api/sair", { method: "POST" });
    window.location.href = "/entrar";
  }
  return (
    <header className="topo">
      <Link href="/" aria-label="Início">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ddtrix.jpg" alt="Ddtrix" />
      </Link>
      <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14 }}>
        <Link href="/quem" className="suave">{quem ?? "Quem está usando?"}</Link>
        <button type="button" className="botao-texto" onClick={sair}>Sair</button>
      </div>
    </header>
  );
}
