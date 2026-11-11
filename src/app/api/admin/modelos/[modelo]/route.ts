import { NextResponse, type NextRequest } from "next/server";
import { respostaDeErro } from "@/lib/api";
import { importarVersao } from "@/lib/administracao";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

// Importa um .docx como nova versão (ainda não oficial) do modelo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ modelo: string }> }) {
  const { modelo } = await params;
  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Escolha o arquivo .docx do modelo." }, { status: 400 });
    const notas = typeof form.get("notas") === "string" ? (form.get("notas") as string).slice(0, 500) : null;
    const id = await importarVersao(modelo, new Uint8Array(await arquivo.arrayBuffer()), notas, await quemEsta());
    return NextResponse.json({ id });
  } catch (e) {
    return respostaDeErro(e);
  }
}
