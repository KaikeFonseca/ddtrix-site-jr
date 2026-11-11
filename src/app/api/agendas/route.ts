import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { respostaDeErro } from "@/lib/api";
import { interpretarEGuardar } from "@/lib/os/servico";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

const Corpo = z.object({ texto: z.string().max(50_000) });

export async function POST(req: NextRequest) {
  const dados = Corpo.safeParse(await req.json().catch(() => null));
  if (!dados.success) return NextResponse.json({ erro: "Cole a agenda antes de interpretar." }, { status: 400 });
  try {
    const r = await interpretarEGuardar(dados.data.texto, await quemEsta());
    return NextResponse.json(r);
  } catch (e) {
    return respostaDeErro(e);
  }
}
