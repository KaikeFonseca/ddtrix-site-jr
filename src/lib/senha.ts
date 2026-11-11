import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Formato: scrypt:<salt hex>:<hash hex> (sem "$", que o .env interpreta como variável)
export function hashSenha(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function conferirSenha(senha: string, guardado: string): boolean {
  const [tipo, saltHex, hashHex] = guardado.split(":");
  if (tipo !== "scrypt" || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = scryptSync(senha, Buffer.from(saltHex, "hex"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}
