import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { alterarCliente } from "@/lib/cadastro-clientes";
import { DadosClienteZ, FORMATO_INVALIDO } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = DadosClienteZ.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    await alterarCliente(id, d.data, await quemEsta());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
