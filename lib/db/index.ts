import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

// Standard Postgres TCP + a module-scope pool, not the WebSocket-based
// @neondatabase/serverless driver — this is the current recommendation for
// Vercel's Fluid Compute model, which keeps a function instance (and this
// module's globals) alive across invocations, so the pool is genuinely
// reused rather than reconnected every request. attachDatabasePool() lets
// Vercel drain idle connections gracefully before an instance is suspended,
// which is what makes reusing a pool here safe instead of a connection leak.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
