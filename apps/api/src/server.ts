import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { AppError } from "@reporeel/shared";
import { env, lite } from "./env";
import { authRoutes, userId } from "./auth/github";
import { projectRoutes } from "./routes/projects";
import { runRoutes } from "./routes/runs";
import { shareRoutes } from "./routes/shares";
import { editRoutes } from "./routes/edits";
import { githubRoutes } from "./routes/github";
import { getObjectStream, localObjectPath } from "./storage/s3";
import { validSignature } from "./security/crypto";
import { closeQueue } from "./queue/queues";
import { pool } from "./db/client";
import { store } from "./db/store";
export async function createServer() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            redact: [
              "req.headers.cookie",
              "req.headers.authorization",
              "res.headers.set-cookie",
            ],
          },
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: false,
  });
  await app.register(cookie);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(rateLimit, {
    max: env.API_RATE_LIMIT,
    timeWindow: "1 minute",
  });
  app.addHook("onRequest", async (req) => {
    if (
      ["POST", "PATCH", "DELETE", "PUT"].includes(req.method) &&
      req.headers.origin !== env.WEB_ORIGIN
    )
      throw new AppError(
        "CSRF_REJECTED",
        "Request origin is not allowed.",
        403,
      );
    const url = req.url.split("?")[0]!;
    if (
      url.startsWith("/api/v1/") &&
      !["/api/v1/auth/", "/api/v1/public/", "/api/v1/files/"].some((p) =>
        url.startsWith(p),
      ) &&
      url !== "/api/v1/health"
    ) {
      const id = userId(req);
      if (!(await store.user(id)))
        throw new AppError("UNAUTHORIZED", "Sign in to continue.", 401);
    }
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "SAMEORIGIN");
    return payload;
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        error: {
          code: "INVALID_INPUT",
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
            .slice(0, 500),
        },
      });
    if (error instanceof AppError)
      return reply.code(error.status).send({
        error: { code: error.code, message: error.message, hint: error.hint },
      });
    const code = (error as { statusCode?: number }).statusCode;
    if (code === 429)
      return reply.code(429).send({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again shortly.",
        },
      });
    if (code && code >= 400 && code < 500)
      return reply
        .code(code)
        .send({
          error: {
            code: code === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_REQUEST",
            message:
              code === 413
                ? "The request body is too large."
                : "The request format is invalid.",
          },
        });
    app.log.error({
      message: error instanceof Error ? error.message : "Unknown server error",
    });
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        hint: "Retry in a moment.",
      },
    });
  });
  app.get("/health", async () => ({ ok: true, mode: lite ? "lite" : "full" }));
  app.get("/api/v1/health", async () => ({
    ok: true,
    mode: lite ? "lite" : "full",
  }));
  app.get("/api/v1/files/:runId/:name", async (req, reply) => {
    const p = z
        .object({
          runId: z.string().uuid(),
          name: z.string().regex(/^[a-zA-Z0-9_.-]+$/),
        })
        .parse(req.params),
      q = z
        .object({
          expires: z.coerce.number(),
          signature: z.string(),
          name: z.string().max(150),
          type: z.string().max(100),
        })
        .parse(req.query);
    const key = `${p.runId}/${p.name}`;
    localObjectPath(key);
    if (
      q.expires < Date.now() ||
      q.expires > Date.now() + 3600000 ||
      !validSignature(`${key}:${q.expires}:${q.name}:${q.type}`, q.signature)
    )
      throw new AppError(
        "LINK_EXPIRED",
        "Download link expired.",
        403,
        "Refresh the exports page.",
      );
    reply
      .header("Content-Type", q.type)
      .header(
        "Content-Disposition",
        `attachment; filename="${q.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`,
      )
      .header("Cache-Control", "private, max-age=0");
    return getObjectStream(key);
  });
  await authRoutes(app);
  await projectRoutes(app);
  await runRoutes(app);
  await editRoutes(app);
  await shareRoutes(app);
  await githubRoutes(app);
  app.addHook("onClose", async () => {
    await closeQueue();
    if (!lite) await pool.end();
  });
  return app;
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/server.ts")) {
  const app = await createServer();
  await app.listen({ host: "127.0.0.1", port: 4000 });
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      void app.close().then(() => process.exit(0));
    });
}
