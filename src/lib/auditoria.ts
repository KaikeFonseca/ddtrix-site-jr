import type { JSONValue, Sql, TransactionSql } from "postgres";
import { sql as sqlPadrao } from "./db";

export type RegistroAuditoria = {
  quem: string | null;
  acao: string; // ex.: "criar", "alterar", "excluir", "emitir", "entrar"
  entidade: string; // ex.: "cliente", "ordem", "modelo_versao"
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
};

// Toda alteração de cadastro, modelo ou O.S. passa por aqui (seção 15).
// Aceita uma transação para gravar a auditoria junto com a alteração.
export async function registrarAuditoria(
  r: RegistroAuditoria,
  db: Sql | TransactionSql = sqlPadrao,
): Promise<void> {
  const json = (v: unknown) => (v === undefined || v === null ? null : db.json(v as JSONValue));
  await db`
    insert into auditoria (quem, acao, entidade, entidade_id, antes, depois)
    values (${r.quem}, ${r.acao}, ${r.entidade}, ${r.entidadeId ?? null},
            ${json(r.antes)}, ${json(r.depois)})`;
}
