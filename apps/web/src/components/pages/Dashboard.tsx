"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  GitBranch,
  ArrowUpRight,
  MoreHorizontal,
  Clock,
  Network,
  Film,
  ArrowRight,
} from "lucide-react";
import {
  api,
  mutation,
  errorText,
  relativeTime,
  type ProjectRow,
} from "../../lib/api";
import {
  PageHeader,
  Button,
  Badge,
  Select,
  EmptyState,
  ErrorState,
  Skeleton,
  Menu,
  Modal,
  useToast,
} from "../ui/primitives";
import { MiniDiagram } from "../diagram/MiniDiagram";
import sample from "../../../../../packages/video/src/sample.json";
import type { RenderProps } from "@reporeel/shared";
export function Dashboard() {
  const router = useRouter(),
    toast = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>(),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("updated"),
    [error, setError] = useState(""),
    [deleteTarget, setDeleteTarget] = useState<ProjectRow>(),
    [deleting, setDeleting] = useState(false);
  const load = () => {
    setError("");
    void api<ProjectRow[]>("/projects")
      .then(setProjects)
      .catch((e) => setError(errorText(e)));
  };
  useEffect(load, []);
  const visible = projects
    ?.filter((p) =>
      `${p.owner}/${p.repo}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const completed =
    projects?.filter((p) => p.latestRun?.status === "completed").length ?? 0;
  const sampleProps = sample as unknown as RenderProps;
  return (
    <>
      <PageHeader
        title="Projects"
        description="A little clarity for every codebase."
        eyebrow="YOUR WORKSPACE"
      >
        <Link href="/projects/new" className="button primary">
          <Plus size={16} />
          New project
        </Link>
      </PageHeader>
      <div className="dashboard-summary">
        <span>
          <strong>{projects?.length ?? "—"}</strong> repositories
        </span>
        <span className="summary-rule" />
        <span>
          <strong>{completed}</strong> ready to explore
        </span>
        <span className="summary-note">
          <span className="connection-indicator" />
          All insights grounded in source
        </span>
      </div>
      <div className="table-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search repositories"
            placeholder="Search repositories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <kbd>/</kbd>
        </div>
        <Select
          aria-label="Sort projects"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">Recently updated</option>
          <option value="name">Repository name</option>
        </Select>
      </div>
      {error ? (
        <ErrorState
          message={error}
          action={<Button onClick={load}>Try again</Button>}
        />
      ) : !projects ? (
        <Skeleton />
      ) : !visible?.length ? (
        <EmptyState
          title={
            search
              ? "No matching repositories"
              : "Your next codebase, made clear."
          }
          description={
            search
              ? "Try another repository name."
              : "Turn your first repository into a diagram and a walkthrough."
          }
          action={
            <Link href="/projects/new" className="button primary">
              Analyze your first repo
              <ArrowRight size={16} />
            </Link>
          }
        />
      ) : (
        <div className="project-table">
          <table>
            <thead>
              <tr>
                <th>Repository</th>
                <th>Status</th>
                <th>Last run</th>
                <th>Video length</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="repo-cell" href={`/projects/${p.id}`}>
                      <span className="repo-icon">
                        <GitBranch size={20} />
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.owner}/{p.repo}
                          {p.owner === "sample" && (
                            <span className="sample-tag">Sample</span>
                          )}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Badge status={p.latestRun?.status ?? "neutral"}>
                      {!p.latestRun ? "Not analyzed" : undefined}
                    </Badge>
                  </td>
                  <td className="quiet">
                    {p.latestRun ? relativeTime(p.latestRun.startedAt) : "—"}
                  </td>
                  <td className="quiet">
                    {p.latestRun ? (
                      <span className="inline-icon">
                        <Clock size={14} />
                        {p.latestRun.options.targetSeconds}s
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="row-actions">
                    <Link
                      href={`/projects/${p.id}`}
                      className="icon-button"
                      aria-label={`Open ${p.name}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                    <Menu
                      trigger={
                        <button
                          className="icon-button"
                          aria-label={`More actions for ${p.name}`}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      }
                      items={[
                        {
                          label: "Open workspace",
                          onSelect: () => router.push(`/projects/${p.id}`),
                        },
                        {
                          label: "Delete project",
                          danger: true,
                          onSelect: () => setDeleteTarget(p),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="getting-started">
        <div className="section-heading">
          <div>
            <h2>A good place to start</h2>
            <p>See what a repository can become.</p>
          </div>
          <span className="eyebrow">A SOURCE-GROUNDED SAMPLE</span>
        </div>
        <div className="sample-preview">
          <div className="sample-copy">
            <span className="chip lavender">
              <Network size={14} />
              Architecture, explained
            </span>
            <h3>Meet Atlas.</h3>
            <p>
              A storefront, an API, and the jobs behind an order. Explore how
              the pieces fit together.
            </p>
            <div className="sample-facts">
              <span>
                <Network size={15} />
                {sampleProps.graph?.nodes.length ?? 0} modules
              </span>
              <span>
                <Film size={15} />
                60-second walkthrough
              </span>
            </div>
            <Button onClick={() => router.push("/s/demo")}>
              Explore the sample
              <ArrowRight size={16} />
            </Button>
          </div>
          <Link
            href="/s/demo"
            className="sample-diagram"
            aria-label="Explore Atlas sample architecture"
          >
            {sampleProps.graph && <MiniDiagram graph={sampleProps.graph} />}
          </Link>
        </div>
      </section>
      <Modal
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(undefined);
        }}
        title="Delete project?"
        description={`This removes ${deleteTarget?.name ?? "the project"} and its generated artifacts.`}
      >
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setDeleteTarget(undefined)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            busy={deleting}
            onClick={() => {
              if (!deleteTarget) return;
              setDeleting(true);
              void mutation("/projects/" + deleteTarget.id, "DELETE")
                .then(() => {
                  setDeleteTarget(undefined);
                  toast("Project deleted");
                  load();
                })
                .catch((e) => toast(errorText(e)))
                .finally(() => setDeleting(false));
            }}
          >
            Delete project
          </Button>
        </div>
      </Modal>
    </>
  );
}
