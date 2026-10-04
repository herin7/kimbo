import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.js";

export function createDatabase(connectionString: string) {
  // A Lambda instance serves one request at a time, so one connection is enough there.
  const max = process.env.AWS_LAMBDA_FUNCTION_NAME ? 1 : 10;
  const pool = new Pool({ connectionString, max, idleTimeoutMillis: 30_000 });
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

export type Database = ReturnType<typeof createDatabase>["db"];
