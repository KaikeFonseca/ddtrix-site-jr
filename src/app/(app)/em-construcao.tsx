import Link from "next/link";

export function EmConstrucao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>{titulo}</h1>
          <p className="sub">{texto}</p>
        </div>
      </div>
      <div className="bloco vazio">
        <h3>Esta parte entra na próxima etapa</h3>
        <p>
          Enquanto isso, as O.S. são emitidas em <Link href="/emitir">Emitir O.S.</Link>
        </p>
      </div>
    </>
  );
}
