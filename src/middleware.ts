import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_QUEM, COOKIE_SESSAO, lerQuem, sessaoValida } from "@/lib/sessao";

// Tudo exige login, menos a tela de entrada. Depois do login, pede "Quem está usando?".
const PUBLICAS = ["/entrar", "/api/entrar"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.includes(pathname)) return NextResponse.next();

  const logado = await sessaoValida(req.cookies.get(COOKIE_SESSAO)?.value);
  if (!logado) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "Sua sessão terminou. Entre novamente." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const quem = lerQuem(req.cookies.get(COOKIE_QUEM)?.value);
  if (!quem && pathname !== "/quem" && !pathname.startsWith("/api/")) {
    const url = req.nextUrl.clone();
    url.pathname = "/quem";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-ddtrix.png|manifest.webmanifest).*)"],
};
