"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icone } from "@/components/icone";
import type { Categoria, Pagamento } from "@/lib/os/agenda";
import { baixarArquivo, compartilharArquivo, imprimirArquivo, pedirArquivo } from "@/lib/baixar";
import { CLASSE_CATEGORIA, dataComDia, etiquetaServico } from "@/lib/os/rotulos";
import type { EscolhaEndereco, Ordem } from "@/lib/os/tipos";

const FORMAS = ["Pix", "Dinheiro", "Cartão", "Cartão de débito", "Cartão de crédito", "Boleto", "Transferência", "Contrato"];
const CATEGORIAS: { v: Categoria; t: string }[] = [
  { v: "caixas", t: "Caixas" },
  { v: "dedet", t: "Dedetização" },
  { v: "desr", t: "Desratização" },
];

type Form = {
  cliente: string;
  telefone: string;
  servico: string;
  categoria: Categoria | null;
  data: string;
  hora: string;
  rua: string;
  bairro: string;
  cidade: string;
  observacoes: string[];
  forma: string;
  valor: string;
};

function formDe(o: Ordem): Form {
  const d = o.dados;
  return {
    cliente: d.cliente ?? "",
    telefone: d.telefone ?? "",
    servico: d.servico ?? "",
    categoria: d.categoria,
    data: d.data ?? "",
    hora: d.hora ?? "",
    rua: d.rua ?? "",
    bairro: d.bairro ?? "",
    cidade: d.cidade ?? "",
    observacoes: d.observacoes.length ? d.observacoes : [""],
    forma: d.pagamento?.forma ?? "",
    valor: d.pagamento?.valor ?? "",
  };
}

function pagamentoDe(f: Form): Pagamento | null {
  if (!f.forma && !f.valor.trim()) return null;
  return { forma: f.forma || null, valor: f.valor.trim() || null, maquininha: f.forma.startsWith("Cartão") };
}

