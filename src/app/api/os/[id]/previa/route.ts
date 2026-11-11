import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { previaDaOrdem } from "@/lib/os/servico";

export const runtime = "nodejs";

// Imagem da primeira folha da O.S. (funciona em qualquer celular, diferente de PDF embutido).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const p = await previaDaOrdem(id);
    return new NextResponse(Buffer.from(p.png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "private, no-store",
        "x-ajuste": encodeURIComponent(p.ajuste),
        "x-cabe": p.cabe ? "1" : "0",
      },
    });
  } catch (e) {
    return respostaDeErro(e);
  }
}
