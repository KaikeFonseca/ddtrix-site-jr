import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { testarVersao } from "@/lib/administracao";

export const runtime = "nodejs";
export const maxDuration = 120;

// Preenche a versão com dados falsos e devolve a imagem da folha.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ versao: string }> }) {
  const { versao } = await params;
  try {
    const t = await testarVersao(versao);
    return new NextResponse(Buffer.from(t.png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, no-store",
        "x-ajuste": encodeURIComponent(t.ajuste),
        "x-cabe": t.cabe ? "1" : "0",
        "x-faltando": t.faltando.join(","),
      },
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
