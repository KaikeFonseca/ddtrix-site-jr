import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { respostaDeErro } from "@/lib/api";
import { arquivoDaVersao, conferirVersao, salvarCampos } from "@/lib/administracao";
import { FORMATO_INVALIDO } from "@/lib/esquemas";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

type P = { params: Promise<{ versao: string }> };

// ?formato=docx baixa o arquivo; sem isso, devolve a conferência dos campos.
export async function GET(req: NextRequest, { params }: P) {
  const { versao } = await params;
  try {
    if (req.nextUrl.searchParams.get("formato") === "docx") {
      const { arquivo, nome } = await arquivoDaVersao(versao);
      return new NextResponse(Buffer.from(arquivo), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "content-disposition": `attachment; filename="${encodeURIComponent(nome)}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
        },
      });
    }
    return NextResponse.json({ campos: await conferirVersao(versao) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

const Campos = z.object({ campos: z.array(z.object({ k: z.string().max(40), s: z.string().max(500), n: z.number().int().min(1).max(50) }).strict()).max(40) }).strict();

export async function PATCH(req: NextRequest, { params }: P) {
  const { versao } = await params;
  const d = Campos.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json(FORMATO_INVALIDO, { status: 400 });
  try {
    await salvarCampos(versao, d.data.campos, await quemEsta());
    return NextResponse.json({ campos: await conferirVersao(versao) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
