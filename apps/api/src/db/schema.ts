import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  real,
  bigserial,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const users = pgTable("users", {
  id: uuid().primaryKey(),
  githubId: text("github_id").unique(),
  email: text(),
  name: text().notNull(),
  avatarUrl: text("avatar_url"),
  plan: text().default("free").notNull(),
  createdAt: created(),
});
export const githubTokens = pgTable("github_tokens", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenEnc: text("token_enc").notNull(),
  scopes: text().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const projects = pgTable("projects", {
  id: uuid().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text().notNull(),
  owner: text().notNull(),
  repo: text().notNull(),
  repoUrl: text("repo_url").notNull(),
  visibility: text().notNull(),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const runs = pgTable("runs", {
  id: uuid().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  commitSha: text("commit_sha").default("").notNull(),
  status: text().notNull(),
  stage: text().notNull(),
  progress: real().default(0).notNull(),
  options: jsonb().notNull(),
  usage: jsonb().notNull(),
  error: jsonb(),
  storyboardDirty: boolean("storyboard_dirty").default(false),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
export const runEvents = pgTable("run_events", {
  id: bigserial({ mode: "number" }).primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  stage: text().notNull(),
  level: text().notNull(),
  message: text().notNull(),
  progress: real().notNull(),
  ts: timestamp({ withTimezone: true }).defaultNow().notNull(),
});
export const artifacts = pgTable("artifacts", {
  id: uuid().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  kind: text().notNull(),
  storageKey: text("storage_key").notNull(),
  contentType: text("content_type").notNull(),
  bytes: bigint({ mode: "number" }).notNull(),
  meta: jsonb().notNull(),
  createdAt: created(),
});
export const shares = pgTable("shares", {
  id: uuid().primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  slug: text().unique().notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  createdAt: created(),
});
export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    month: text().notNull(),
    runs: integer().default(0).notNull(),
    renderSeconds: integer("render_seconds").default(0).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })],
);
