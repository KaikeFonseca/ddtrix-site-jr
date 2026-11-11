import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { adicionarEndereco } from "@/lib/cadastro-clientes";
import { EnderecoZ, FORMATO_INVALIDO } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = EnderecoZ.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    return NextResponse.json({ id: await adicionarEndereco(id, d.data, await quemEsta()) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
