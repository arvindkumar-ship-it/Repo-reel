import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "./client";

export async function applyMigrations() {
  const root = new URL("./migrations/", import.meta.url);
  const files = (await readdir(fileURLToPath(root)))
    .filter((f) => /^\d+_[\w-]+\.sql$/.test(f))
    .sort();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('reporeel:migrations'))",
    );
    await client.query(
      "CREATE TABLE IF NOT EXISTS reporeel_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const file of files) {
      const applied = await client.query(
        "SELECT name FROM reporeel_migrations WHERE name=$1",
        [file],
      );
      if (applied.rowCount) continue;
      await client.query(await readFile(new URL(file, root), "utf8"));
      await client.query("INSERT INTO reporeel_migrations(name) VALUES($1)", [
        file,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