export function ConferirOS({ ordemInicial, pendenciasIniciais }: { ordemInicial: Ordem; pendenciasIniciais: string[] }) {
  const router = useRouter();
  const [ordem, setOrdem] = useState(ordemInicial);
  const [pendencias, setPendencias] = useState(pendenciasIniciais);
  const [form, setForm] = useState<Form>(() => formDe(ordemInicial));
  const [aba, setAba] = useState<"dados" | "previa">("dados");
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState<null | "baixar" | "imprimir" | "whats">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [versaoPrevia, setVersaoPrevia] = useState(0);

  const emitida = ordem.status === "emitida";
  const d = ordem.dados;
  const original = formDe(ordem);
  const mudou = JSON.stringify(form) !== JSON.stringify(original);

  const definir = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar(corpo: Record<string, unknown>): Promise<boolean> {
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/os/${ordem.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.erro ?? "Não foi possível salvar.");
      setOrdem(r.ordem);
      setPendencias(r.pendencias);
      setForm(formDe(r.ordem));
      setVersaoPrevia((v) => v + 1);
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  /** Manda só o que mudou ("alterar somente o que foi pedido") e marca como conferida. */
  async function salvar(): Promise<boolean> {
    const corpo: Record<string, unknown> = { conferida: true };
    for (const k of ["cliente", "telefone", "servico", "data", "hora", "rua", "bairro", "cidade"] as const) {
      if (form[k] !== original[k]) corpo[k] = form[k];
    }
    if (form.categoria !== original.categoria && form.categoria) corpo.categoria = form.categoria;
    const obs = form.observacoes.map((o) => o.trim()).filter(Boolean);
    if (JSON.stringify(obs) !== JSON.stringify(d.observacoes)) corpo.observacoes = obs;
    if (form.forma !== original.forma || form.valor !== original.valor) corpo.pagamento = pagamentoDe(form);
    const ok = await enviar(corpo);
    if (ok) setMensagem("Alterações salvas.");
    return ok;
  }

  async function escolherEndereco(escolha: EscolhaEndereco) {
    await enviar({ escolhaEndereco: escolha });
  }

  async function gerar(acao: "baixar" | "imprimir" | "whats") {
    setMensagem(null);
    if (!emitida && (mudou || !d.conferida)) {
      if (!(await salvar())) return;
    }
    setGerando(acao);
    setErro(null);
    try {
      const { arquivo, naoCouberam } = await pedirArquivo([ordem.id], "pdf");
      if (acao === "baixar") baixarArquivo(arquivo);
      else if (acao === "imprimir") imprimirArquivo(arquivo);
      else {
        const r = await compartilharArquivo(arquivo, `O.S. ${ordem.numero ?? ""} · ${d.cliente ?? ""}`);
        if (r === "baixado") setMensagem("Este navegador não compartilha arquivos. O PDF foi baixado para você enviar pelo WhatsApp.");
      }
      if (naoCouberam.length) setErro("A O.S. não coube em uma folha mesmo com a menor fonte. Encurte as observações.");
      if (!emitida) {
        setOrdem((o) => ({ ...o, status: "emitida" }));
        router.refresh();
      }
    } catch (e) {
      setErro((e as Error).message);
    }
    setGerando(null);
  }

  async function excluir() {
    if (!window.confirm("Excluir este rascunho? Isso não pode ser desfeito.")) return;
    const res = await fetch(`/api/os/${ordem.id}`, { method: "DELETE" });
    if (res.ok) router.push(ordem.agendaId ? `/emitir/${ordem.agendaId}` : "/emitir");
    else setErro((await res.json().catch(() => ({}))).erro ?? "Não foi possível excluir.");
  }

  const origem = (k: keyof typeof d.origem) =>
    !emitida && d.origem[k] ? (
      <span className="origem">
        Da agenda: <q>{d.origem[k]}</q>
      </span>
    ) : null;

  const campo = (k: "cliente" | "telefone" | "servico" | "data" | "hora" | "rua" | "bairro" | "cidade", rotulo: string, extra?: React.ReactNode, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className={`campo ${!emitida && !form[k].trim() && k !== "telefone" ? "pendente" : ""}`}>
      <label htmlFor={`f-${k}`}>{rotulo}</label>
      <input id={`f-${k}`} className="entrada" value={form[k]} onChange={(e) => definir(k, e.target.value)} disabled={emitida} {...props} />
      {extra}
    </div>
  );

  return (
    <>
      <Link href={ordem.agendaId ? `/emitir/${ordem.agendaId}` : "/emitir"} className="botao botao-fantasma" style={{ margin: "-8px 0 8px -12px" }}>
        <Icone nome="voltar" />
        {d.data ? `Agenda de ${dataComDia(d.data)}` : "Voltar"}
      </Link>
      <div className="titulo-tela">
        <div>
          <h1>{d.cliente ?? "Cliente não identificado"}</h1>
          <div className="chips" style={{ marginTop: 10 }}>
            {ordem.numero && <span className="numero-os">{ordem.numero}</span>}
            <span className={`etiqueta ${d.categoria ? CLASSE_CATEGORIA[d.categoria] : "etq-pend"}`}>{etiquetaServico(d.categoria, d.sufixo)}</span>
            {emitida ? (
              <span className="etiqueta etq-ok">Emitida</span>
            ) : pendencias.length ? (
              <span className="etiqueta etq-pend">{pendencias.length === 1 ? "1 pendência" : `${pendencias.length} pendências`}</span>
            ) : (
              <span className="etiqueta etq-ok">Pronta</span>
            )}
          </div>
        </div>
      </div>

      <div className="segmentado abas-conferir" role="tablist" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        <button type="button" role="tab" aria-selected={aba === "dados"} onClick={() => setAba("dados")}>
          Dados
        </button>
        <button type="button" role="tab" aria-selected={aba === "previa"} onClick={() => setAba("previa")}>
          Prévia
        </button>
      </div>

      <div className="conferir">
        <form
          className={`bloco form-os ${aba === "previa" ? "aba-oculta" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          {emitida && (
            <div className="aviso aviso-info">
              <Icone nome="check" />
              <span>Esta O.S. já foi emitida e fica guardada como foi gerada. Baixe, imprima ou envie quando quiser.</span>
            </div>
          )}

          {!emitida && d.divergencia && (
            <div className="aviso aviso-alerta">
              <Icone nome="alerta" />
              <div style={{ display: "grid", gap: 10 }}>
                <b>O endereço da agenda é diferente do cadastro.</b>
                <div className="opcoes">
                  {(
                    [
                      ["so_nesta", "Usar o da agenda só nesta O.S."],
                      ["salvar_novo", "Salvar o da agenda como novo endereço do cliente"],
                      ["manter_antigo", `Manter o do cadastro: ${d.divergencia.salvo.rua}${d.divergencia.salvo.bairro ? ` · ${d.divergencia.salvo.bairro}` : ""}`],
                    ] as [EscolhaEndereco, string][]
                  ).map(([v, t]) => (
                    <label key={v}>
                      <input type="radio" name="endereco" checked={d.divergencia?.escolha === v} onChange={() => escolherEndereco(v)} disabled={salvando} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!emitida && d.reconhecimento.tipo === "possivel" && (
            <div className="aviso aviso-pend">
              <Icone nome="alerta" />
              <div style={{ display: "grid", gap: 10 }}>
                <b>É o cliente &quot;{d.reconhecimento.nome}&quot; já cadastrado?</b>
                <div className="opcoes">
                  <label>
                    <input type="radio" name="cliente-rec" checked={d.clienteEscolhido === "existente"} onChange={() => enviar({ clienteEscolhido: "existente" })} disabled={salvando} />
                    Sim, é o mesmo cliente
                  </label>
                  <label>
                    <input type="radio" name="cliente-rec" checked={d.clienteEscolhido === "novo"} onChange={() => enviar({ clienteEscolhido: "novo" })} disabled={salvando} />
                    Não, é um cliente novo
                  </label>
                </div>
              </div>
            </div>
          )}

          {!emitida && d.reconhecimento.tipo === "reconhecido" && (
            <div className="aviso aviso-ok">
              <Icone nome="check" />
              <span>
                Cliente reconhecido: <b>{d.reconhecimento.nome}</b>
              </span>
            </div>
          )}

          {!emitida && pendencias.filter((p) => !p.startsWith("O endereço é diferente") && !p.startsWith("É o cliente")).length > 0 && (
            <div className="aviso aviso-pend" role="status">
              <Icone nome="alerta" />
              <div style={{ display: "grid", gap: 4 }}>
                {pendencias
                  .filter((p) => !p.startsWith("O endereço é diferente") && !p.startsWith("É o cliente"))
                  .map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                {!d.conferida && <span style={{ fontSize: 13 }}>Corrija o que precisar e toque em Salvar para confirmar.</span>}
              </div>
            </div>
          )}

          <div className="secao-form">
            <h3>Cliente</h3>
            {campo("cliente", "Nome do cliente", origem("cliente"))}
            {campo("telefone", "Telefone (opcional)", origem("telefone"), { inputMode: "tel" })}
          </div>

          <div className="secao-form">
            <h3>Serviço</h3>
            <div className="segmentado" role="radiogroup" aria-label="Categoria">
              {CATEGORIAS.map((c) => (
                <button key={c.v} type="button" aria-pressed={form.categoria === c.v} onClick={() => !emitida && definir("categoria", c.v)} disabled={emitida}>
                  {c.t}
                </button>
              ))}
            </div>
            {campo("servico", "Serviço (como vai na O.S.)", origem("servico"))}
            <div className="grade">
              {campo("data", "Data", origem("data"), { inputMode: "numeric", placeholder: "dd/mm/aaaa" })}
              {campo("hora", "Horário", origem("hora"), { placeholder: "09:00" })}
            </div>
          </div>

          <div className="secao-form">
            <h3>Endereço</h3>
            {campo("rua", "Rua e número", origem("rua"))}
            <div className="grade">
              {campo("bairro", "Bairro")}
              {campo("cidade", "Cidade", d.origem.cidade === "Cidade padrão" && !emitida ? <span className="origem">Cidade padrão (a agenda não disse)</span> : null)}
            </div>
          </div>

          <div className="secao-form">
            <h3>Observações e pagamento</h3>
            <div className="campo">
              <span className="rotulo">Observações (vão inteiras para a O.S.)</span>
              <div className="lista-obs">
                {form.observacoes.map((o, i) => (
                  <div className="linha-obs" key={i}>
                    <textarea
                      className="entrada"
                      rows={Math.min(6, Math.max(2, Math.ceil(o.length / 60)))}
                      value={o}
                      aria-label={`Observação ${i + 1}`}
                      disabled={emitida}
                      onChange={(e) => definir("observacoes", form.observacoes.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {!emitida && form.observacoes.length > 1 && (
                      <button type="button" className="botao botao-fantasma" aria-label="Remover observação" onClick={() => definir("observacoes", form.observacoes.filter((_, j) => j !== i))}>
                        <Icone nome="x" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!emitida && (
                <button type="button" className="botao botao-fantasma" style={{ justifySelf: "start" }} onClick={() => definir("observacoes", [...form.observacoes, ""])}>
                  <Icone nome="mais" />
                  Outra observação
                </button>
              )}
            </div>
            <div className="grade">
              <div className="campo">
                <label htmlFor="f-forma">Forma de pagamento</label>
                <select id="f-forma" className="entrada" value={form.forma} onChange={(e) => definir("forma", e.target.value)} disabled={emitida}>
                  <option value="">Não informada (nada vai na O.S.)</option>
                  {FORMAS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                {origem("pagamento")}
              </div>
              <div className="campo">
                <label htmlFor="f-valor">Valor (opcional)</label>
                <input id="f-valor" className="entrada" value={form.valor} placeholder="R$ 0,00" onChange={(e) => definir("valor", e.target.value)} disabled={emitida} />
              </div>
            </div>
            {form.forma.startsWith("Cartão") && (
              <span className="maquininha" style={{ justifySelf: "start" }}>
                Na O.S.: <b>LEVAR A MAQUININHA</b>
              </span>
            )}
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

          <div className="barra-acoes rodape-acoes">
            {!emitida && (
              <button type="button" className="botao botao-perigo" onClick={excluir} style={{ marginRight: "auto" }}>
                <Icone nome="lixo" />
                Excluir
              </button>
            )}
            {!emitida && (
              <button type="submit" className="botao botao-secundario" disabled={salvando || (!mudou && d.conferida)}>
                {salvando ? <span className="carregando" /> : null}
                Salvar
              </button>
            )}
            <button
              type="button"
              className="botao botao-primario"
              disabled={!!gerando || salvando || (!emitida && pendencias.some((p) => p.startsWith("Falta") || p.startsWith("O endereço") || p.startsWith("É o cliente")))}
              onClick={() => gerar("baixar")}
            >
              {gerando === "baixar" ? <span className="carregando" /> : <Icone nome="baixar" />}
              {emitida ? "Baixar PDF" : "Confirmar e gerar PDF"}
            </button>
          </div>
        </form>

        <Previa id={ordem.id} versao={versaoPrevia} oculta={aba === "dados"} gerando={gerando} podeGerar={emitida || pendencias.length === 0} aoGerar={gerar} />
      </div>
    </>
  );
}

function Previa({
  id,
  versao,
  oculta,
  gerando,
  podeGerar,
  aoGerar,
}: {
  id: string;
  versao: number;
  oculta: boolean;
  gerando: string | null;
  podeGerar: boolean;
  aoGerar: (a: "imprimir" | "whats") => void;
}) {
  const [imagem, setImagem] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<string>("");
  const [cabe, setCabe] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const atual = useRef<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch(`/api/os/${id}/previa?v=${versao}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro ?? "Não foi possível montar a prévia.");
      const url = URL.createObjectURL(await res.blob());
      if (atual.current) URL.revokeObjectURL(atual.current);
      atual.current = url;
      setImagem(url);
      setAjuste(decodeURIComponent(res.headers.get("x-ajuste") ?? ""));
      setCabe(res.headers.get("x-cabe") !== "0");
    } catch (e) {
      setErro((e as Error).message);
    }
  }, [id, versao]);

  useEffect(() => {
    setImagem(null);
    carregar();
  }, [carregar]);

  return (
    <aside className={`bloco previa ${oculta ? "aba-oculta" : ""}`}>
      <div className="previa-topo">
        <h3>Prévia da O.S.</h3>
        <span className="ajuste" style={!cabe ? { color: "var(--vermelho-700)", fontWeight: 600 } : undefined}>
          {ajuste}
        </span>
      </div>
      {erro ? (
        <div className="aviso aviso-pend" style={{ width: "100%" }}>
          <Icone nome="alerta" />
          <span>{erro}</span>
        </div>
      ) : imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="previa-img" src={imagem} alt="Prévia da folha da O.S." />
      ) : (
        <div className="previa-carregando" aria-label="Montando a prévia" />
      )}
      {!cabe && (
        <div className="aviso aviso-alerta" style={{ width: "100%" }}>
          <Icone nome="alerta" />
          <span>Não coube em uma folha nem com a menor fonte permitida. Encurte as observações.</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="botao botao-secundario" type="button" disabled={!podeGerar || !!gerando} onClick={() => aoGerar("imprimir")}>
          {gerando === "imprimir" ? <span className="carregando" /> : <Icone nome="imprimir" />}
          Imprimir
        </button>
        <button className="botao botao-secundario" type="button" disabled={!podeGerar || !!gerando} onClick={() => aoGerar("whats")}>
          {gerando === "whats" ? <span className="carregando" /> : <Icone nome="whats" />}
          WhatsApp
        </button>
      </div>
    </aside>
  );
}
