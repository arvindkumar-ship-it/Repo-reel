import { pool } from "./client";
import { applyMigrations } from "./migrations";
try {
  await applyMigrations();
} finally {
  await pool.end();
}
console.log("Database schema is ready.");
