import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { reaproveitarOrdem } from "@/lib/historico";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json({ id: await reaproveitarOrdem(id, await quemEsta()) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
