import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { criarCliente } from "@/lib/cadastro-clientes";
import { DadosClienteZ, EnderecoZ, FORMATO_INVALIDO } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

const Novo = DadosClienteZ.extend({ endereco: EnderecoZ.nullable().optional() });

export async function POST(req: NextRequest) {
  const d = Novo.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    return NextResponse.json({ id: await criarCliente(d.data, await quemEsta()) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
