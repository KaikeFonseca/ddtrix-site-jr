// Reconhecimento de clientes já cadastrados e comparação de endereços (seção 6).
// Nunca substitui nada sozinho: só sugere, e quem decide é o usuário.
import { normalizar, semelhanca } from "./texto";

const PALAVRAS_GENERICAS = new Set(["cond", "condominio", "condominios", "residencial", "res", "edificio", "ed", "edf", "conj", "conjunto"]);

export function nomeNormalizado(nome: string): string {
  return normalizar(nome);
}

/** Nome sem palavras genéricas ("Cond.", "Residencial"...), para comparar o essencial. */
export function nucleoDoNome(nome: string): string {
  const palavras = normalizar(nome).split(" ").filter((p) => p && !PALAVRAS_GENERICAS.has(p) && !/^\d+$/.test(p));
  return palavras.join(" ");
}

export function soDigitos(t: string): string {
  return t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}

export type ClienteCandidato = { id: string; nome: string; telefones: string[] };

export type Reconhecimento =
  | { tipo: "novo" }
  | { tipo: "reconhecido"; clienteId: string; nome: string; por: "nome" | "telefone" }
  | { tipo: "possivel"; clienteId: string; nome: string; semelhanca: number };

export const LIMIAR_RECONHECIDO = 0.9;
export const LIMIAR_POSSIVEL = 0.72;

export function reconhecerCliente(nome: string | null, telefone: string | null, candidatos: ClienteCandidato[]): Reconhecimento {
  const fone = telefone ? soDigitos(telefone) : "";
  if (fone.length >= 8) {
    const c = candidatos.find((x) => x.telefones.some((t) => {
      const d = soDigitos(t);
      return d.length >= 8 && (d.endsWith(fone.slice(-8)) || fone.endsWith(d.slice(-8)));
    }));
    if (c) return { tipo: "reconhecido", clienteId: c.id, nome: c.nome, por: "telefone" };
  }
  if (!nome) return { tipo: "novo" };

  const alvoTotal = normalizar(nome);
  const alvoNucleo = nucleoDoNome(nome);
  let melhor: { c: ClienteCandidato; s: number } | null = null;
  for (const c of candidatos) {
    const s = Math.max(
      semelhanca(alvoTotal, normalizar(c.nome)),
      alvoNucleo.length >= 4 ? semelhanca(alvoNucleo, nucleoDoNome(c.nome)) : 0,
    );
    if (!melhor || s > melhor.s) melhor = { c, s };
  }
  if (melhor && melhor.s >= LIMIAR_RECONHECIDO) return { tipo: "reconhecido", clienteId: melhor.c.id, nome: melhor.c.nome, por: "nome" };
  if (melhor && melhor.s >= LIMIAR_POSSIVEL) return { tipo: "possivel", clienteId: melhor.c.id, nome: melhor.c.nome, semelhanca: Math.round(melhor.s * 100) / 100 };
  return { tipo: "novo" };
}

// ---------------------------------------------------------------- endereços

const TIPOS_LOGRADOURO: Record<string, string> = {
  r: "rua", rua: "rua", av: "avenida", avenida: "avenida", al: "alameda", alameda: "alameda",
  trav: "travessa", tv: "travessa", travessa: "travessa", est: "estrada", estrada: "estrada", rod: "rodovia", rodovia: "rodovia",
  pca: "praca", praca: "praca",
};

/** Rua normalizada para comparar: "Av. Itália, 277" ≈ "Avenida Italia 277". */
export function ruaNormalizada(rua: string): string {
  const p = normalizar(rua).split(" ").filter(Boolean);
  if (p.length && TIPOS_LOGRADOURO[p[0]]) p[0] = TIPOS_LOGRADOURO[p[0]];
  return p.join(" ");
}

export function mesmoEndereco(a: { rua: string }, b: { rua: string }): boolean {
  return semelhanca(ruaNormalizada(a.rua), ruaNormalizada(b.rua)) >= 0.9;
}

export type EnderecoSalvo = { id: string; rua: string; bairro: string | null; cidade: string; referencia: string | null; principal: boolean };

/** Se o endereço da agenda não bate com nenhum dos salvos, devolve o principal para o alerta. */
export function divergenciaDeEndereco(rua: string | null, salvos: EnderecoSalvo[]): EnderecoSalvo | null {
  if (!rua || salvos.length === 0) return null;
  if (salvos.some((s) => mesmoEndereco({ rua }, s))) return null;
  return salvos.find((s) => s.principal) ?? salvos[0];
}
