"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icone } from "@/components/icone";
import type { ConfigOS } from "@/lib/os/servico";

export function ConfiguracoesAdm({ inicial }: { inicial: ConfigOS }) {
  const router = useRouter();
  const [v, setV] = useState({ ...inicial, fonteMinimaPt: String(inicial.fonteMinimaPt) });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(false);
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/configuracoes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, fonteMinimaPt: Number(v.fonteMinimaPt.replace(",", ".")) }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.erro ?? "Não foi possível salvar.");
      setOk(true);
      router.refresh();
    } catch (e) {
      setErro((e as Error).message);
    }
    setSalvando(false);
  }

  const campo = (k: keyof typeof v, rotulo: string, ajuda: string, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="campo">
      <label htmlFor={`cfg-${k}`}>{rotulo}</label>
      <input id={`cfg-${k}`} className="entrada" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} {...props} />
      <span className="origem">{ajuda}</span>
    </div>
  );

  return (
    <form className="bloco secao" style={{ maxWidth: 720 }} onSubmit={salvar}>
      <h2>Configurações gerais</h2>
      {campo("cevsValidade", "Validade do CEVS", "Vai em todas as O.S. novas. As já emitidas guardam a validade que tinham.", { placeholder: "dd/mm/aaaa", inputMode: "numeric" })}
      {campo("cidadePadrao", "Cidade padrão", "Usada quando a agenda não diz a cidade.")}
      {campo("fonteMinimaPt", "Menor tamanho de letra (pt)", "Para caber em uma folha, a letra diminui até este tamanho, nunca abaixo.", { inputMode: "decimal" })}
      {campo("marcadorObservacoes", "Texto que marca as observações no modelo", 'Observações e pagamento entram logo depois desse texto no .docx (hoje: "Observações").')}
      <div className="aviso aviso-info">
        <Icone nome="alerta" />
        <span>Os dados fixos da empresa (CNPJ, endereço, telefones) ficam no próprio modelo .docx. Para mudar, importe uma versão nova em Modelos de O.S.</span>
      </div>
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}
      {ok && (
        <p className="aviso aviso-ok" role="status">
          <Icone nome="check" />
          <span>Configurações salvas.</span>
        </p>
      )}
      <div className="barra-acoes">
        <button type="submit" className="botao botao-primario" disabled={salvando}>
          {salvando ? <span className="carregando" /> : null}
          Salvar configurações
        </button>
      </div>
    </form>
  );
}
