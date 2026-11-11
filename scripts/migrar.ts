// Aplica as migrações de db/migracoes em ordem, uma única vez cada.
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
  console.log("banco atualizado");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
