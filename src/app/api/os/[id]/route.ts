import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { respostaDeErro } from "@/lib/api";
import { alterarOrdem, excluirRascunho } from "@/lib/os/servico";
import { pendenciasDe } from "@/lib/os/tipos";
import { quemEsta } from "@/lib/quem-servidor";

export const runtime = "nodejs";

const texto = z.string().max(500).nullable().optional();
const Mudancas = z
  .object({
    cliente: texto,
    telefone: texto,
    data: texto,
    hora: texto,
    servico: texto,
    rua: texto,
    bairro: texto,
    cidade: texto,
    categoria: z.enum(["caixas", "dedet", "desr"]).optional(),
    observacoes: z.array(z.string().max(4000)).max(30).optional(),
    pagamento: z
      .object({ forma: z.string().max(60).nullable(), valor: z.string().max(40).nullable(), maquininha: z.boolean() })
      .nullable()
      .optional(),
    clienteEscolhido: z.enum(["existente", "novo"]).nullable().optional(),
    escolhaEndereco: z.enum(["so_nesta", "salvar_novo", "manter_antigo"]).optional(),
    conferida: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = Mudancas.safeParse(await req.json().catch(() => null));
  if (!dados.success) return NextResponse.json({ erro: "Algum campo veio num formato inesperado." }, { status: 400 });
  try {
    const o = await alterarOrdem(id, dados.data, await quemEsta());
    return NextResponse.json({ ordem: o, pendencias: pendenciasDe(o.dados) });
  } catch (e) {
    return respostaDeErro(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await excluirRascunho(id, await quemEsta());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaDeErro(e);
  }
}
