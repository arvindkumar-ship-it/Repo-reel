import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  STAGES,
  WEIGHTS,
  AppError,
  sceneStarts,
  type Stage,
  type RepoModel,
  type LaidOutGraph,
  type Storyboard,
  type RenderProps,
  type SourceFile,
} from "@reporeel/shared";
import { analyze, fetchGithub } from "@reporeel/analyzer";
import {
  inferArchitecture,
  RemoteProvider,
  makeStoryboard,
  validateStoryboard,
  writeNarration,
} from "@reporeel/llm";
import { layoutGraph } from "@reporeel/diagram";
import { exportDiagram } from "../../../api/src/services/diagramExports";
import { prepareRender, renderVideo, toSrt } from "@reporeel/renderer";
import { store } from "../../../api/src/db/store";
import {
  saveArtifact,
  readArtifact,
} from "../../../api/src/services/artifacts";
import { env } from "../../../api/src/env";
import { decrypt } from "../../../api/src/security/crypto";
import { fixtures } from "../../../../tools/seed/fixtures";
import { invalidateArtifacts } from "../../../api/src/services/artifacts";
const controllers = new Map<string, AbortController>();
const active = new Map<string, Promise<void>>();
let renderLock = Promise.resolve();
export function cancelPipeline(id: string) {
  controllers.get(id)?.abort();
}
export function runPipeline(
  runId: string,
  fromStage: Stage = "ingest",
  sample = false,
): Promise<void> {
  const existing = active.get(runId);
  if (existing) return existing;
  const task = executePipeline(runId, fromStage, sample).finally(() =>
    active.delete(runId),
  );
  active.set(runId, task);
  return task;
}
async function executePipeline(
  runId: string,
  fromStage: Stage = "ingest",
  sample = false,
) {
  const run = await store.run(runId);
  if (!run || run.status === "cancelled") return;
  const project = await store.project(run.projectId);
  if (!project) throw new Error("Project no longer exists.");
  const user = await store.user(project.userId);
  const controller = new AbortController();
  controllers.set(runId, controller);
  const work = await mkdtemp(join(tmpdir(), "reporeel-"));
  const monitor = setInterval(() => {
    void store
      .run(runId)
      .then((r) => {
        if (r?.status === "cancelled") controller.abort();
      })
      .catch(() => controller.abort());
  }, 1000);
  let current: Stage = fromStage;
  let sources: SourceFile[] = [];
  let repo = await readArtifact<RepoModel>(runId, "repo_model"),
    graph = await readArtifact<LaidOutGraph>(runId, "laid_out"),
    board = await readArtifact<Storyboard>(runId, "storyboard"),
    props = await readArtifact<RenderProps>(runId, "render_props");
  const index = STAGES.indexOf(fromStage);
  let progressWrites = Promise.resolve();
  const should = (stage: Stage) => STAGES.indexOf(stage) >= index;
  const progress = async (stage: Stage, value: number, message: string) => {
    if (
      controller.signal.aborted ||
      (await store.run(runId))?.status === "cancelled"
    ) {
      controller.abort();
      throw new AppError("CANCELLED", "Run cancelled.");
    }
    current = stage;
    const n = STAGES.indexOf(stage),
      overall =
        WEIGHTS.slice(0, n).reduce((a, b) => a + b, 0) + value * WEIGHTS[n]!;
    await store.patchRun(runId, {
      stage,
      progress: overall,
      status: "running",
    });
    await store.event(runId, {
      stage,
      progress: value,
      message,
      ts: new Date().toISOString(),
      level: "info",
    });
  };
  const getSources = async () => {
    if (sources.length) return;
    if (sample || project.owner === "sample") {
      sources = Object.entries(fixtures.monorepo!).map(([path, content]) => ({
        path,
        content,
      }));
      return;
    }
    const token = user?.tokenEnc
      ? decrypt(user.tokenEnc)
      : process.env.GITHUB_API_TOKEN;
    const data = await fetchGithub(
      project.repoUrl,
      token,
      repo?.meta.commitSha ?? run.options.branch,
      controller.signal,
    );
    if (data.private && !run.options.privateConsent)
      throw new AppError(
        "PRIVATE_CONSENT_REQUIRED",
        "Acknowledge private-code processing in project options.",
      );
    sources = data.sources;
    repo ??= { meta: data.meta } as RepoModel;
    project.visibility = data.private ? "private" : "public";
    await store.saveProject(project);
  };
  try {
    if (should("ingest") || !repo) {
      await progress("ingest", 0, "Fetching repository files safely");
      await getSources();
      if (!repo) {
        const sha = createHash("sha1")
          .update(JSON.stringify(sources))
          .digest("hex");
        repo = {
          meta: {
            owner: "sample",
            repo: "atlas",
            commitSha: sha,
            defaultBranch: "main",
            description:
              "A commerce application with a storefront, API and background jobs.",
            stars: null,
            license: null,
            analyzedAt: new Date().toISOString(),
          },
        } as RepoModel;
      }
      await store.patchRun(runId, { commitSha: repo.meta.commitSha });
      await progress(
        "ingest",
        1,
        "Repository snapshot downloaded; no code executed",
      );
    }
    if (should("analyze") || !repo?.files) {
      await progress(
        "analyze",
        0,
        "Parsing source, routes, manifests and dependencies",
      );
      await getSources();
      repo = await analyze(sources, repo!.meta, controller.signal);
      if (!repo.files.length)
        throw new AppError(
          "EMPTY_REPOSITORY",
          "No supported text files found.",
        );
      await saveArtifact(
        runId,
        "repo_model",
        "repo-model.json",
        JSON.stringify(repo, null, 2),
      );
      await progress(
        "analyze",
        1,
        `${repo.stats.analyzedFileCount} files analyzed; ${repo.stats.totalLoc} lines verified`,
      );
    }
    if (should("infer") || !graph) {
      await progress(
        "infer",
        0,
        "Grouping responsibilities and validating source evidence",
      );
      const key =
        env.LLM_PROVIDER === "anthropic"
          ? process.env.ANTHROPIC_API_KEY
          : process.env.OPENAI_API_KEY;
      const provider =
        env.LLM_PROVIDER === "fixture"
          ? undefined
          : key
            ? new RemoteProvider(env.LLM_PROVIDER, key, controller.signal)
            : undefined;
      const inferred = await inferArchitecture(
        repo!,
        provider,
        process.env.LLM_MODEL_INFER,
        env.LLM_TOKEN_CEILING,
      );
      await store.patchRun(runId, { usage: inferred.usage });
      graph = { ...inferred.graph } as LaidOutGraph;
      await saveArtifact(
        runId,
        "graph",
        "graph.json",
        JSON.stringify(inferred.graph, null, 2),
      );
      await progress(
        "infer",
        1,
        inferred.fallback
          ? "Evidence-based architecture ready"
          : "AI architecture validated against source",
      );
    }
    if (should("layout") || !graph?.bounds) {
      await progress("layout", 0, "Arranging modules with ELK");
      graph = await layoutGraph(graph!);
      await saveArtifact(
        runId,
        "laid_out",
        "laid-out-graph.json",
        JSON.stringify(graph, null, 2),
      );
      await progress("layout", 1, "Deterministic layout complete");
    } else if (!run.artifacts.some((a) => a.kind === "laid_out"))
      await saveArtifact(
        runId,
        "laid_out",
        "laid-out-graph.json",
        JSON.stringify(graph, null, 2),
      );
    if (should("export")) {
      await progress("export", 0, "Creating matching diagram exports");
      await exportDiagram(runId, graph!, run.options.style);
      await progress("export", 1, "Mermaid, Excalidraw, SVG and PNG ready");
    }
    if (should("storyboard") || !board) {
      await progress(
        "storyboard",
        0,
        "Writing a grounded scene-by-scene walkthrough",
      );
      board = makeStoryboard(repo!, graph!, run.options);
      if (env.LLM_PROVIDER !== "fixture") {
        const token =
          env.LLM_PROVIDER === "anthropic"
            ? process.env.ANTHROPIC_API_KEY
            : process.env.OPENAI_API_KEY;
        if (token) {
          const used = (await store.run(runId))!.usage;
          const estimate = 12000;
          if (
            used.inputTokens + used.outputTokens + estimate >
            env.LLM_TOKEN_CEILING
          )
            throw new AppError(
              "LLM_BUDGET_EXCEEDED",
              "Narration would exceed the AI token ceiling.",
            );
          const written = await writeNarration(
            board,
            repo!,
            graph!,
            new RemoteProvider(env.LLM_PROVIDER, token, controller.signal),
            process.env.LLM_MODEL_WRITE,
          );
          board = written.board;
          await store.patchRun(runId, {
            usage: {
              inputTokens: used.inputTokens + written.usage.inputTokens,
              outputTokens: used.outputTokens + written.usage.outputTokens,
            },
          });
        }
      }
      const errors = validateStoryboard(board, repo!, graph!);
      if (errors.length)
        throw new AppError("STORYBOARD_INVALID", errors.join("; "));
      await saveArtifact(
        runId,
        "storyboard",
        "storyboard.json",
        JSON.stringify(board, null, 2),
      );
      await progress(
        "storyboard",
        1,
        `${board.scenes.length} scenes with validated references`,
      );
    }
    if (should("narrate") || !props) {
      await progress(
        "narrate",
        0,
        run.options.voice.provider === "silent"
          ? "Timing captions for silent preview"
          : "Synthesizing voiceover and synchronizing captions",
      );
      const prior = props;
      if (
        board!.scenes.some((s) => s.type === "code" && !prior?.snippets[s.id])
      )
        await getSources();
      props = await prepareRender(
        repo!,
        graph!,
        board!,
        run.options,
        sources,
        controller.signal,
      );
      props.snippets = { ...prior?.snippets, ...props.snippets };
      await saveArtifact(
        runId,
        "render_props",
        "render-props.json",
        JSON.stringify(props),
      );
      await saveArtifact(
        runId,
        "captions",
        "captions.srt",
        toSrt(props.timings, sceneStarts(props)),
        "application/x-subrip",
      );
      await progress("narrate", 1, "Preview, chapters and captions are ready");
    }
    if (env.RENDER_ENABLED === "true") {
      sources = [];
      await invalidateArtifacts(runId, ["video", "poster"]);
      await progress("render", 0, "Waiting for the render slot");
      let unlock!: () => void;
      const prior = renderLock;
      renderLock = new Promise<void>((r) => (unlock = r));
      await prior;
      try {
        await progress("render", 0.01, "Rendering H.264 video at 1920 × 1080");
        let last = 0;
        const rendered = await renderVideo(
          props!,
          work,
          (value) => {
            if (value - last > 0.05) {
              last = value;
              progressWrites = progressWrites
                .then(() => progress("render", value, "Rendering video frames"))
                .catch(() => controller.abort());
            }
          },
          controller.signal,
        );
        await progressWrites;
        controller.signal.throwIfAborted();
        await saveArtifact(
          runId,
          "video",
          "video.mp4",
          await readFile(rendered.video),
          "video/mp4",
        );
        await saveArtifact(
          runId,
          "poster",
          "poster.png",
          await readFile(rendered.poster),
          "image/png",
        );
      } finally {
        unlock();
      }
      await progress("render", 1, "Video and poster are ready");
    } else
      await progress(
        "render",
        1,
        "Interactive preview ready; MP4 rendering is disabled by configuration",
      );
    if (controller.signal.aborted)
      throw new AppError("CANCELLED", "Run cancelled.");
    await store.patchRun(runId, {
      status: "completed",
      progress: 100,
      finishedAt: new Date().toISOString(),
      storyboardDirty: false,
    });
  } catch (error) {
    await progressWrites;
    const cancelled = controller.signal.aborted;
    const known = error instanceof AppError;
    await store.patchRun(runId, {
      status: cancelled ? "cancelled" : "failed",
      stage: current,
      finishedAt: new Date().toISOString(),
      error: cancelled
        ? { code: "CANCELLED", message: "Run cancelled." }
        : {
            code: known
              ? error.code
              : current === "render"
                ? "RENDER_FAILED"
                : "PIPELINE_FAILED",
            message: known
              ? error.message
              : current === "render"
                ? "Video render failed. Earlier artifacts are available."
                : "This stage could not be completed.",
            hint: known
              ? error.hint
              : "Retry this stage. Check worker logs if the error repeats.",
          },
    });
    await store.event(runId, {
      stage: current,
      progress: 0,
      message: cancelled
        ? "Run cancelled"
        : "Stage failed; completed artifacts retained",
      level: "error",
      ts: new Date().toISOString(),
    });
    if (!cancelled)
      console.error(
        `[${runId}] ${current}:`,
        error instanceof Error ? error.message : "Unknown error",
      );
  } finally {
    clearInterval(monitor);
    controllers.delete(runId);
    await rm(work, { recursive: true, force: true });
    sources = [];
  }
}
