import "dotenv/config";
import { Worker } from "bullmq";
import { connection, type PipelineJob } from "../../api/src/queue/queues";
import { runPipeline } from "./pipeline/runPipeline";
const worker = new Worker<PipelineJob>(
  "reporeel-pipeline",
  async (job) => {
    await runPipeline(job.data.runId, job.data.fromStage, job.data.sample);
  },
  {
    connection,
    concurrency: 2,
    lockDuration: 120000,
    stalledInterval: 30000,
    maxStalledCount: 1,
  },
);
worker.on("error", (error) => console.error("Worker error:", error.message));
console.log("RepoReel worker ready (2 pipelines; 1 render slot).");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void worker.close().then(() => process.exit(0));
  });
