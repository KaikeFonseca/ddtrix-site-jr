"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone, type NomeIcone } from "./icone";
import { Sincronizar } from "./sincronizar";

const MENU: { href: string; titulo: string; curto: string; icone: NomeIcone; celular: boolean }[] = [
  { href: "/", titulo: "Início", curto: "Início", icone: "casa", celular: true },
  { href: "/emitir", titulo: "Emitir O.S.", curto: "Emitir", icone: "doc", celular: true },
  { href: "/clientes", titulo: "Clientes", curto: "Clientes", icone: "pessoas", celular: true },
  { href: "/historico", titulo: "Histórico", curto: "Histórico", icone: "relogio", celular: true },
  { href: "/administracao", titulo: "Administração", curto: "Admin.", icone: "engrenagem", celular: false },
];

function ativo(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/emitir") return pathname.startsWith("/emitir") || pathname.startsWith("/os/");
  return pathname.startsWith(href);
}

export function Casca({ quem, children }: { quem: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="casca">
      <header className="topo">
        <div className="topo-linha">
          <Link className="marca" href="/" aria-label="Início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-ddtrix.png" alt="Ddtrix Desentupidora e Dedetizadora" width={100} height={42} />
          </Link>
          <nav className="nav" aria-label="Menu">
            {MENU.map((m) => (
              <Link key={m.href} href={m.href} aria-current={ativo(pathname, m.href) ? "page" : undefined}>
                {m.titulo}
              </Link>
            ))}
          </nav>
          <Link className="quem" href="/quem" title="Trocar quem está usando" style={{ textDecoration: "none" }}>
            <span className="nome">{quem}</span>
            <span className="avatar" aria-label={`Usando: ${quem ?? ""}`}>{(quem ?? "?").trim().charAt(0).toUpperCase()}</span>
          </Link>
        </div>
        <div className="listras" aria-hidden="true" />
      </header>
      <Sincronizar />
      <main>{children}</main>
      <nav className="abas" aria-label="Menu">
        {MENU.filter((m) => m.celular).map((m) => (
          <Link key={m.href} href={m.href} aria-current={ativo(pathname, m.href) ? "page" : undefined}>
            <Icone nome={m.icone} />
            {m.curto}
          </Link>
        ))}
      </nav>
    </div>
  );
}
