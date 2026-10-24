import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "@reporeel/shared";
import { z } from "zod";
import { store } from "../db/store";
import { env } from "../env";
import {
  encrypt,
  session,
  parseSession,
  sign,
  validSignature,
} from "../security/crypto";
export const DEMO_USER = "00000000-0000-4000-8000-000000000001";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 86400,
};
export function userId(request: FastifyRequest) {
  const id = parseSession(request.cookies.rr_session);
  if (!id) throw new AppError("UNAUTHORIZED", "Sign in to continue.", 401);
  return id;
}
export async function authRoutes(app: FastifyInstance) {
  app.post("/api/v1/auth/demo", async (_req, reply) => {
    if (env.DEMO_AUTH !== "true" || env.NODE_ENV === "production")
      throw new AppError("NOT_FOUND", "Demo sign-in is unavailable.", 404);
    await store.upsertUser({
      id: DEMO_USER,
      name: "Local workspace",
      plan: "free",
    });
    reply.setCookie("rr_session", session(DEMO_USER), cookieOptions);
    return { ok: true };
  });
  app.post("/api/v1/auth/logout", async (_req, reply) => {
    reply.clearCookie("rr_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/v1/auth/config", async () => ({
    github: !!process.env.GITHUB_CLIENT_ID,
    demo: env.DEMO_AUTH === "true" && env.NODE_ENV !== "production",
    llm: env.LLM_PROVIDER,
    tts: process.env.TTS_PROVIDER ?? "silent",
    render: env.RENDER_ENABLED === "true",
  }));
  app.get("/api/v1/auth/github", async (_req, reply) => {
    if (!process.env.GITHUB_CLIENT_ID)
      throw new AppError(
        "GITHUB_NOT_CONFIGURED",
        "GitHub OAuth is not configured.",
        400,
        "Add GitHub client credentials to .env or try the local workspace.",
      );
    const state = randomBytes(24).toString("hex"),
      expiry = Date.now() + 600000,
      value = state + ":" + expiry;
    reply.setCookie("rr_oauth", value + "." + sign(value), {
      ...cookieOptions,
      maxAge: 600,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
    url.searchParams.set(
      "redirect_uri",
      env.WEB_ORIGIN + "/api/v1/auth/callback",
    );
    url.searchParams.set("scope", "read:user user:email repo");
    url.searchParams.set("state", state);
    return reply.redirect(url.toString());
  });
  app.get("/api/v1/auth/callback", async (req, reply) => {
    const query = z
      .object({ code: z.string().min(1), state: z.string().min(1) })
      .parse(req.query);
    const [value, signature] = req.cookies.rr_oauth?.split(".") ?? [];
    const [state, expiry] = value?.split(":") ?? [];
    if (
      !value ||
      !signature ||
      !validSignature(value, signature) ||
      state !== query.state ||
      Number(expiry) < Date.now()
    )
      throw new AppError(
        "OAUTH_STATE_INVALID",
        "Sign-in session expired.",
        403,
        "Try signing in again.",
      );
    reply.clearCookie("rr_oauth", { path: "/" });
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: query.code,
          redirect_uri: env.WEB_ORIGIN + "/api/v1/auth/callback",
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token)
      throw new AppError(
        "OAUTH_FAILED",
        "GitHub sign-in failed.",
        401,
        "Try connecting again.",
      );
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "User-Agent": "RepoReel",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new AppError(
        "OAUTH_FAILED",
        "GitHub profile could not be loaded.",
        502,
      );
    const github = (await response.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string;
      email: string | null;
    };
    const existing = await store.userByGithub(String(github.id));
    const user = {
      id: existing?.id ?? randomUUID(),
      githubId: String(github.id),
      name: github.name ?? github.login,
      email: github.email ?? undefined,
      avatarUrl: github.avatar_url,
      plan: existing?.plan ?? "free",
      tokenEnc: encrypt(token.access_token),
    };
    await store.upsertUser(user);
    reply.setCookie("rr_session", session(user.id), cookieOptions);
    return reply.redirect("/projects");
  });
}
