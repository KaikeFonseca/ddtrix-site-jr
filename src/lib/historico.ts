// Histórico central de O.S.: busca e reaproveitamento (especificação, seção 12).
import { sql } from "./db";
import { registrarAuditoria } from "./auditoria";
import type { Categoria } from "./os/agenda";
import { buscarOrdem, ErroDeUso } from "./os/servico";
import type { DadosOrdem } from "./os/tipos";

export type FiltroHistorico = {
  q?: string;
  categoria?: Categoria | "";
  de?: string; // aaaa-mm-dd
  ate?: string;
  situacao?: "emitida" | "rascunho" | "";
  clienteId?: string;
  pagina?: number;
};

export type LinhaHistorico = {
  id: string;
  numero: string | null;
  status: "rascunho" | "confirmada" | "emitida";
  cliente: string | null;
  clienteId: string | null;
  categoria: Categoria | null;
  sufixo: string | null;
  servico: string | null;
  data: string | null; // aaaa-mm-dd
  hora: string | null;
  endereco: string;
  pagamento: string | null;
  criadoPor: string | null;
};

export const POR_PAGINA = 30;

const dataIso = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export async function buscarHistorico(f: FiltroHistorico): Promise<{ itens: LinhaHistorico[]; total: number }> {
  const q = (f.q ?? "").trim().slice(0, 100);
  const termo = q ? `%${q}%` : null;
  const pagina = Math.max(1, Math.floor(f.pagina ?? 1));
  const categoria = f.categoria || null;
  const de = dataIso(f.de);
  const ate = dataIso(f.ate);
  const situacao = f.situacao || null;
  const clienteId = f.clienteId && /^[0-9a-f-]{36}$/i.test(f.clienteId) ? f.clienteId : null;

  const onde = sql`
    where (${termo}::text is null
           or unaccent(lower(coalesce(o.cliente_nome, ''))) like unaccent(lower(${termo}))
           or lower(coalesce(o.numero, '')) like lower(${termo})
           or unaccent(lower(coalesce(o.servico, ''))) like unaccent(lower(${termo}))
           or unaccent(lower(coalesce(o.rua, '') || ' ' || coalesce(o.bairro, ''))) like unaccent(lower(${termo})))
      and (${categoria}::text is null or o.categoria = ${categoria})
      and (${de}::date is null or o.data_execucao >= ${de}::date)
      and (${ate}::date is null or o.data_execucao <= ${ate}::date)
      and (${situacao}::text is null or (${situacao}::text = 'emitida' and o.status = 'emitida') or (${situacao}::text = 'rascunho' and o.status <> 'emitida'))
      and (${clienteId}::uuid is null or o.cliente_id = ${clienteId}::uuid)`;

  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from ordens o ${onde}`;
  const linhas = await sql<
    { id: string; numero: string | null; status: LinhaHistorico["status"]; cliente_nome: string | null; cliente_id: string | null; categoria: Categoria | null; sufixo: string | null; servico: string | null; data: string | null; hora: string | null; rua: string | null; bairro: string | null; pagamento_forma: string | null; criado_por: string | null }[]
  >`
    select o.id, o.numero, o.status, o.cliente_nome, o.cliente_id, o.categoria, o.sufixo, o.servico,
           to_char(o.data_execucao, 'YYYY-MM-DD') as data, o.hora, o.rua, o.bairro, o.pagamento_forma, o.criado_por
    from ordens o ${onde}
    order by o.data_execucao desc nulls last, o.hora desc nulls last, o.criado_em desc
    limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`;

  return {
    total,
    itens: linhas.map((l) => ({
      id: l.id,
      numero: l.numero,
      status: l.status,
      cliente: l.cliente_nome,
      clienteId: l.cliente_id,
      categoria: l.categoria,
      sufixo: l.sufixo,
      servico: l.servico,
      data: l.data,
      hora: l.hora,
      endereco: [l.rua, l.bairro].filter(Boolean).join(" · "),
      pagamento: l.pagamento_forma,
      criadoPor: l.criado_por,
    })),
  };
}

/**
 * Cria um rascunho novo com os dados de uma O.S. anterior. Data e horário ficam em branco
 * (é outro atendimento), e o número só é dado quando a data for preenchida.
 */
export async function reaproveitarOrdem(id: string, quem: string | null): Promise<string> {
  const o = await buscarOrdem(id);
  if (!o) throw new ErroDeUso("O.S. não encontrada.");
  const [linha] = await sql<{ cliente_id: string | null }[]>`select cliente_id from ordens where id = ${id}`;
  const a = o.dados;

  const dados: DadosOrdem = {
    cliente: a.cliente,
    telefone: a.telefone,
    data: null,
    hora: null,
    servico: a.servico,
    categoria: a.categoria,
    sufixo: a.sufixo,
    rua: a.rua,
    bairro: a.bairro,
    cidade: a.cidade,
    observacoes: [...a.observacoes],
    pagamento: a.pagamento,
    origem: {},
    avisosLeitura: [],
    pendenciasLeitura: [],
    textoOriginal: "",
    reconhecimento:
      linha?.cliente_id && a.cliente ? { tipo: "reconhecido", clienteId: linha.cliente_id, nome: a.cliente, por: "nome" } : a.reconhecimento,
    clienteEscolhido: a.clienteEscolhido,
    divergencia: null,
    conferida: false,
  };

  return sql.begin(async (tx) => {
    const [{ id: novo }] = await tx<{ id: string }[]>`
      insert into ordens (agenda_id, cliente_id, categoria, sufixo, servico, cliente_nome, rua, bairro, cidade, observacoes, pagamento_forma, status, dados, criado_por)
      values (null, ${linha?.cliente_id ?? null}, ${dados.categoria}, ${dados.sufixo}, ${dados.servico}, ${dados.cliente}, ${dados.rua}, ${dados.bairro}, ${dados.cidade},
              ${dados.observacoes.join("\n") || null}, ${dados.pagamento?.forma ?? null}, 'rascunho', ${tx.json(dados as never)}, ${quem})
      returning id`;
    await registrarAuditoria({ quem, acao: "criar", entidade: "ordem", entidadeId: novo, depois: { reaproveitadaDe: o.numero ?? id, cliente: dados.cliente } }, tx);
    return novo;
  });
}
