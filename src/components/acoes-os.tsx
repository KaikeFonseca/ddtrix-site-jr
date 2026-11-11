"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { baixarArquivo, compartilharArquivo, imprimirArquivo, pedirArquivo } from "@/lib/baixar";
import { Icone } from "./icone";

/** Ações de uma O.S. numa lista: baixar, imprimir e enviar (só emitidas) e criar uma nova a partir dela. */
export function AcoesOS({ id, numero, cliente, emitida }: { id: string; numero: string | null; cliente: string | null; emitida: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<null | "pdf" | "imprimir" | "whats" | "nova">(null);
  const [erro, setErro] = useState<string | null>(null);

  async function arquivo(acao: "pdf" | "imprimir" | "whats") {
    setErro(null);
    setOcupado(acao);
    try {
      const { arquivo } = await pedirArquivo([id], "pdf");
      if (acao === "pdf") baixarArquivo(arquivo);
      else if (acao === "imprimir") imprimirArquivo(arquivo);
      else await compartilharArquivo(arquivo, `O.S. ${numero ?? ""} · ${cliente ?? ""}`);
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(null);
  }

  async function nova() {
    setErro(null);
    setOcupado("nova");
    try {
      const res = await fetch(`/api/os/${id}/reaproveitar`, { method: "POST" });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.erro ?? "Não foi possível criar a nova O.S.");
      router.push(`/os/${r.id}`);
    } catch (e) {
      setErro((e as Error).message);
      setOcupado(null);
    }
  }

  const icone = (a: typeof ocupado, nome: Parameters<typeof Icone>[0]["nome"]) => (ocupado === a ? <span className="carregando" /> : <Icone nome={nome} />);

  return (
    <div className="meta acoes-os">
      {emitida ? (
        <>
          <button type="button" className="botao botao-fantasma botao-icone" aria-label="Baixar PDF" title="Baixar PDF" disabled={!!ocupado} onClick={() => arquivo("pdf")}>
            {icone("pdf", "baixar")}
          </button>
          <button type="button" className="botao botao-fantasma botao-icone so-pc" aria-label="Imprimir" title="Imprimir" disabled={!!ocupado} onClick={() => arquivo("imprimir")}>
            {icone("imprimir", "imprimir")}
          </button>
          <button type="button" className="botao botao-fantasma botao-icone" aria-label="Enviar pelo WhatsApp" title="Enviar pelo WhatsApp" disabled={!!ocupado} onClick={() => arquivo("whats")}>
            {icone("whats", "whats")}
          </button>
        </>
      ) : (
        <Link className="botao botao-fantasma botao-icone" href={`/os/${id}`} aria-label="Abrir para conferir" title="Abrir para conferir">
          <Icone nome="lapis" />
        </Link>
      )}
      <button type="button" className="botao botao-fantasma botao-icone" aria-label="Nova O.S. a partir desta" title="Nova O.S. a partir desta" disabled={!!ocupado} onClick={nova}>
        {icone("nova", "copiar")}
      </button>
      {erro && (
        <span className="erro" role="alert" style={{ flexBasis: "100%", textAlign: "right" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
