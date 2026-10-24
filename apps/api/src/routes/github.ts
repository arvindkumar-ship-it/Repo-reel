import type { FastifyInstance } from "fastify";
import { AppError } from "@reporeel/shared";
import { store } from "../db/store";
import { userId } from "../auth/github";
import { decrypt } from "../security/crypto";
export async function githubRoutes(app: FastifyInstance) {
  app.get("/api/v1/github/repos", async (req) => {
    const user = await store.user(userId(req));
    if (!user?.tokenEnc)
      throw new AppError(
        "GITHUB_NOT_CONNECTED",
        "Connect GitHub to choose your repositories.",
        403,
      );
    const res = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100",
      {
        headers: {
          Authorization: `Bearer ${decrypt(user.tokenEnc)}`,
          "User-Agent": "RepoReel",
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok)
      throw new AppError(
        "GITHUB_ERROR",
        "Repositories could not be loaded.",
        502,
      );
    const repos = (await res.json()) as {
      id: number;
      full_name: string;
      html_url: string;
      private: boolean;
      description: string | null;
    }[];
    return repos.map((r) => ({
      id: r.id,
      name: r.full_name,
      url: r.html_url,
      private: r.private,
      description: r.description,
    }));
  });
  app.delete("/api/v1/github/connection", async (req) => {
    await store.disconnect(userId(req));
    return { ok: true };
  });
}
