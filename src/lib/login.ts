import { sql } from "./db";
import { conferirSenha } from "./senha";

// Limite de tentativas (seção 4.1): 5 erros seguidos em 15 minutos bloqueiam o IP.
export const MAX_TENTATIVAS = 5;
export const JANELA_MINUTOS = 15;

export async function bloqueado(ip: string): Promise<boolean> {
  const [{ falhas }] = await sql<{ falhas: number }[]>`
    select count(*)::int as falhas from login_tentativas
    where ip = ${ip} and not sucesso
      and quando > now() - make_interval(mins => ${JANELA_MINUTOS})
      and quando > coalesce(
        (select max(quando) from login_tentativas where ip = ${ip} and sucesso),
        '-infinity'::timestamptz)`;
  return falhas >= MAX_TENTATIVAS;
}

export async function registrarTentativa(ip: string, sucesso: boolean): Promise<void> {
  await sql`insert into login_tentativas (ip, sucesso) values (${ip}, ${sucesso})`;
}

export function credenciaisConferem(usuario: string, senha: string): boolean {
  const usuarioCerto = process.env.EMPRESA_USUARIO;
  const hash = process.env.EMPRESA_SENHA_HASH;
  if (!usuarioCerto || !hash) return false;
  const usuarioOk = usuario.trim().toLowerCase() === usuarioCerto.trim().toLowerCase();
  // Confere a senha mesmo com usuário errado, para não revelar qual dos dois falhou.
  const senhaOk = conferirSenha(senha, hash);
  return usuarioOk && senhaOk;
}
