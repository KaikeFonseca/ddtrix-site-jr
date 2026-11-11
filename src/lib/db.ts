import postgres from "postgres";

// Uma conexão compartilhada por processo (reaproveitada no modo dev do Next).
const globalParaDb = globalThis as unknown as { _sql?: ReturnType<typeof postgres> };

export const sql =
  globalParaDb._sql ??
  postgres(process.env.DATABASE_URL ?? "", {
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalParaDb._sql = sql;
