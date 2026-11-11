"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icone } from "@/components/icone";
import type { Modelo, VersaoModelo } from "@/lib/administracao";
import { NOMES_CAMPOS } from "@/lib/nomes-campos";
import type { CampoModelo } from "@/lib/os/docx";
import { NOME_CATEGORIA } from "@/lib/os/rotulos";

type Conferencia = CampoModelo & { encontrado: boolean; vezes: number };

const formato = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function ModelosAdm({ modelos }: { modelos: Modelo[] }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="aviso aviso-info">
        <Icone nome="doc" />
        <span>
          Para trocar o layout: importe o .docx novo, confira os campos (o que ficar em vermelho não foi achado no arquivo), teste com dados falsos e só então torne oficial. As
          versões antigas ficam guardadas e dá para voltar a qualquer uma.
        </span>
      </div>
      {modelos.map((m) => (
        <CartaoModelo key={m.id} modelo={m} />
      ))}
    </div>
  );
}

function CartaoModelo({ modelo }: { modelo: Modelo }) {
  const router = useRouter();
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abertas, setAbertas] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const notas = useRef<HTMLInputElement>(null);
  const oficial = modelo.versoes.find((v) => v.oficial);
  const novas = modelo.versoes.filter((v) => !v.oficial && (!oficial || v.numero > oficial.numero));
  const antigas = modelo.versoes.filter((v) => !v.oficial && oficial && v.numero < oficial.numero);

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    const f = arquivo.current?.files?.[0];
    if (!f) {
      setErro("Escolha o arquivo .docx do modelo.");
      return;
    }
    setErro(null);
    setImportando(true);
    try {
      const form = new FormData();
      form.set("arquivo", f);
      form.set("notas", notas.current?.value ?? "");
      const res = await fetch(`/api/admin/modelos/${modelo.id}`, { method: "POST", body: form });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.erro ?? "Não foi possível importar.");
      if (arquivo.current) arquivo.current.value = "";
      if (notas.current) notas.current.value = "";
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    }
    setImportando(false);
  }

  return (
    <section className="bloco secao">
      <div className="secao-topo">
        <h2>{modelo.nome}</h2>
        <span className="etiqueta etq-neutra">{NOME_CATEGORIA[modelo.categoria]}</span>
      </div>
      {oficial ? <CartaoVersao versao={oficial} /> : <p className="erro">Nenhuma versão oficial. As O.S. desta categoria não podem ser geradas.</p>}
      {novas.map((v) => (
        <CartaoVersao key={v.id} versao={v} />
      ))}

      <form className="versao" onSubmit={importar} style={{ borderStyle: "dashed" }}>
        <b>Importar versão nova</b>
        <div className="grade">
          <div className="campo">
            <label htmlFor={`arq-${modelo.id}`}>Arquivo .docx</label>
            <input id={`arq-${modelo.id}`} ref={arquivo} className="entrada" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          </div>
          <div className="campo">
            <label htmlFor={`not-${modelo.id}`}>O que mudou (opcional)</label>
            <input id={`not-${modelo.id}`} ref={notas} className="entrada" placeholder="Ex.: layout novo 2027" maxLength={300} />
          </div>
        </div>
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}
        <div className="barra-acoes">
          <button type="submit" className="botao botao-secundario" disabled={importando}>
            {importando ? <span className="carregando" /> : <Icone nome="subir" />}
            Importar
          </button>
        </div>
      </form>

      {antigas.length > 0 && (
        <details open={abertas} onToggle={(e) => setAbertas((e.target as HTMLDetailsElement).open)}>
          <summary className="suave" style={{ cursor: "pointer", fontWeight: 600 }}>
            Versões anteriores ({antigas.length})
          </summary>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {antigas.map((v) => (
              <CartaoVersao key={v.id} versao={v} antiga />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function CartaoVersao({ versao, antiga = false }: { versao: VersaoModelo; antiga?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState<null | "campos" | "teste">(versao.oficial || antiga ? null : "campos");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const editavel = !versao.oficial && versao.usadaEm === 0;

  async function oficializar() {
    const msg = antiga
      ? `Voltar para a versão ${versao.numero}? As próximas O.S. usarão esta versão. As já emitidas não mudam.`
      : `Tornar a versão ${versao.numero} oficial? As próximas O.S. usarão esta versão. As já emitidas não mudam.`;
    if (!window.confirm(msg)) return;
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/versoes/${versao.id}/oficial`, { method: "POST" });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.erro ?? "Não foi possível tornar oficial.");
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  return (
    <div className={`versao ${versao.oficial ? "oficial" : ""}`}>
      <div className="versao-topo">
        <div>
          <b>Versão {versao.numero}</b>{" "}
          {versao.oficial ? <span className="etiqueta etq-ok">Oficial</span> : antiga ? <span className="etiqueta etq-neutra">Anterior</span> : <span className="etiqueta etq-pend">Em teste</span>}
          <div className="suave" style={{ fontSize: 13, marginTop: 4 }}>
            {formato.format(new Date(versao.criadoEm))}
            {versao.criadoPor ? ` · ${versao.criadoPor}` : ""}
            {versao.notas ? ` · ${versao.notas}` : ""}
            {versao.usadaEm ? ` · usada em ${versao.usadaEm} O.S.` : ""}
          </div>
        </div>
        <div className="meta" style={{ flexWrap: "wrap" }}>
          <a className="botao botao-fantasma" href={`/api/admin/versoes/${versao.id}?formato=docx`}>
            <Icone nome="baixar" />
            .docx
          </a>
          <button type="button" className="botao botao-fantasma" aria-expanded={aberto === "campos"} onClick={() => setAberto(aberto === "campos" ? null : "campos")}>
            Campos
          </button>
          <button type="button" className="botao botao-fantasma" aria-expanded={aberto === "teste"} onClick={() => setAberto(aberto === "teste" ? null : "teste")}>
            Testar
          </button>
          {!versao.oficial && (
            <button type="button" className="botao botao-primario" disabled={ocupado} onClick={oficializar}>
              {ocupado ? <span className="carregando" /> : <Icone nome="check" />}
              {antiga ? "Voltar para esta" : "Tornar oficial"}
            </button>
          )}
        </div>
      </div>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {aberto === "campos" && <Campos versao={versao} editavel={editavel} />}
      {aberto === "teste" && <Teste versaoId={versao.id} />}
    </div>
  );
}

function Campos({ versao, editavel }: { versao: VersaoModelo; editavel: boolean }) {
  const [campos, setCampos] = useState<CampoModelo[]>(versao.campos);
  const [conferencia, setConferencia] = useState<Conferencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudou = JSON.stringify(campos) !== JSON.stringify(conferencia?.map(({ k, s, n }) => ({ k, s, n })) ?? versao.campos);

  useEffect(() => {
    fetch(`/api/admin/versoes/${versao.id}`)
      .then((r) => r.json())
      .then((r) => (r.campos ? setConferencia(r.campos) : setErro(r.erro ?? "Não foi possível conferir os campos.")))
      .catch(() => setErro("Não foi possível conferir os campos."));
  }, [versao.id]);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(`/api/admin/versoes/${versao.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ campos }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.erro ?? "Não foi possível salvar.");
      setConferencia(r.campos);
      setCampos(r.campos.map(({ k, s, n }: Conferencia) => ({ k, s, n })));
    } catch (e) {
      setErro((e as Error).message);
    }
    setSalvando(false);
  }

  const achado = (i: number) => conferencia?.[i];
  const faltam = conferencia?.filter((c) => !c.encontrado).length ?? 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p className="suave" style={{ margin: 0, fontSize: 14 }}>
        Cada campo é achado no modelo pelo <b>texto de exemplo</b> e pela <b>vez</b> em que ele aparece (1ª, 2ª…).
        {!editavel && " Esta versão já está em uso; para mudar os campos, importe uma versão nova."}
      </p>
      {conferencia && faltam > 0 && (
        <div className="aviso aviso-alerta" role="alert">
          <Icone nome="alerta" />
          <span>{faltam === 1 ? "1 campo não foi encontrado" : `${faltam} campos não foram encontrados`} no arquivo. Ajuste o texto de exemplo como está escrito no .docx.</span>
        </div>
      )}
      <div className="tabela-rolagem">
        <table className="campos-tabela">
          <thead>
            <tr>
              <th>Campo</th>
              <th>Texto de exemplo no modelo</th>
              <th style={{ width: 70 }}>Vez</th>
              <th style={{ width: 110 }}>No arquivo</th>
            </tr>
          </thead>
          <tbody>
            {campos.map((c, i) => {
              const a = achado(i);
              const atual = a && a.s === c.s && a.n === c.n;
              return (
                <tr key={c.k + i}>
                  <td>{NOMES_CAMPOS[c.k] ?? c.k}</td>
                  <td>
                    {editavel ? (
                      <input className="entrada" aria-label={`Texto de exemplo de ${NOMES_CAMPOS[c.k] ?? c.k}`} value={c.s} onChange={(e) => setCampos(campos.map((x, j) => (j === i ? { ...x, s: e.target.value } : x)))} />
                    ) : (
                      <span style={{ overflowWrap: "anywhere" }}>{c.s}</span>
                    )}
                  </td>
                  <td>
                    {editavel ? (
                      <input
                        className="entrada"
                        type="number"
                        min={1}
                        max={50}
                        aria-label={`Vez de ${NOMES_CAMPOS[c.k] ?? c.k}`}
                        value={c.n}
                        onChange={(e) => setCampos(campos.map((x, j) => (j === i ? { ...x, n: Math.max(1, Number(e.target.value) || 1) } : x)))}
                      />
                    ) : (
                      `${c.n}ª`
                    )}
                  </td>
                  <td className={!a || !atual ? "" : a.encontrado ? "sim" : "nao"}>{!a ? "…" : !atual ? "salve para conferir" : a.encontrado ? "Encontrado" : "Não encontrado"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {editavel && (
        <div className="barra-acoes">
          <button type="button" className="botao botao-secundario" disabled={!mudou || salvando} onClick={salvar}>
            {salvando ? <span className="carregando" /> : null}
            Salvar e conferir campos
          </button>
        </div>
      )}
    </div>
  );
}

function Teste({ versaoId }: { versaoId: string }) {
  const [img, setImg] = useState<string | null>(null);
  const [info, setInfo] = useState<{ ajuste: string; cabe: boolean; faltando: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      try {
        const res = await fetch(`/api/admin/versoes/${versaoId}/teste`);
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro ?? "Não foi possível testar.");
        url = URL.createObjectURL(await res.blob());
        setImg(url);
        setInfo({
          ajuste: decodeURIComponent(res.headers.get("x-ajuste") ?? ""),
          cabe: res.headers.get("x-cabe") !== "0",
          faltando: (res.headers.get("x-faltando") ?? "").split(",").filter(Boolean),
        });
      } catch (e) {
        setErro((e as Error).message);
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [versaoId]);

  if (erro) return <p className="erro">{erro}</p>;
  if (!img) return <div className="previa-carregando" style={{ maxWidth: 520 }} aria-label="Montando o teste" />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p className="suave" style={{ margin: 0, fontSize: 14 }}>
        Preenchido com dados falsos ({info?.ajuste}).
        {info?.faltando.length ? <span className="erro"> Campos não encontrados: {info.faltando.map((k) => NOMES_CAMPOS[k] ?? k).join(", ")}.</span> : " Todos os campos foram preenchidos."}
        {info && !info.cabe ? <span className="erro"> Não coube em uma folha.</span> : null}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="teste-img" src={img} alt="Teste do modelo preenchido com dados falsos" />
    </div>
  );
}
