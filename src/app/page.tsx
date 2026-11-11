import Link from "next/link";
import { quemEsta } from "@/lib/quem-servidor";
import { Topo } from "./topo";

// Tela inicial provisória. O layout definitivo sai da proposta visual (etapa 2).
const ATALHOS = [
  { href: "/emitir", titulo: "Emitir O.S.", texto: "Colar a agenda e gerar as ordens" },
  { href: "/clientes", titulo: "Clientes", texto: "Cadastro e endereços" },
  { href: "/historico", titulo: "Histórico", texto: "O.S. emitidas" },
  { href: "/administracao", titulo: "Administração", texto: "Modelos, categorias e configurações" },
];

export default async function Inicio() {
  const quem = await quemEsta();
  return (
    <>
      <Topo quem={quem} />
      <main className="pagina">
        <h1 style={{ margin: 0 }}>Olá, {quem}</h1>
        <p className="suave">O que vamos fazer agora?</p>
        <nav className="atalhos" aria-label="Menu principal">
          {ATALHOS.map((a) => (
            <Link key={a.href} href={a.href} className="atalho">
              <strong>{a.titulo}</strong>
              <span>{a.texto}</span>
            </Link>
          ))}
        </nav>
      </main>
    </>
  );
}
