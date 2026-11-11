import Link from "next/link";
import { Icone } from "@/components/icone";
import { configuracoesOS } from "@/lib/os/servico";
import { FormCliente } from "../form-cliente";

export const dynamic = "force-dynamic";

export default async function NovoCliente() {
  const config = await configuracoesOS();
  return (
    <div style={{ maxWidth: 640 }}>
      <Link href="/clientes" className="botao botao-fantasma" style={{ margin: "-8px 0 8px -12px" }}>
        <Icone nome="voltar" />
        Clientes
      </Link>
      <FormCliente inicial={{ nome: "", telefones: [], observacoes: null }} cidadePadrao={config.cidadePadrao} />
    </div>
  );
}
