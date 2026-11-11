import { cookies } from "next/headers";
import { COOKIE_QUEM, lerQuem } from "./sessao";

// Nome de quem está usando, para gravar na auditoria a partir do servidor.
export async function quemEsta(): Promise<string | null> {
  return lerQuem((await cookies()).get(COOKIE_QUEM)?.value);
}
