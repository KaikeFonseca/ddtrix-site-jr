import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { respostaDeErro } from "@/lib/api";
import { alterarCategoria } from "@/lib/administracao";
import { CategoriaZ, FORMATO_INVALIDO } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

const Corpo = z.object({ nome: z.string().max(80), palavras: z.array(z.string().max(60)).max(60) }).strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = CategoriaZ.safeParse((await params).codigo);
  const d = Corpo.safeParse(await req.json().catch(() => null));
  if (!codigo.success || !d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    await alterarCategoria(codigo.data, d.data, await quemEsta());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
