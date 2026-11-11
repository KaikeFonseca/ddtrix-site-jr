// Aplica as migrações de db/migracoes em ordem, uma única vez cada, e cadastra os
// três modelos iniciais de O.S. se ainda não houver nenhum.
// Uso: npm run db:migrar   (lê DATABASE_URL do ambiente ou do .env.local)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (veja .env.example).");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const pasta = join(process.cwd(), "db", "migracoes");
const pastaModelos = join(process.cwd(), "db", "modelos-iniciais");

const MODELOS = [
  { categoria: "caixas", nome: "O.S. Limpeza de caixas", arquivo: "OS_Limp_Cx.docx" },
  { categoria: "dedet", nome: "O.S. Dedetização", arquivo: "OS_DDT.docx" },
  { categoria: "desr", nome: "O.S. Desratização", arquivo: "OS_DSR.docx" },
];

async function semearModelos() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from modelos`;
  if (n > 0) return;
  const campos = JSON.parse(readFileSync(join(pastaModelos, "campos.json"), "utf8"));
  await sql.begin(async (tx) => {
    for (const m of MODELOS) {
      const [{ id }] = await tx<{ id: string }[]>`
        insert into modelos (categoria, nome) values (${m.categoria}, ${m.nome}) returning id`;
      const arquivo = readFileSync(join(pastaModelos, m.arquivo));
      await tx`
        insert into modelo_versoes (modelo_id, numero, arquivo, campos, oficial, notas, criado_por)
        values (${id}, 1, ${arquivo}, ${tx.json(campos[m.categoria])}, true, 'Modelo inicial', 'sistema')`;
    }
  });
  console.log("modelos iniciais cadastrados");
}

async function main() {
  await sql`create table if not exists _migracoes (nome text primary key, aplicada_em timestamptz not null default now())`;
  const feitas = new Set((await sql<{ nome: string }[]>`select nome from _migracoes`).map((r) => r.nome));
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort();
  for (const arquivo of arquivos) {
    if (feitas.has(arquivo)) continue;
    const conteudo = readFileSync(join(pasta, arquivo), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(conteudo);
      await tx`insert into _migracoes (nome) values (${arquivo})`;
    });
    console.log(`aplicada: ${arquivo}`);
  }
  await semearModelos();
  console.log("banco atualizado");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
