import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

function getSql() {
  if (!client) {
    client = postgres(process.env.DATABASE_URL!, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      ssl: process.env.DATABASE_URL?.includes("sslmode=require")
        ? "require"
        : false,
    });
  }
  return client;
}

export async function query(sqlStr: string, params: unknown[] = []) {
  const sql = getSql();
  const result = await sql.unsafe(sqlStr, params as never[]);
  return { rows: result as Record<string, unknown>[] };
}
