import { NextResponse } from "next/server";
import { ErroDeUso } from "./os/servico";

/** Responde erros de uso com a mensagem para a pessoa e esconde detalhes técnicos dos outros. */
export function respostaDeErro(e: unknown): NextResponse {
  if (e instanceof ErroDeUso) return NextResponse.json({ erro: e.message }, { status: 400 });
  console.error(e);
  return NextResponse.json({ erro: "Algo deu errado do nosso lado. Tente de novo em instantes." }, { status: 500 });
}

export function nomeDeArquivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}
