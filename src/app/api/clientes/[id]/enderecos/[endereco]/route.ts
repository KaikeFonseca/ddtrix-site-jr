import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { respostaDeErro } from "@/lib/api";
import { alterarEndereco, removerEndereco, tornarPrincipal } from "@/lib/cadastro-clientes";
import { EnderecoZ, FORMATO_INVALIDO } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

type P = { params: Promise<{ id: string; endereco: string }> };

const Corpo = z.union([z.object({ principal: z.literal(true) }).strict(), EnderecoZ]);

export async function PATCH(req: NextRequest, { params }: P) {
  const { id, endereco } = await params;
  const d = Corpo.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    const quem = await quemEsta();
    if ("principal" in d.data) await tornarPrincipal(id, endereco, quem);
    else await alterarEndereco(id, endereco, d.data, quem);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id, endereco } = await params;
  try {
    await removerEndereco(id, endereco, await quemEsta());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
