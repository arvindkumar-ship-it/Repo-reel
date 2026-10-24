import { randomUUID } from "node:crypto";
import type { Artifact } from "@reporeel/shared";
import { store } from "../db/store";
import { getObject, putObject, deleteObjects } from "../storage/s3";
export async function invalidateArtifacts(runId: string, kinds: string[]) {
  const run = await store.run(runId);
  const stale = run?.artifacts.filter((a) => kinds.includes(a.kind)) ?? [];
  await store.removeArtifacts(runId, kinds);
  await deleteObjects(stale.map((a) => a.storageKey));
}
export async function saveArtifact(
  runId: string,
  kind: string,
  name: string,
  body: Buffer | string,
  contentType = "application/json",
) {
  const artifact: Artifact = {
    id: randomUUID(),
    runId,
    kind,
    name,
    contentType,
    storageKey: `${runId}/${name}`,
    bytes: Buffer.byteLength(body),
  };
  await putObject(artifact.storageKey, body, contentType);
  await store.artifact(artifact);
  return artifact;
}
export async function readArtifact<T>(
  runId: string,
  kind: string,
): Promise<T | undefined> {
  const run = await store.run(runId);
  const artifact = run?.artifacts.find((a) => a.kind === kind);
  if (!artifact) return;
  return JSON.parse(
    (await getObject(artifact.storageKey)).toString("utf8"),
  ) as T;
}
