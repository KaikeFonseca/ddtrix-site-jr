import Link from "next/link";
import type { LinhaAuditoria } from "@/lib/administracao";

const ACOES: Record<string, string> = {
  criar: "criou",
  alterar: "alterou",
  excluir: "excluiu",
  emitir: "emitiu",
  importar: "importou",
  tornar_oficial: "tornou oficial",
  entrar: "entrou",
};
const ENTIDADES: Record<string, string> = {
  ordem: "O.S.",
  cliente: "cliente",
  cliente_endereco: "endereço de cliente",
  modelo_versao: "versão de modelo",
  categoria: "categoria",
  modalidade: "modalidade de serviço",
  configuracoes: "configurações",
  sessao: "sessão",
  quem: "quem está usando",
};

function resumo(l: LinhaAuditoria): string {
  const depois = (l.depois ?? {}) as Record<string, unknown>;
  const antes = (l.antes ?? {}) as Record<string, unknown>;
  const nome = depois.numero ?? depois.cliente ?? depois.nome ?? depois.rua ?? depois.modelo ?? antes.numero ?? antes.cliente ?? antes.nome ?? antes.rua;
  const campos = l.acao === "alterar" ? Object.keys(depois).filter((k) => !["numero"].includes(k)) : [];
  const partes = [typeof nome === "string" ? nome : null, campos.length ? `campos: ${campos.slice(0, 5).join(", ")}${campos.length > 5 ? "…" : ""}` : null].filter(Boolean);
  return partes.join(" · ");
}

function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

const formato = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function Alteracoes({ linhas, total, pagina }: { linhas: LinhaAuditoria[]; total: number; pagina: number }) {
  const paginas = Math.max(1, Math.ceil(total / 40));
  return (
    <section className="bloco">
      {linhas.length === 0 ? (
        <div className="vazio">
          <p>Nada registrado ainda.</p>
        </div>
      ) : (
        <ul className="lista">
          {linhas.map((l) => {
            const antes = (l.antes ?? {}) as Record<string, unknown>;
            const depois = (l.depois ?? {}) as Record<string, unknown>;
            const diferencas = l.acao === "alterar" ? Object.keys(depois).filter((k) => k in antes) : [];
            return (
              <li key={l.id} style={{ gridTemplateColumns: "1fr" }}>
                <div className="d num">{formato.format(l.quando)}</div>
                <div>
                  <b>{l.quem ?? "Sistema"}</b> {ACOES[l.acao] ?? l.acao} {ENTIDADES[l.entidade] ?? l.entidade}
                  {resumo(l) ? <span className="suave"> · {resumo(l)}</span> : null}
                </div>
                {diferencas.length > 0 && (
                  <details>
                    <summary className="suave" style={{ cursor: "pointer", fontSize: 14 }}>
                      Ver o que mudou
                    </summary>
                    <table style={{ marginTop: 8 }}>
                      <thead>
                        <tr>
                          <th>Campo</th>
                          <th>Antes</th>
                          <th>Depois</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diferencas.map((k) => (
                          <tr key={k}>
                            <td>{k}</td>
                            <td style={{ overflowWrap: "anywhere" }}>{valor(antes[k])}</td>
                            <td style={{ overflowWrap: "anywhere" }}>{valor(depois[k])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {paginas > 1 && (
        <nav className="paginacao" aria-label="Páginas" style={{ padding: "0 20px 16px" }}>
          {pagina > 1 ? <Link className="botao botao-secundario" href={`/administracao?aba=alteracoes&pagina=${pagina - 1}`}>Mais recentes</Link> : <span />}
          <span className="suave">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas ? <Link className="botao botao-secundario" href={`/administracao?aba=alteracoes&pagina=${pagina + 1}`}>Mais antigas</Link> : <span />}
        </nav>
      )}
    </section>
  );
}
