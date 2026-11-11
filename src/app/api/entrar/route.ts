import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { bloqueado, credenciaisConferem, registrarTentativa } from "@/lib/login";
import { COOKIE_SESSAO, DURACAO_SESSAO_SEGUNDOS, criarSessao } from "@/lib/sessao";

const Corpo = z.object({ usuario: z.string().max(100), senha: z.string().max(200) });

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function POST(req: NextRequest) {
  const dados = Corpo.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json({ erro: "Preencha usuário e senha." }, { status: 400 });
  }

  const ip = ipDe(req);
  if (await bloqueado(ip)) {
    return NextResponse.json(
      { erro: "Muitas tentativas erradas. Aguarde 15 minutos e tente de novo." },
      { status: 429 },
    );
  }

  const ok = credenciaisConferem(dados.data.usuario, dados.data.senha);
  await registrarTentativa(ip, ok);
  if (!ok) {
    return NextResponse.json({ erro: "Usuário ou senha incorretos." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, await criarSessao(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
  return res;
}
