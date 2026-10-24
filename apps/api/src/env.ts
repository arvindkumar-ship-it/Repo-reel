import "dotenv/config";
import { z } from "zod";
const Env = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  API_RATE_LIMIT: z.coerce.number().int().min(1).max(10000).default(60),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_URL: z
    .string()
    .default("postgres://reporeel:reporeel@localhost:5432/reporeel"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("local-development-secret-change-before-deploy"),
  TOKEN_ENC_KEY: z.string().default(""),
  STORAGE_MODE: z.enum(["s3", "local"]).default("s3"),
  DEMO_AUTH: z.enum(["true", "false"]).default("true"),
  RENDER_ENABLED: z.enum(["true", "false"]).default("true"),
  LLM_PROVIDER: z.enum(["fixture", "anthropic", "openai"]).default("fixture"),
  LLM_TOKEN_CEILING: z.coerce.number().positive().default(120000),
});
export const env = Env.parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (env.DEMO_AUTH === "true" ||
    env.SESSION_SECRET.startsWith("local-") ||
    Buffer.from(env.TOKEN_ENC_KEY, "base64").length !== 32)
)
  throw new Error(
    "Production requires DEMO_AUTH=false, a unique SESSION_SECRET and a base64 32-byte TOKEN_ENC_KEY.",
  );
export const lite = process.env.REPOREEL_LITE === "true";
