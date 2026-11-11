import Link from "next/link";
import { quemEsta } from "@/lib/quem-servidor";
import { Topo } from "./topo";

export async function EmConstrucao({ titulo }: { titulo: string }) {
  const quem = await quemEsta();
  return (
    <>
      <Topo quem={quem} />
      <main className="pagina">
        <h1 style={{ marginTop: 0 }}>{titulo}</h1>
        <p className="suave">Esta parte ainda está sendo construída.</p>
        <Link href="/">Voltar ao início</Link>
      </main>
    </>
  );
}
