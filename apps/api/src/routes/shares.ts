import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, type RenderProps } from "@reporeel/shared";
import { store } from "../db/store";
import { userId } from "../auth/github";
import { idParam, ownedRun } from "./projects";
import { readArtifact } from "../services/artifacts";
import { signedUrl } from "../storage/s3";
export async function shareRoutes(app: FastifyInstance) {
  app.post("/api/v1/runs/:id/share", async (req) => {
    const { id } = idParam.parse(req.params),
      run = await ownedRun(id, userId(req));
    if (!run.artifacts.some((a) => a.kind === "render_props"))
      throw new AppError("NOT_READY", "Wait for the preview to be ready.", 409);
    const { privateConsent } = z
      .object({ privateConsent: z.boolean().default(false) })
      .parse(req.body ?? {});
    const project = await store.project(run.projectId);
    if (project?.visibility === "private" && !privateConsent)
      throw new AppError(
        "SHARE_CONSENT_REQUIRED",
        "Public sharing exposes diagrams and code scene excerpts.",
        400,
        "Confirm sharing this private repository.",
      );
    return store.share(id, true);
  });
  app.delete("/api/v1/runs/:id/share", async (req) => {
    const { id } = idParam.parse(req.params);
    await ownedRun(id, userId(req));
    return store.share(id, false);
  });
  app.get("/api/v1/public/:slug", async (req) => {
    const { slug } = z
      .object({ slug: z.string().regex(/^[a-f0-9]{20}$/) })
      .parse(req.params);
    const share = await store.publicShare(slug);
    if (!share)
      throw new AppError(
        "NOT_FOUND",
        "This share is unavailable or has been revoked.",
        404,
      );
    const run = await store.run(share.runId);
    if (!run) throw new AppError("NOT_FOUND", "Shared run not found.", 404);
    const props = await readArtifact<RenderProps>(run.id, "render_props");
    if (!props)
      throw new AppError("NOT_READY", "Preview is not available.", 404);
    const safeProps: RenderProps = {
      ...props,
      repo: {
        ...props.repo,
        files: [],
        entrypoints: [],
        manifests: [],
        clusters: [],
        readmeExcerpt: "",
        infra: { services: [], ci: [], dockerfiles: [] },
        data: { entities: [] },
        warnings: [],
      },
    };
    const video = run.artifacts.find((a) => a.kind === "video");
    return {
      renderProps: safeProps,
      videoUrl: video
        ? await signedUrl(video.storageKey, video.name, video.contentType)
        : undefined,
    };
  });
}
