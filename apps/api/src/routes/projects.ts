import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AppError,
  OptionsSchema,
  type Project,
  type Run,
} from "@reporeel/shared";
import { parseGithubUrl } from "@reporeel/analyzer";
import { store } from "../db/store";
import { userId } from "../auth/github";
import { enqueue } from "../queue/queues";
import { deleteObjects } from "../storage/s3";
export const idParam = z.object({ id: z.string().uuid() });
export async function ownedProject(id: string, uid: string) {
  const project = await store.project(id);
  if (!project || project.userId !== uid)
    throw new AppError("NOT_FOUND", "Project not found.", 404);
  return project;
}
export async function ownedRun(id: string, uid: string) {
  const run = await store.run(id);
  if (!run) throw new AppError("NOT_FOUND", "Run not found.", 404);
  await ownedProject(run.projectId, uid);
  return run;
}
export async function projectRoutes(app: FastifyInstance) {
  app.get("/api/v1/me", async (req) => {
    const id = userId(req),
      user = await store.user(id);
    if (!user) throw new AppError("UNAUTHORIZED", "Sign in to continue.", 401);
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      githubConnected: !!user.tokenEnc,
      usage: await store.usage(id),
    };
  });
  app.delete("/api/v1/me", async (req) => {
    const id = userId(req);
    for (const project of await store.projects(id))
      for (const run of await store.runs(project.id)) {
        if (["queued", "running"].includes(run.status))
          throw new AppError(
            "RUN_ACTIVE",
            "Cancel active runs before deleting your account.",
            409,
          );
        await deleteObjects(run.artifacts.map((a) => a.storageKey));
      }
    await store.deleteUser(id);
    return { ok: true };
  });
  app.get("/api/v1/projects", async (req) => {
    const projects = await store.projects(userId(req));
    return Promise.all(
      projects.map(async (p) => ({
        ...p,
        latestRun: (await store.runs(p.id, false))[0],
      })),
    );
  });
  app.post("/api/v1/projects", async (req) => {
    const { repoUrl } = z
      .object({ repoUrl: z.string().max(500) })
      .parse(req.body);
    const parsed = parseGithubUrl(repoUrl),
      now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      userId: userId(req),
      name: parsed.repo,
      owner: parsed.owner,
      repo: parsed.repo,
      repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}${parsed.branch ? "/tree/" + parsed.branch.split("/").map(encodeURIComponent).join("/") : ""}`,
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    };
    await store.saveProject(project);
    return project;
  });
  app.get("/api/v1/projects/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    return {
      ...(await ownedProject(id, userId(req))),
      runs: await store.runs(id, false),
    };
  });
  app.delete("/api/v1/projects/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    await ownedProject(id, userId(req));
    const runs = await store.runs(id);
    if (runs.some((r) => ["queued", "running"].includes(r.status)))
      throw new AppError(
        "RUN_ACTIVE",
        "Cancel active runs before deleting a project.",
        409,
      );
    for (const run of runs)
      await deleteObjects(run.artifacts.map((a) => a.storageKey));
    await store.deleteProject(id);
    return { ok: true };
  });
  app.post(
    "/api/v1/projects/:id/runs",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
          keyGenerator: (req) => userId(req),
        },
      },
    },
    async (req, reply) => {
      const { id } = idParam.parse(req.params),
        uid = userId(req),
        project = await ownedProject(id, uid);
      const { options } = z.object({ options: OptionsSchema }).parse(req.body);
      const user = await store.user(uid);
      if (user?.plan === "free" && options.targetSeconds > 60)
        throw new AppError(
          "PLAN_LIMIT",
          "The free plan supports up to 60 seconds.",
          403,
          "Choose a 30 or 60 second video.",
        );
      if (
        (await store.runs(id, false)).some((r) =>
          ["queued", "running"].includes(r.status),
        )
      )
        throw new AppError(
          "RUN_ACTIVE",
          "This project already has an active run.",
          409,
        );
      await store.reserveUsage(
        uid,
        options.targetSeconds,
        user?.plan === "free" ? 3 : 1000,
      );
      const now = new Date().toISOString();
      const run: Run = {
        id: randomUUID(),
        projectId: id,
        status: "queued",
        stage: "ingest",
        progress: 0,
        options,
        commitSha: "",
        events: [],
        artifacts: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        startedAt: now,
      };
      await store.saveRun(run);
      await store.saveProject({ ...project, updatedAt: now });
      try {
        await enqueue({
          runId: run.id,
          fromStage: "ingest",
          sample: project.owner === "sample",
        });
      } catch {
        await store.patchRun(run.id, {
          status: "failed",
          error: {
            code: "QUEUE_UNAVAILABLE",
            message: "Worker queue is unavailable.",
            hint: "Start Redis and retry.",
          },
        });
        throw new AppError(
          "QUEUE_UNAVAILABLE",
          "Worker queue is unavailable.",
          503,
        );
      }
      return reply.code(202).send({ runId: run.id });
    },
  );
}
