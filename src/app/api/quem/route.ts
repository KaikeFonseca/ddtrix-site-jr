import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";
import { COOKIE_QUEM, DURACAO_SESSAO_SEGUNDOS } from "@/lib/sessao";

const Corpo = z.object({ nome: z.string().trim().min(2).max(60) });

// Guarda no aparelho o nome de quem está usando (seção 3).
export async function POST(req: NextRequest) {
  const dados = Corpo.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json({ erro: "Digite seu nome (pelo menos 2 letras)." }, { status: 400 });
  }
  const nome = dados.data.nome;
  await registrarAuditoria({ quem: nome, acao: "entrar", entidade: "sessao" });

  const res = NextResponse.json({ ok: true, nome });
  res.cookies.set(COOKIE_QUEM, encodeURIComponent(nome), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
  return res;
}
