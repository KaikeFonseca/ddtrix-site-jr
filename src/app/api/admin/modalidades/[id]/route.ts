import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { alterarModalidade } from "@/lib/administracao";
import { FORMATO_INVALIDO, ModalidadeZ } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = ModalidadeZ.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    await alterarModalidade(id, d.data, await quemEsta());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
