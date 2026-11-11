import type { Categoria } from "./agenda";

export const NOME_CATEGORIA: Record<Categoria, string> = {
  caixas: "Limpeza de caixas",
  dedet: "Dedetização",
  desr: "Desratização",
};

export const CLASSE_CATEGORIA: Record<Categoria, string> = {
  caixas: "cat-caixas",
  dedet: "cat-dedet",
  desr: "cat-desr",
};

const NOME_SUFIXO: Record<string, string> = {
  CX: "Caixa d'água",
  EG: "Caixa de esgoto",
  FS: "Fossa",
  GX: "Caixa de gordura",
  DD: "Dedetização",
  DR: "Desratização",
};

/** Etiqueta curta do serviço: "Caixa d'água", "Dedetização"... */
export function etiquetaServico(categoria: Categoria | null, sufixo: string | null): string {
  if (sufixo && NOME_SUFIXO[sufixo]) return NOME_SUFIXO[sufixo];
  return categoria ? NOME_CATEGORIA[categoria] : "Sem categoria";
}

/** "09:00" → "09h"; "14:30" fica; texto vago fica como está. */
export function horaCurta(hora: string | null): string {
  if (!hora) return "—";
  const m = hora.match(/^(\d{2}):(\d{2})$/);
  if (!m) return hora;
  return m[2] === "00" ? `${m[1]}h` : hora;
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "11/11/2026" → "quarta, 11/11" */
export function dataComDia(data: string | null): string {
  const m = data?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return data ?? "";
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return `${DIAS[d.getUTCDay()]}, ${m[1]}/${m[2]}`;
}
