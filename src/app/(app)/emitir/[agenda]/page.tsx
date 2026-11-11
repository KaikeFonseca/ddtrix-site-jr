import { notFound } from "next/navigation";
import { buscarAgenda, ordensDaAgenda } from "@/lib/os/servico";
import { pendenciasDe, situacao } from "@/lib/os/tipos";
import { DiaEmLinha, type ItemDia } from "./dia-em-linha";

export const dynamic = "force-dynamic";

export default async function AgendaInterpretada({ params }: { params: Promise<{ agenda: string }> }) {
  const { agenda: id } = await params;
  const agenda = await buscarAgenda(id);
  if (!agenda) notFound();
  const ordens = await ordensDaAgenda(id);

  const itens: ItemDia[] = ordens.map((o) => ({
    id: o.id,
    numero: o.numero,
    status: o.status,
    situacao: o.status === "emitida" ? "ok" : situacao(o.dados),
    pendencias: o.status === "emitida" ? [] : pendenciasDe(o.dados),
    avisos: o.dados.avisosLeitura,
    cliente: o.dados.cliente,
    reconhecido: o.dados.reconhecimento.tipo === "reconhecido",
    possivel: o.dados.reconhecimento.tipo === "possivel" ? o.dados.reconhecimento.nome : null,
    data: o.dados.data,
    hora: o.dados.hora,
    categoria: o.dados.categoria,
    sufixo: o.dados.sufixo,
    servico: o.dados.servico,
    endereco: [o.dados.rua, o.dados.bairro, o.dados.cidade !== "Sorocaba/SP" ? o.dados.cidade : null].filter(Boolean).join(" · "),
    observacao: o.dados.observacoes[0] ?? null,
    maisObservacoes: Math.max(0, o.dados.observacoes.length - 1),
    pagamento: o.dados.pagamento,
    divergencia: o.dados.divergencia && !o.dados.divergencia.escolha ? o.dados.divergencia.salvo.rua : null,
  }));

  return <DiaEmLinha itens={itens} textoOriginal={agenda.texto} />;
}
