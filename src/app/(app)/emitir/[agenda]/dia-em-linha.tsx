"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icone } from "@/components/icone";
import type { Categoria, Pagamento } from "@/lib/os/agenda";
import { baixarArquivo, pedirArquivo } from "@/lib/baixar";
import { CLASSE_CATEGORIA, dataComDia, etiquetaServico, horaCurta } from "@/lib/os/rotulos";

export type ItemDia = {
  id: string;
  numero: string | null;
  status: "rascunho" | "confirmada" | "emitida";
  situacao: "ok" | "pendencia" | "alerta";
  pendencias: string[];
  avisos: string[];
  cliente: string | null;
  reconhecido: boolean;
  possivel: string | null;
  data: string | null;
  hora: string | null;
  categoria: Categoria | null;
  sufixo: string | null;
  servico: string | null;
  endereco: string;
  observacao: string | null;
  maisObservacoes: number;
  pagamento: Pagamento | null;
  divergencia: string | null;
};

export function DiaEmLinha({ itens, textoOriginal }: { itens: ItemDia[]; textoOriginal: string }) {
  const router = useRouter();
  const prontas = itens.filter((i) => i.pendencias.length === 0);
  const [selecao, setSelecao] = useState<Set<string>>(() => new Set(prontas.filter((i) => i.status !== "emitida").map((i) => i.id)));
  const [ocupado, setOcupado] = useState<null | "pdf" | "zip">(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const contagem = useMemo(
    () => ({
      emitidas: itens.filter((i) => i.status === "emitida").length,
      prontas: itens.filter((i) => i.status !== "emitida" && i.situacao === "ok").length,
      pendencias: itens.filter((i) => i.situacao === "pendencia").length,
      alertas: itens.filter((i) => i.situacao === "alerta").length,
    }),
    [itens],
  );

  const datas = [...new Set(itens.map((i) => i.data).filter(Boolean))] as string[];
  const titulo = datas.length === 1 ? `Agenda de ${dataComDia(datas[0])}` : "Agenda interpretada";
  const todasMarcadas = prontas.length > 0 && prontas.every((i) => selecao.has(i.id));

  function alternar(id: string) {
    setSelecao((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function gerar(formato: "pdf" | "zip") {
    setErro(null);
    setMensagem(null);
    setOcupado(formato);
    try {
      const ids = itens.filter((i) => selecao.has(i.id)).map((i) => i.id);
      const { arquivo, naoCouberam } = await pedirArquivo(ids, formato);
      baixarArquivo(arquivo);
      setMensagem(
        naoCouberam.length
          ? `Pronto. Atenção: ${naoCouberam.join(", ")} não coube em uma folha. Encurte as observações.`
          : `${ids.length === 1 ? "O.S. gerada" : `${ids.length} O.S. geradas`}. O arquivo foi baixado.`,
      );
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(null);
  }

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>{titulo}</h1>
          <p className="sub">
            {itens.length} {itens.length === 1 ? "atendimento encontrado" : "atendimentos encontrados"}.
            {contagem.pendencias + contagem.alertas > 0 ? " Confira os avisos antes de gerar." : ""}
          </p>
        </div>
        <div className="resumo">
          {contagem.emitidas > 0 && <span className="etiqueta etq-neutra">{contagem.emitidas} emitidas</span>}
          {contagem.prontas > 0 && (
            <span className="etiqueta etq-ok">
              <Icone nome="check" tamanho={14} />
              {contagem.prontas} {contagem.prontas === 1 ? "pronta" : "prontas"}
            </span>
          )}
          {contagem.pendencias > 0 && <span className="etiqueta etq-pend">{contagem.pendencias} com pendência</span>}
          {contagem.alertas > 0 && <span className="etiqueta etq-alerta">{contagem.alertas} {contagem.alertas === 1 ? "alerta" : "alertas"}</span>}
        </div>
      </div>

      <div className="emitir">
        <div style={{ display: "grid", gap: 16 }}>
          <div className="bloco selecao">
            <label>
              <input
                type="checkbox"
                checked={todasMarcadas}
                disabled={prontas.length === 0}
                onChange={() => setSelecao(todasMarcadas ? new Set() : new Set(prontas.map((i) => i.id)))}
              />
              Selecionar prontas ({prontas.length})
            </label>
            <div className="acoes">
              <button className="botao botao-secundario" type="button" disabled={!selecao.size || !!ocupado} onClick={() => gerar("zip")}>
                {ocupado === "zip" ? <span className="carregando" /> : <Icone nome="zip" />}
                ZIP
              </button>
              <button className="botao botao-primario" type="button" disabled={!selecao.size || !!ocupado} onClick={() => gerar("pdf")}>
                {ocupado === "pdf" ? <span className="carregando" /> : <Icone nome="baixar" />}
                {ocupado === "pdf" ? "Gerando…" : selecao.size > 1 ? `Gerar PDF (${selecao.size})` : "Gerar PDF"}
              </button>
            </div>
          </div>
          {erro && (
            <div className="aviso aviso-alerta" role="alert">
              <Icone nome="alerta" />
              <span>{erro}</span>
            </div>
          )}
          {mensagem && (
            <div className="aviso aviso-ok" role="status">
              <Icone nome="check" />
              <span>{mensagem}</span>
            </div>
          )}

          <ol className="dia">
            {itens.map((i) => {
              const selecionavel = i.pendencias.length === 0;
              const ponto = i.status === "emitida" ? "ok" : i.situacao === "alerta" ? "alerta" : i.situacao === "pendencia" ? "pend" : "ok";
              return (
                <li className="parada" key={i.id}>
                  <div className="marco">
                    <time>{horaCurta(i.hora)}</time>
                    <span className={`ponto ${ponto}`} />
                  </div>
                  <article className="bloco os">
                    <div className="os-topo">
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${i.cliente ?? "O.S."}`}
                          checked={selecao.has(i.id)}
                          disabled={!selecionavel}
                          onChange={() => alternar(i.id)}
                        />
                      </label>
                      <span className={`etiqueta ${i.categoria ? CLASSE_CATEGORIA[i.categoria] : "etq-pend"}`}>{etiquetaServico(i.categoria, i.sufixo)}</span>
                      {i.status === "emitida" && <span className="etiqueta etq-ok">Emitida</span>}
                      {i.numero ? <span className="numero-os">{i.numero}</span> : <span className="numero-os" style={{ opacity: 0.6 }}>sem número</span>}
                    </div>
                    <Link className="os-link" href={`/os/${i.id}`}>
                      <div className="cliente">{i.cliente ?? "Cliente não identificado"}</div>
                      {i.reconhecido && (
                        <span className="reconhecido">
                          <Icone nome="check" tamanho={15} />
                          Cliente reconhecido
                        </span>
                      )}
                      {i.servico && <div style={{ fontSize: 14, color: "var(--texto-2)" }}>{i.servico}</div>}
                      {i.endereco && (
                        <div className="local">
                          <Icone nome="pino" />
                          <span>{i.endereco}</span>
                        </div>
                      )}
                      {i.observacao && (
                        <p className="nota">
                          {i.observacao.length > 160 ? `${i.observacao.slice(0, 160)}…` : i.observacao}
                          {i.maisObservacoes > 0 ? ` (+${i.maisObservacoes})` : ""}
                        </p>
                      )}
                      {i.pagamento?.forma && (
                        <span className="maquininha">
                          {[i.pagamento.forma, i.pagamento.valor].filter(Boolean).join(" · ")}
                          {i.pagamento.maquininha && (
                            <>
                              {" · "}
                              <b>LEVAR A MAQUININHA</b>
                            </>
                          )}
                        </span>
                      )}
                      {i.divergencia && (
                        <div className="aviso aviso-alerta">
                          <Icone nome="alerta" />
                          <span>
                            <b>Endereço diferente do cadastro.</b> Salvo: {i.divergencia}. Toque para escolher qual vale.
                          </span>
                        </div>
                      )}
                      {i.possivel && (
                        <div className="aviso aviso-pend">
                          <Icone nome="alerta" />
                          <span>
                            <b>Pode ser o cliente &quot;{i.possivel}&quot;.</b> Toque para confirmar.
                          </span>
                        </div>
                      )}
                      {i.pendencias
                        .filter((p) => !p.startsWith("O endereço é diferente") && !p.startsWith("É o cliente"))
                        .map((p) => (
                          <div className="aviso aviso-pend" key={p}>
                            <Icone nome="alerta" />
                            <span>{p}</span>
                          </div>
                        ))}
                    </Link>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
        <aside className="col-direita bloco original so-pc">
          <h3>Texto colado</h3>
          <pre>{textoOriginal}</pre>
        </aside>
      </div>
    </>
  );
}
