import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marca d'água das alterações: toda mudança grava na auditoria, então o maior id
// diz se algo mudou desde a última vez que a tela olhou.
export async function GET() {
  const [{ v }] = await sql<{ v: string }[]>`select coalesce(max(id), 0)::text as v from auditoria`;
  return NextResponse.json({ v }, { headers: { "cache-control": "no-store" } });
}
