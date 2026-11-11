// Utilidades de texto usadas na leitura de agendas e no reconhecimento de clientes.

/** Minúsculas, sem acento, sem pontuação, espaços simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Remove emojis, marcadores de lista e símbolos decorativos do começo de uma linha. */
export function limparLinha(linha: string): string {
  return linha
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/^[\s·•\-*–—>]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distância de edição (Levenshtein). */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[b.length];
}

/** Semelhança de 0 a 1 entre dois textos já normalizados. */
export function semelhanca(a: string, b: string): number {
  const maior = Math.max(a.length, b.length);
  if (maior === 0) return 1;
  return 1 - distancia(a, b) / maior;
}

export function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}
