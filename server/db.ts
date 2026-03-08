import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let pool: any;
let db: any;

if (process.env.REPL_ID) {
  const { Pool, neonConfig } = await import("@neondatabase/serverless");
  const ws = (await import("ws")).default;
  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  db = drizzle({ client: pool, schema });
} else {
  const pg = (await import("pg")).default;
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const { drizzle } = await import("drizzle-orm/node-postgres");
  db = drizzle({ client: pool, schema });
}

export { db, pool };
