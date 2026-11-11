import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { criarModalidade } from "@/lib/administracao";
import { CategoriaZ, FORMATO_INVALIDO, ModalidadeZ } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

const Corpo = ModalidadeZ.extend({ categoria: CategoriaZ });

export async function POST(req: NextRequest) {
  const d = Corpo.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  const { categoria, ...resto } = d.data;
  try {
    return NextResponse.json({ id: await criarModalidade(categoria, resto, await quemEsta()) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
