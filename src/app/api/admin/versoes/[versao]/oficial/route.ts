import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { tornarOficial } from "@/lib/administracao";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ versao: string }> }) {
  const { versao } = await params;
  try {
    await tornarOficial(versao, await quemEsta());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
