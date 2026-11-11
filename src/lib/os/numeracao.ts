// Número da O.S.: data invertida (AAAAMMDD) + sufixo da modalidade (CX, EG, FS, GX, DD, DR).
// Mais de uma O.S. do mesmo tipo no mesmo dia: P1, P2, P3... (ex.: 20261111CXP1).

export function baseNumero(data: string, sufixo: string): string {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error(`Data inválida para numeração: ${data}`);
  return `${m[3]}${m[2]}${m[1]}${sufixo}`;
}

/**
 * Gera os próximos números para `quantidade` O.S. novas da mesma data e sufixo.
 * `existentes` são os números já usados nesse dia e sufixo (de O.S. já salvas).
 * Uma O.S. já salva nunca muda de número: se já existe "20261111CX" sozinho,
 * ele conta como a primeira e as novas recebem P2, P3...
 */
export function proximosNumeros(base: string, existentes: string[], quantidade: number): string[] {
  if (quantidade <= 0) return [];
  const usados = existentes.filter((n) => n === base || new RegExp(`^${base}P\\d+$`).test(n));
  if (usados.length === 0 && quantidade === 1) return [base];
  let maior = 0;
  for (const n of usados) {
    const p = n === base ? 1 : Number(n.slice(base.length + 1));
    if (p > maior) maior = p;
  }
  return Array.from({ length: quantidade }, (_, i) => `${base}P${maior + i + 1}`);
}
