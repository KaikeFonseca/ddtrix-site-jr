import Link from "next/link";
import { listarAuditoria, listarCategorias, listarModelos } from "@/lib/administracao";
import { configuracoesOS } from "@/lib/os/servico";
import { Alteracoes } from "./alteracoes";
import { CategoriasAdm } from "./categorias";
import { ConfiguracoesAdm } from "./configuracoes";
import { ModelosAdm } from "./modelos";

export const dynamic = "force-dynamic";

const ABAS = [
  ["modelos", "Modelos de O.S."],
  ["categorias", "Categorias e serviços"],
  ["configuracoes", "Configurações"],
  ["alteracoes", "Histórico de alterações"],
] as const;
type Aba = (typeof ABAS)[number][0];

export default async function Administracao({ searchParams }: { searchParams: Promise<{ aba?: string; pagina?: string }> }) {
  const p = await searchParams;
  const aba: Aba = (ABAS.find(([k]) => k === p.aba)?.[0] ?? "modelos") as Aba;

  return (
    <>
      <div className="titulo-tela">
        <div>
          <h1>Administração</h1>
          <p className="sub">Modelos, serviços e configurações. Toda mudança fica registrada com nome e horário.</p>
        </div>
      </div>
      <nav className="abas-adm filtros" aria-label="Seções da administração">
        {ABAS.map(([k, t]) => (
          <Link key={k} href={k === "modelos" ? "/administracao" : `/administracao?aba=${k}`} className="filtro" aria-current={aba === k ? "page" : undefined} aria-pressed={aba === k} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            {t}
          </Link>
        ))}
      </nav>
      {aba === "modelos" && <ModelosAdm modelos={JSON.parse(JSON.stringify(await listarModelos()))} />}
      {aba === "categorias" && <CategoriasAdm {...await listarCategorias()} />}
      {aba === "configuracoes" && <ConfiguracoesAdm inicial={await configuracoesOS()} />}
      {aba === "alteracoes" && <Alteracoes {...await listarAuditoria(Number(p.pagina) || 1)} pagina={Number(p.pagina) || 1} />}
    </>
  );
}
