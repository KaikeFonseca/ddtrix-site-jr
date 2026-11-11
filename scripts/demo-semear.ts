// Prepara um banco de demonstração com algumas O.S. já emitidas (dados fictícios).
// Uso: DATABASE_URL=... npx tsx scripts/demo-semear.ts
import { sql } from "../src/lib/db";
import { emitirOrdens, interpretarEGuardar, ordensDaAgenda, alterarOrdem } from "../src/lib/os/servico";

const AGENDA = `AGENDA (Quinta-Feira) 05/11
1.
📅 DATA: 05/11/2026
👤 CLIENTE: Condomínio Montanhan
📍 SERVIÇO: Limpeza de caixa D'água
🚗 LOCAL: Rua Almirante Giachetta, 180 - Parque Campolim
⏰ HORÁRIO APROXIMADO: 11Hrs
💰 Pagamento: Pix
2.
📅 DATA: 05/11/2026
👤 CLIENTE: Padaria Pão de Ouro
📍 SERVIÇO: Dedetização baratas
🚗 LOCAL: Av. São Paulo, 1200 - Centro
⏰ HORÁRIO APROXIMADO: 15:00Hrs
· Nota: Fazer depois que fechar a loja.
3.
📅 DATA: 06/11/2026
👤 CLIENTE: Pedro Luiz Silva Pinto
📍 SERVIÇO: Desratização
🚗 LOCAL: Av. Italia, 277 - parque Monte Bianco, Aracoiaba da Serra
⏰ HORÁRIO APROXIMADO: 09Hrs`;

async function main() {
  const { agendaId } = await interpretarEGuardar(AGENDA, "Juninho");
  const ordens = await ordensDaAgenda(agendaId);
  for (const o of ordens) await alterarOrdem(o.id, { conferida: true }, "Juninho");
  await emitirOrdens(ordens.map((o) => o.id), "Juninho");
  console.log(`${ordens.length} O.S. de demonstração emitidas`);
  await sql.end();
}
main();
