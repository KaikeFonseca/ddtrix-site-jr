import type { Atendimento, Campo, Categoria, Pagamento } from "./agenda";
import type { EnderecoSalvo, Reconhecimento } from "./clientes";

export type EscolhaEndereco = "so_nesta" | "salvar_novo" | "manter_antigo";

/** Tudo o que uma O.S. carrega enquanto é conferida (coluna `dados` de `ordens`). */
export type DadosOrdem = {
  cliente: string | null;
  telefone: string | null;
  data: string | null;
  hora: string | null;
  servico: string | null;
  categoria: Categoria | null;
  sufixo: string | null;
  rua: string | null;
  bairro: string | null;
  cidade: string | null;
  observacoes: string[];
  pagamento: Pagamento | null;
  origem: Partial<Record<Campo, string>>;
  avisosLeitura: string[]; // avisos do interpretador
  pendenciasLeitura: string[]; // dúvidas do interpretador; somem quando alguém confere e salva
  textoOriginal: string;
  reconhecimento: Reconhecimento;
  clienteEscolhido: "existente" | "novo" | null; // resposta a "possível cliente"
  divergencia: { salvo: EnderecoSalvo; escolha: EscolhaEndereco | null } | null;
  conferida: boolean;
  modeloVersaoId?: string; // preenchido ao emitir
  cevsValidade?: string; // validade do CEVS no momento da emissão
  indice?: number; // posição na agenda
};

export type StatusOrdem = "rascunho" | "confirmada" | "emitida";

export type Ordem = {
  id: string;
  numero: string | null;
  agendaId: string | null;
  status: StatusOrdem;
  dados: DadosOrdem;
  criadoEm: Date;
  criadoPor: string | null;
};

export const CAMPOS_OBRIGATORIOS: [keyof DadosOrdem, string][] = [
  ["cliente", "cliente"],
  ["data", "data"],
  ["hora", "horário"],
  ["servico", "serviço"],
  ["categoria", "categoria"],
  ["rua", "rua e número"],
  ["bairro", "bairro"],
  ["cidade", "cidade"],
];

/** O que impede emitir. Lista vazia = pronta. */
export function pendenciasDe(d: DadosOrdem): string[] {
  const p: string[] = [];
  const faltam = CAMPOS_OBRIGATORIOS.filter(([k]) => !d[k] || (typeof d[k] === "string" && !(d[k] as string).trim())).map(([, n]) => n);
  if (faltam.length) p.push(`Falta: ${faltam.join(", ")}.`);
  if (d.reconhecimento.tipo === "possivel" && !d.clienteEscolhido) p.push(`É o cliente "${d.reconhecimento.nome}" já cadastrado? Confirme.`);
  if (d.divergencia && !d.divergencia.escolha) p.push("O endereço é diferente do cadastro. Escolha qual vale.");
  // "X não encontrado" já aparece em "Falta: ..."; as outras dúvidas da leitura valem até alguém conferir.
  if (!d.conferida) p.push(...d.pendenciasLeitura.filter((x) => !/não encontrad[oa]\.$/.test(x)));
  return p;
}

/** Alertas que merecem atenção mas não bloqueiam (mostrados em vermelho/laranja na lista). */
export function situacao(d: DadosOrdem): "ok" | "pendencia" | "alerta" {
  if (d.divergencia && !d.divergencia.escolha) return "alerta";
  return pendenciasDe(d).length ? "pendencia" : "ok";
}

export function dadosDoAtendimento(a: Atendimento, reconhecimento: Reconhecimento, salvo: EnderecoSalvo | null): DadosOrdem {
  return {
    cliente: a.cliente,
    telefone: a.telefone,
    data: a.data,
    hora: a.hora,
    servico: a.servico,
    categoria: a.categoria,
    sufixo: a.sufixo,
    rua: a.rua,
    bairro: a.bairro,
    cidade: a.cidade,
    observacoes: a.observacoes,
    pagamento: a.pagamento,
    origem: a.origem,
    avisosLeitura: a.avisos,
    pendenciasLeitura: a.pendencias,
    textoOriginal: a.textoOriginal,
    reconhecimento,
    clienteEscolhido: null,
    divergencia: salvo ? { salvo, escolha: null } : null,
    conferida: false,
  };
}
