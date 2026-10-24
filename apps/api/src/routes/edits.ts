import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AppError,
  StoryboardSchema,
  sceneStarts,
  type LaidOutGraph,
  type RenderProps,
  type RepoModel,
} from "@reporeel/shared";
import { validateGraph, layoutGraph } from "@reporeel/diagram";
import { validateStoryboard } from "@reporeel/llm";
import { silentTimings, toSrt } from "@reporeel/renderer";
import { store } from "../db/store";
import { userId } from "../auth/github";
import { idParam, ownedRun } from "./projects";
import {
  saveArtifact,
  readArtifact,
  invalidateArtifacts,
} from "../services/artifacts";
import { exportDiagram } from "../services/diagramExports";
export async function editRoutes(app: FastifyInstance) {
  app.patch("/api/v1/runs/:id/graph", async (req) => {
    const { id } = idParam.parse(req.params),
      run = await ownedRun(id, userId(req));
    if (["queued", "running"].includes(run.status))
      throw new AppError("RUN_ACTIVE", "Wait for the run to finish.", 409);
    const changes = z
      .object({
        nodes: z
          .array(
            z.object({
              id: z.string(),
              label: z.string().min(1).max(28),
              summary: z.string().max(160),
            }),
          )
          .max(150),
        style: z.enum(["clean", "sketch"]).optional(),
        layoutOverrides: z
          .record(
            z.object({
              x: z.number().finite().min(-10000).max(10000),
              y: z.number().finite().min(-10000).max(10000),
            }),
          )
          .optional(),
      })
      .parse(req.body);
    const graph = await readArtifact<LaidOutGraph>(id, "laid_out"),
      repo = await readArtifact<RepoModel>(id, "repo_model");
    if (!graph || !repo)
      throw new AppError(
        "GRAPH_MISSING",
        "Generate an architecture first.",
        409,
      );
    for (const edit of changes.nodes) {
      const node = graph.nodes.find((n) => n.id === edit.id);
      if (!node)
        throw new AppError("UNKNOWN_NODE", "A selected node no longer exists.");
      Object.assign(node, edit);
    }
    const validated = validateGraph(graph, repo);
    if (!validated.graph)
      throw new AppError("GRAPH_INVALID", validated.errors.join("; "));
    const laid = await layoutGraph(validated.graph, {
      ...graph.layoutOverrides,
      ...changes.layoutOverrides,
    });
    await saveArtifact(
      id,
      "laid_out",
      "laid-out-graph.json",
      JSON.stringify(laid, null, 2),
    );
    await saveArtifact(
      id,
      "graph",
      "graph.json",
      JSON.stringify(validated.graph, null, 2),
    );
    const options = {
      ...run.options,
      ...(changes.style ? { style: changes.style } : {}),
    };
    await exportDiagram(id, laid, options.style);
    const props = await readArtifact<RenderProps>(id, "render_props");
    if (props)
      await saveArtifact(
        id,
        "render_props",
        "render-props.json",
        JSON.stringify({ ...props, graph: laid, style: options.style }),
      );
    await store.patchRun(id, { storyboardDirty: true, options });
    await invalidateArtifacts(id, ["video", "poster"]);
    return { graph: laid };
  });
  app.patch("/api/v1/runs/:id/storyboard", async (req) => {
    const { id } = idParam.parse(req.params),
      run = await ownedRun(id, userId(req));
    if (["queued", "running"].includes(run.status))
      throw new AppError("RUN_ACTIVE", "Wait for the run to finish.", 409);
    const board = StoryboardSchema.parse(req.body),
      props = await readArtifact<RenderProps>(id, "render_props");
    if (board.targetSeconds !== run.options.targetSeconds)
      throw new AppError(
        "DURATION_MISMATCH",
        "Keep the duration selected for this run. Create a new run to change video length.",
      );
    if (!props)
      throw new AppError(
        "STORYBOARD_MISSING",
        "Generate a storyboard first.",
        409,
      );
    const errors = validateStoryboard(board, props.repo, props.graph);
    if (errors.length)
      throw new AppError("STORYBOARD_INVALID", errors.join("; "));
    const updated = {
      ...props,
      storyboard: board,
      timings: silentTimings(board),
      snippets: Object.fromEntries(
        Object.entries(props.snippets).filter(([key]) => {
          const before = props.storyboard.scenes.find((s) => s.id === key);
          const after = board.scenes.find((s) => s.id === key);
          return (
            before?.type === "code" &&
            after?.type === "code" &&
            before.path === after.path &&
            before.startLine === after.startLine &&
            before.endLine === after.endLine
          );
        }),
      ),
    };
    await saveArtifact(
      id,
      "storyboard",
      "storyboard.json",
      JSON.stringify(board, null, 2),
    );
    await saveArtifact(
      id,
      "render_props",
      "render-props.json",
      JSON.stringify(updated),
    );
    await saveArtifact(
      id,
      "captions",
      "captions.srt",
      toSrt(updated.timings, sceneStarts(updated)),
      "application/x-subrip",
    );
    await invalidateArtifacts(id, ["video", "poster"]);
    await store.patchRun(id, { storyboardDirty: true });
    return { ok: true };
  });
  app.post("/api/v1/runs/:id/scenes/:sceneId/regenerate", async (req) => {
    const { id, sceneId } = z
      .object({ id: z.string().uuid(), sceneId: z.string().max(100) })
      .parse(req.params);
    const run = await ownedRun(id, userId(req));
    if (["queued", "running"].includes(run.status))
      throw new AppError("RUN_ACTIVE", "Wait for the run to finish.", 409);
    const props = await readArtifact<RenderProps>(id, "render_props");
    if (!props)
      throw new AppError(
        "STORYBOARD_MISSING",
        "Generate a storyboard first.",
        409,
      );
    const { makeStoryboard } = await import("@reporeel/llm");
    const generated = makeStoryboard(props.repo, props.graph, run.options);
    const scene = generated.scenes.find((s) => s.id === sceneId);
    if (!scene)
      throw new AppError(
        "SCENE_NOT_FOUND",
        "This custom scene has no generated equivalent.",
        404,
      );
    return scene;
  });
}
