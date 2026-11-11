// Ajudantes do navegador para baixar, imprimir e compartilhar os arquivos gerados.

export async function pedirArquivo(ids: string[], formato: "pdf" | "zip"): Promise<{ arquivo: File; naoCouberam: string[] }> {
  const res = await fetch("/api/os/emitir", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids, formato }),
  });
  if (!res.ok) {
    const corpo = await res.json().catch(() => ({}));
    throw new Error(corpo.erro ?? "Não foi possível gerar o arquivo.");
  }
  const nome = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? (formato === "zip" ? "OS.zip" : "OS.pdf");
  const blob = await res.blob();
  const naoCouberam = (res.headers.get("x-nao-couberam") ?? "").split(",").filter(Boolean);
  return { arquivo: new File([blob], nome, { type: blob.type }), naoCouberam };
}

export function baixarArquivo(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function imprimirArquivo(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const janela = window.open(url, "_blank");
  if (!janela) baixarArquivo(arquivo);
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** Compartilhamento nativo do celular (WhatsApp aparece na lista). Sem suporte, baixa o arquivo. */
export async function compartilharArquivo(arquivo: File, texto: string): Promise<"compartilhado" | "baixado"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], text: texto });
      return "compartilhado";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "compartilhado";
    }
  }
  baixarArquivo(arquivo);
  return "baixado";
}
