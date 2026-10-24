import { Queue } from "bullmq";
import { env, lite } from "../env";
import type { Stage } from "@reporeel/shared";
export const connection = (() => {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
})();
export type PipelineJob = { runId: string; fromStage: Stage; sample?: boolean };
let queue: Queue<PipelineJob> | undefined;
export async function enqueue(job: PipelineJob) {
  if (lite) {
    const { runPipeline } = await import(
      "../../../worker/src/pipeline/runPipeline"
    );
    setImmediate(() => {
      void runPipeline(job.runId, job.fromStage, job.sample);
    });
    return;
  }
  queue ??= new Queue<PipelineJob>("reporeel-pipeline", { connection });
  await queue.add("pipeline", job, {
    jobId: job.runId + "-" + Date.now(),
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}
export async function closeQueue() {
  await queue?.close();
}
