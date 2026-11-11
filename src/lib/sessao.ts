import { SignJWT, jwtVerify } from "jose";

// Sessão longa (seção 3): 90 dias, para não pedir login toda hora no celular.
export const COOKIE_SESSAO = "ddtrix_sessao";
export const COOKIE_QUEM = "ddtrix_quem";
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 90;

function chave(): Uint8Array {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(segredo);
}

export async function criarSessao(): Promise<string> {
  return new SignJWT({ conta: "empresa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_SEGUNDOS}s`)
    .sign(chave());
}

export async function sessaoValida(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    return payload.conta === "empresa";
  } catch {
    return false;
  }
}

// Nome de quem está usando, guardado no aparelho (cookie) e gravado na auditoria.
export function lerQuem(valor: string | undefined): string | null {
  if (!valor) return null;
  try {
    const nome = decodeURIComponent(valor).trim();
    return nome.length > 0 && nome.length <= 60 ? nome : null;
  } catch {
    return null;
  }
}
