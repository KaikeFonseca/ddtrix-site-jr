import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { respostaDeErro } from "@/lib/api";
import { salvarConfiguracoes } from "@/lib/administracao";
import { FORMATO_INVALIDO } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

const Corpo = z
  .object({ cevsValidade: z.string().max(20), cidadePadrao: z.string().max(120), fonteMinimaPt: z.number(), marcadorObservacoes: z.string().max(80) })
  .strict();

export async function PUT(req: NextRequest) {
  const d = Corpo.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    await salvarConfiguracoes(d.data, await quemEsta());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
