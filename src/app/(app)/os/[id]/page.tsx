import { notFound } from "next/navigation";
import { buscarOrdem } from "@/lib/os/servico";
import { pendenciasDe } from "@/lib/os/tipos";
import { ConferirOS } from "./conferir";

export const dynamic = "force-dynamic";

export default async function PaginaOS({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ordem = await buscarOrdem(id);
  if (!ordem) notFound();
  return <ConferirOS ordemInicial={ordem} pendenciasIniciais={ordem.status === "emitida" ? [] : pendenciasDe(ordem.dados)} />;
}
