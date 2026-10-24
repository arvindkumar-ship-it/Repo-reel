import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, STAGES, type RenderProps } from "@reporeel/shared";
import { store } from "../db/store";
import { userId } from "../auth/github";
import { idParam, ownedRun } from "./projects";
import { enqueue } from "../queue/queues";
import { readArtifact } from "../services/artifacts";
import { signedUrl } from "../storage/s3";
export async function runRoutes(app: FastifyInstance) {
  app.get("/api/v1/runs/:id/status", async (req) => {
    const { id } = idParam.parse(req.params);
    return ownedRun(id, userId(req));
  });
  app.get("/api/v1/runs/:id", async (req) => {
    const { id } = idParam.parse(req.params);
    const run = await ownedRun(id, userId(req));
    return {
      ...run,
      renderProps: await readArtifact<RenderProps>(id, "render_props"),
      share: await store.shareForRun(id),
    };
  });
  app.get("/api/v1/runs/:id/artifacts", async (req) => {
    const { id } = idParam.parse(req.params);
    const run = await ownedRun(id, userId(req));
    return Promise.all(
      run.artifacts.map(async (a) => ({
        ...a,
        url: await signedUrl(a.storageKey, a.name, a.contentType),
      })),
    );
  });
  app.get("/api/v1/artifacts/:id/url", async (req) => {
    const { id } = idParam.parse(req.params);
    const artifact = await store.artifactById(id);
    if (!artifact) throw new AppError("NOT_FOUND", "Artifact not found.", 404);
    await ownedRun(artifact.runId, userId(req));
    return {
      url: await signedUrl(
        artifact.storageKey,
        artifact.name,
        artifact.contentType,
      ),
    };
  });
  app.post("/api/v1/runs/:id/cancel", async (req) => {
    const { id } = idParam.parse(req.params),
      run = await ownedRun(id, userId(req));
    if (!["queued", "running"].includes(run.status))
      throw new AppError("NOT_RUNNING", "This run is no longer active.", 409);
    await store.patchRun(id, {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
    });
    const { cancelPipeline } = await import(
      "../../../worker/src/pipeline/runPipeline"
    );
    cancelPipeline(id);
    return { ok: true };
  });
  app.post("/api/v1/runs/:id/retry", async (req, reply) => {
    const { id } = idParam.parse(req.params),
      run = await ownedRun(id, userId(req));
    const { fromStage } = z
      .object({ fromStage: z.enum(STAGES) })
      .parse(req.body);
    if (!["failed", "cancelled"].includes(run.status))
      throw new AppError(
        "RUN_ACTIVE",
        "Only a failed or cancelled run can be retried.",
        409,
      );
    await store.patchRun(id, {
      status: "queued",
      error: undefined,
      finishedAt: undefined,
    });
    await enqueue({
      runId: id,
      fromStage,
      sample: (await store.project(run.projectId))?.owner === "sample",
    });
    return reply.code(202).send({ runId: id });
  });
  app.post("/api/v1/runs/:id/render", async (req, reply) => {
    const { id } = idParam.parse(req.params),
      run = await ownedRun(id, userId(req));
    if (["queued", "running"].includes(run.status))
      throw new AppError(
        "RUN_ACTIVE",
        "Wait for the active run to finish.",
        409,
      );
    if (!(await readArtifact(id, "storyboard")))
      throw new AppError(
        "STORYBOARD_MISSING",
        "Generate a storyboard first.",
        409,
      );
    await store.patchRun(id, {
      status: "queued",
      error: undefined,
      finishedAt: undefined,
    });
    await enqueue({
      runId: id,
      fromStage: run.storyboardDirty ? "narrate" : "render",
      sample: (await store.project(run.projectId))?.owner === "sample",
    });
    return reply.code(202).send({ runId: id });
  });
  app.get("/api/v1/runs/:id/events", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    await ownedRun(id, userId(req));
    const origin = req.headers.origin;
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
          }
        : {}),
    });
    let last = Number(req.headers["last-event-id"]) || 0,
      closed = false,
      busy = false;
    const send = async () => {
      if (closed || busy) return;
      busy = true;
      try {
        const run = await store.run(id);
        if (!run) {
          reply.raw.end();
          return;
        }
        for (const event of run.events.filter((e) => e.id > last)) {
          reply.raw.write(
            `id: ${event.id}\nevent: progress\ndata: ${JSON.stringify(event)}\n\n`,
          );
          last = event.id;
        }
        reply.raw.write(
          `event: status\ndata: ${JSON.stringify({ status: run.status, stage: run.stage, progress: run.progress, error: run.error })}\n\n`,
        );
        if (["completed", "failed", "cancelled"].includes(run.status))
          reply.raw.end();
        else reply.raw.write(": heartbeat\n\n");
      } finally {
        busy = false;
      }
    };
    const interval = setInterval(() => {
      void send().catch(() => reply.raw.end());
    }, 1000);
    reply.raw.on("close", () => {
      closed = true;
      clearInterval(interval);
    });
    await send();
  });
}
