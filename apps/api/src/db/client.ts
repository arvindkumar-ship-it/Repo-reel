import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import * as schema from "./schema";
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 8 });
export const db = drizzle(pool, { schema });
