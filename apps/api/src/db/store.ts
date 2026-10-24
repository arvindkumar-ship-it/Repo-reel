import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, sql, desc } from "drizzle-orm";
import {
  AppError,
  type Project,
  type Run,
  type Artifact,
  type RunEvent,
} from "@reporeel/shared";
import { db } from "./client";
import * as tables from "./schema";
import { lite } from "../env";
export type User = {
  id: string;
  githubId?: string;
  email?: string;
  name: string;
  avatarUrl?: string;
  plan: string;
  tokenEnc?: string;
};
export type Share = {
  id: string;
  runId: string;
  slug: string;
  isPublic: boolean;
};
type State = {
  users: User[];
  projects: Project[];
  runs: Run[];
  shares: Share[];
  usage: Record<string, { runs: number; renderSeconds: number }>;
};
const dataDir = resolve(process.env.REPOREEL_DATA_DIR ?? ".data");
const file = resolve(dataDir, "state.json");
let lock = Promise.resolve();
async function fileState<T>(
  mutate: (state: State) => T,
  write = false,
): Promise<T> {
  let release!: () => void;
  const prior = lock;
  lock = new Promise<void>((r) => (release = r));
  await prior;
  try {
    let state: State;
    try {
      state = JSON.parse(await readFile(file, "utf8")) as State;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      state = { users: [], projects: [], runs: [], shares: [], usage: {} };
    }
    const result = mutate(state);
    if (write) {
      await mkdir(dataDir, { recursive: true });
      const temp = file + ".tmp";
      await writeFile(temp, JSON.stringify(state));
      await rename(temp, file);
    }
    return result;
  } finally {
    release();
  }
}
const toProject = (p: typeof tables.projects.$inferSelect): Project => ({
  ...p,
  visibility: p.visibility as Project["visibility"],
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});
const toRunSummary = (row: typeof tables.runs.$inferSelect): Run => ({
  ...row,
  options: row.options as Run["options"],
  usage: row.usage as Run["usage"],
  status: row.status as Run["status"],
  stage: row.stage as Run["stage"],
  error: (row.error ?? undefined) as Run["error"],
  storyboardDirty: row.storyboardDirty ?? false,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString(),
  events: [],
  artifacts: [],
});
export const store = {
  async user(id: string): Promise<User | undefined> {
    if (lite) return fileState((s) => s.users.find((u) => u.id === id));
    const [u] = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.id, id));
    if (!u) return;
    const [token] = await db
      .select()
      .from(tables.githubTokens)
      .where(eq(tables.githubTokens.userId, id));
    return {
      id: u.id,
      name: u.name,
      githubId: u.githubId ?? undefined,
      email: u.email ?? undefined,
      avatarUrl: u.avatarUrl ?? undefined,
      plan: u.plan,
      tokenEnc: token?.tokenEnc,
    };
  },
  async upsertUser(user: User) {
    if (lite)
      return fileState((s) => {
        const existing = s.users.find((u) => u.id === user.id);
        if (existing) Object.assign(existing, user);
        else s.users.push(user);
      }, true);
    await db
      .insert(tables.users)
      .values(user)
      .onConflictDoUpdate({
        target: tables.users.id,
        set: { name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      });
    if (user.tokenEnc)
      await db
        .insert(tables.githubTokens)
        .values({
          userId: user.id,
          tokenEnc: user.tokenEnc,
          scopes: "repo read:user",
        })
        .onConflictDoUpdate({
          target: tables.githubTokens.userId,
          set: { tokenEnc: user.tokenEnc, updatedAt: new Date() },
        });
  },
  async userByGithub(githubId: string) {
    if (lite)
      return fileState((s) => s.users.find((u) => u.githubId === githubId));
    const [row] = await db
      .select()
      .from(tables.users)
      .where(eq(tables.users.githubId, githubId));
    return row ? this.user(row.id) : undefined;
  },
  async disconnect(id: string) {
    if (lite)
      return fileState((s) => {
        const user = s.users.find((u) => u.id === id);
        if (user) delete user.tokenEnc;
      }, true);
    await db
      .delete(tables.githubTokens)
      .where(eq(tables.githubTokens.userId, id));
  },
  async deleteUser(id: string) {
    if (lite)
      return fileState((s) => {
        const projectIds = new Set(
          s.projects.filter((p) => p.userId === id).map((p) => p.id),
        );
        const runIds = new Set(
          s.runs.filter((r) => projectIds.has(r.projectId)).map((r) => r.id),
        );
        s.users = s.users.filter((u) => u.id !== id);
        s.projects = s.projects.filter((p) => !projectIds.has(p.id));
        s.runs = s.runs.filter((r) => !runIds.has(r.id));
        s.shares = s.shares.filter((sh) => !runIds.has(sh.runId));
      }, true);
    await db.delete(tables.users).where(eq(tables.users.id, id));
  },
  async projects(userId: string): Promise<Project[]> {
    if (lite)
      return fileState((s) =>
        s.projects
          .filter((p) => p.userId === userId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    return (
      await db
        .select()
        .from(tables.projects)
        .where(eq(tables.projects.userId, userId))
        .orderBy(desc(tables.projects.updatedAt))
    ).map(toProject);
  },
  async project(id: string): Promise<Project | undefined> {
    if (lite) return fileState((s) => s.projects.find((p) => p.id === id));
    const [row] = await db
      .select()
      .from(tables.projects)
      .where(eq(tables.projects.id, id));
    return row ? toProject(row) : undefined;
  },
  async saveProject(project: Project) {
    if (lite)
      return fileState((s) => {
        const p = s.projects.find((p) => p.id === project.id);
        if (p) Object.assign(p, project);
        else s.projects.push(project);
      }, true);
    const value = {
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
    };
    await db
      .insert(tables.projects)
      .values(value)
      .onConflictDoUpdate({
        target: tables.projects.id,
        set: {
          name: project.name,
          updatedAt: value.updatedAt,
          visibility: project.visibility,
        },
      });
  },
  async deleteProject(id: string) {
    if (lite)
      return fileState((s) => {
        const ids = new Set(
          s.runs.filter((r) => r.projectId === id).map((r) => r.id),
        );
        s.projects = s.projects.filter((p) => p.id !== id);
        s.runs = s.runs.filter((r) => !ids.has(r.id));
        s.shares = s.shares.filter((sh) => !ids.has(sh.runId));
      }, true);
    await db.delete(tables.projects).where(eq(tables.projects.id, id));
  },
  async runs(projectId: string, includeDetails = true): Promise<Run[]> {
    if (lite)
      return fileState((s) =>
        s.runs
          .filter((r) => r.projectId === projectId)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .map((r) =>
            includeDetails ? r : { ...r, events: [], artifacts: [] },
          ),
      );
    const rows = await db
      .select()
      .from(tables.runs)
      .where(eq(tables.runs.projectId, projectId))
      .orderBy(desc(tables.runs.startedAt));
    if (!includeDetails) return rows.map(toRunSummary);
    return (await Promise.all(rows.map((r) => this.run(r.id)))).filter(
      (r): r is Run => !!r,
    );
  },
  async run(id: string): Promise<Run | undefined> {
    if (lite) return fileState((s) => s.runs.find((r) => r.id === id));
    const [row] = await db
      .select()
      .from(tables.runs)
      .where(eq(tables.runs.id, id));
    if (!row) return;
    const events = await db
      .select()
      .from(tables.runEvents)
      .where(eq(tables.runEvents.runId, id))
      .orderBy(tables.runEvents.id);
    const artifacts = await db
      .select()
      .from(tables.artifacts)
      .where(eq(tables.artifacts.runId, id));
    return {
      ...toRunSummary(row),
      events: events.map((e) => ({
        ...e,
        ts: e.ts.toISOString(),
        stage: e.stage as RunEvent["stage"],
        level: e.level as RunEvent["level"],
      })),
      artifacts: artifacts.map((a) => ({
        id: a.id,
        runId: a.runId,
        kind: a.kind,
        storageKey: a.storageKey,
        contentType: a.contentType,
        bytes: a.bytes,
        name: (a.meta as { name: string }).name,
      })),
    };
  },
  async saveRun(run: Run) {
    if (lite)
      return fileState((s) => {
        const r = s.runs.find((r) => r.id === run.id);
        if (r) Object.assign(r, run);
        else s.runs.push(run);
      }, true);
    const { events: _events, artifacts: _artifacts, ...data } = run;
    const value = {
      ...data,
      error: data.error ?? null,
      startedAt: new Date(data.startedAt),
      finishedAt: data.finishedAt ? new Date(data.finishedAt) : null,
    };
    await db
      .insert(tables.runs)
      .values(value)
      .onConflictDoUpdate({ target: tables.runs.id, set: value });
  },
  async patchRun(id: string, patch: Partial<Run>) {
    if (lite)
      return fileState((s) => {
        const r = s.runs.find((r) => r.id === id);
        if (r) Object.assign(r, patch);
      }, true);
    const {
      events: _events,
      artifacts: _artifacts,
      startedAt,
      finishedAt,
      ...value
    } = patch;
    await db
      .update(tables.runs)
      .set({
        ...value,
        ...("error" in patch ? { error: patch.error ?? null } : {}),
        ...("finishedAt" in patch
          ? { finishedAt: finishedAt ? new Date(finishedAt) : null }
          : {}),
        ...(startedAt ? { startedAt: new Date(startedAt) } : {}),
        ...(finishedAt ? { finishedAt: new Date(finishedAt) } : {}),
      })
      .where(eq(tables.runs.id, id));
  },
  async event(runId: string, event: Omit<RunEvent, "id">) {
    if (lite)
      return fileState((s) => {
        const run = s.runs.find((r) => r.id === runId);
        if (run)
          run.events.push({ ...event, id: (run.events.at(-1)?.id ?? 0) + 1 });
      }, true);
    await db
      .insert(tables.runEvents)
      .values({ ...event, runId, ts: new Date(event.ts) });
  },
  async artifact(artifact: Artifact) {
    if (lite)
      return fileState((s) => {
        const run = s.runs.find((r) => r.id === artifact.runId);
        if (run) {
          run.artifacts = run.artifacts.filter((a) => a.kind !== artifact.kind);
          run.artifacts.push(artifact);
        }
      }, true);
    await db.transaction(async (tx) => {
      await tx
        .delete(tables.artifacts)
        .where(
          and(
            eq(tables.artifacts.runId, artifact.runId),
            eq(tables.artifacts.kind, artifact.kind),
          ),
        );
      await tx
        .insert(tables.artifacts)
        .values({ ...artifact, meta: { name: artifact.name } });
    });
  },
  async artifactById(id: string): Promise<Artifact | undefined> {
    if (lite)
      return fileState((s) =>
        s.runs.flatMap((r) => r.artifacts).find((a) => a.id === id),
      );
    const [row] = await db
      .select()
      .from(tables.artifacts)
      .where(eq(tables.artifacts.id, id));
    return row
      ? {
          id: row.id,
          runId: row.runId,
          kind: row.kind,
          storageKey: row.storageKey,
          contentType: row.contentType,
          bytes: row.bytes,
          name: (row.meta as { name: string }).name,
        }
      : undefined;
  },
  async removeArtifacts(runId: string, kinds: string[]) {
    if (lite)
      return fileState((s) => {
        const run = s.runs.find((r) => r.id === runId);
        if (run)
          run.artifacts = run.artifacts.filter((a) => !kinds.includes(a.kind));
      }, true);
    for (const kind of kinds)
      await db
        .delete(tables.artifacts)
        .where(
          and(
            eq(tables.artifacts.runId, runId),
            eq(tables.artifacts.kind, kind),
          ),
        );
  },
  async share(runId: string, enabled: boolean): Promise<Share> {
    if (lite)
      return fileState((s) => {
        let share = s.shares.find((sh) => sh.runId === runId);
        if (share) share.isPublic = enabled;
        else {
          s.shares.push(
            (share = {
              id: randomUUID(),
              runId,
              slug: randomUUID().replaceAll("-", "").slice(0, 20),
              isPublic: enabled,
            }),
          );
        }
        return share;
      }, true);
    const [existing] = await db
      .select()
      .from(tables.shares)
      .where(eq(tables.shares.runId, runId));
    if (existing) {
      await db
        .update(tables.shares)
        .set({ isPublic: enabled })
        .where(eq(tables.shares.id, existing.id));
      return { ...existing, isPublic: enabled };
    }
    const value = {
      id: randomUUID(),
      runId,
      slug: randomUUID().replaceAll("-", "").slice(0, 20),
      isPublic: enabled,
    };
    await db.insert(tables.shares).values(value);
    return value;
  },
  async publicShare(slug: string): Promise<Share | undefined> {
    if (lite)
      return fileState((s) =>
        s.shares.find((sh) => sh.slug === slug && sh.isPublic),
      );
    const [row] = await db
      .select()
      .from(tables.shares)
      .where(
        and(eq(tables.shares.slug, slug), eq(tables.shares.isPublic, true)),
      );
    return row;
  },
  async shareForRun(runId: string): Promise<Share | undefined> {
    if (lite)
      return fileState((s) => s.shares.find((sh) => sh.runId === runId));
    const [row] = await db
      .select()
      .from(tables.shares)
      .where(eq(tables.shares.runId, runId));
    return row;
  },
  async usage(userId: string) {
    const month = new Date().toISOString().slice(0, 7);
    if (lite)
      return fileState(
        (s) => s.usage[`${userId}:${month}`] ?? { runs: 0, renderSeconds: 0 },
      );
    const [row] = await db
      .select()
      .from(tables.usageCounters)
      .where(
        and(
          eq(tables.usageCounters.userId, userId),
          eq(tables.usageCounters.month, month),
        ),
      );
    return row ?? { runs: 0, renderSeconds: 0 };
  },
  async reserveUsage(userId: string, seconds: number, limit = 3) {
    const month = new Date().toISOString().slice(0, 7);
    if (lite)
      return fileState((s) => {
        const key = `${userId}:${month}`;
        const counter = (s.usage[key] ??= { runs: 0, renderSeconds: 0 });
        if (counter.runs >= limit)
          throw new AppError(
            "QUOTA_EXCEEDED",
            "Monthly run limit reached.",
            429,
            "Try again next month.",
          );
        counter.runs++;
        counter.renderSeconds += seconds;
      }, true);
    const result = await db.execute(
      sql`INSERT INTO usage_counters(user_id,month,runs,render_seconds) VALUES(${userId},${month},1,${seconds}) ON CONFLICT(user_id,month) DO UPDATE SET runs=usage_counters.runs+1,render_seconds=usage_counters.render_seconds+${seconds} WHERE usage_counters.runs<${limit} RETURNING user_id`,
    );
    if (!result.rowCount)
      throw new AppError("QUOTA_EXCEEDED", "Monthly run limit reached.", 429);
  },
};
