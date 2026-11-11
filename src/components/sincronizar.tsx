"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERVALO_MS = 8_000;

/**
 * Atualização quase em tempo real entre aparelhos: de tempos em tempos pergunta ao servidor
 * se houve alguma alteração (qualquer gravação entra na auditoria) e, se houve, recarrega
 * os dados da tela sem perder o que está sendo digitado. Só roda com a aba visível.
 */
export function Sincronizar() {
  const router = useRouter();
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    let parado = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function olhar() {
      if (parado || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/versao", { cache: "no-store" });
        if (res.ok) {
          const { v } = (await res.json()) as { v: string };
          if (ultima.current !== null && v !== ultima.current) router.refresh();
          ultima.current = v;
        }
      } catch {
        // sem internet: tenta de novo no próximo ciclo
      }
    }

    function agendar() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        await olhar();
        if (!parado) agendar();
      }, INTERVALO_MS);
    }

    const aoVoltar = () => {
      if (document.visibilityState === "visible") olhar();
    };

    olhar();
    agendar();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      parado = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [router]);

  return null;
}
