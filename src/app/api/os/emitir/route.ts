import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { nomeDeArquivo, respostaDeErro } from "@/lib/api";
import { juntarPdfs } from "@/lib/os/pdf";
import { emitirOrdens } from "@/lib/os/servico";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";
export const maxDuration = 300;

const Corpo = z.object({
  ids: z.array(z.string().uuid()).min(1).max(60),
  formato: z.enum(["pdf", "zip"]).default("pdf"),
});

/**
 * Emite as O.S. e devolve o arquivo:
 * - pdf: uma O.S. → o PDF dela; várias → um PDF único, uma por folha
 * - zip: um PDF por O.S. dentro de um .zip
 */
export async function POST(req: NextRequest) {
  const dados = Corpo.safeParse(await req.json().catch(() => null));
  if (!dados.success) return NextResponse.json({ erro: "Escolha pelo menos uma O.S." }, { status: 400 });
  try {
    const emitidas = await emitirOrdens(dados.data.ids, await quemEsta());
    const naoCouberam = emitidas.filter((e) => !e.cabe).map((e) => e.numero);
    const cabecalhos: Record<string, string> = { "cache-control": "no-store", "x-nao-couberam": naoCouberam.join(",") };

    if (dados.data.formato === "zip") {
      const zip = new JSZip();
      for (const e of emitidas) zip.file(`OS_${e.numero}_${nomeDeArquivo(e.cliente)}.pdf`, e.pdf);
      const arquivo = await zip.generateAsync({ type: "nodebuffer" });
      return new NextResponse(new Uint8Array(arquivo), {
        headers: { ...cabecalhos, "content-type": "application/zip", "content-disposition": `attachment; filename="OS_${emitidas.length}_ordens.zip"` },
      });
    }

    const pdf = emitidas.length === 1 ? emitidas[0].pdf : await juntarPdfs(emitidas.map((e) => e.pdf));
    const nome = emitidas.length === 1 ? `OS_${emitidas[0].numero}_${nomeDeArquivo(emitidas[0].cliente)}.pdf` : `OS_${emitidas.length}_ordens.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: { ...cabecalhos, "content-type": "application/pdf", "content-disposition": `attachment; filename="${nome}"` },
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
