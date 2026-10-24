"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Film,
  Share2,
  Download,
  ChevronDown,
  GitCommitHorizontal,
  ArrowUpRight,
  Network,
  Play,
  Check,
  Copy,
} from "lucide-react";
import { uniqueTechnologies, type Project, type RenderProps, type LaidOutGraph } from "@reporeel/shared";
import {
  api,
  mutation,
  errorText,
  type RunData,
  type Download as ArtifactDownload,
} from "../../lib/api";
import {
  PageHeader,
  Badge,
  Button,
  Menu,
  Modal,
  Skeleton,
  EmptyState,
  ErrorState,
  Chip,
  useToast,
} from "../ui/primitives";
import { FlowCanvas } from "../diagram/FlowCanvas";
import { MiniDiagram } from "../diagram/MiniDiagram";
import { PlayerPanel } from "../video/PlayerPanel";
import { SceneEditor } from "../storyboard/SceneEditor";
import { ExportsPanel } from "./exports/ExportsPanel";
export function Workspace({
  projectId,
  tab,
}: {
  projectId: string;
  tab: string;
}) {
  const router = useRouter(),
    toast = useToast();
  const [project, setProject] = useState<Project>(),
    [run, setRun] = useState<RunData>(),
    [error, setError] = useState(""),
    [sharing, setSharing] = useState(false),
    [consent, setConsent] = useState(false),
    [shareBusy, setShareBusy] = useState(false),
    [renderBusy, setRenderBusy] = useState(false);
  const load = () => {
    setError("");
    void api<Project & { runs: RunData[] }>(`/projects/${projectId}`)
      .then(async (p) => {
        setProject(p);
        if (p.runs[0]) {
          const r = await api<RunData>("/runs/" + p.runs[0].id);
          setRun(r);
          if (["queued", "running"].includes(r.status))
            router.replace(`/projects/${projectId}/runs/${r.id}`);
        }
      })
      .catch((e) => setError(errorText(e)));
  };
  useEffect(load, [projectId]);
  async function render() {
    if (!run) return;
    setRenderBusy(true);
    try {
      await mutation(`/runs/${run.id}/render`, "POST");
      router.push(`/projects/${projectId}/runs/${run.id}`);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setRenderBusy(false);
    }
  }
  const shareUrl = run?.share?.isPublic
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/s/${run.share.slug}`
    : undefined;
  async function createShare() {
    if (!run) return;
    setShareBusy(true);
    try {
      const shared = await mutation<{ slug: string; isPublic: boolean }>(
        `/runs/${run.id}/share`,
        "POST",
        { privateConsent: consent },
      );
      setRun({ ...run, share: shared });
      toast("Public share link created");
    } catch (e) {
      toast(errorText(e));
    } finally {
      setShareBusy(false);
    }
  }
  async function quickDownload(kind: string) {
    if (!run) return;
    try {
      const all = await api<ArtifactDownload[]>(`/runs/${run.id}/artifacts`);
      const a = all.find((a) => a.kind === kind);
      if (a) window.location.assign(a.url);
      else toast("This artifact is not ready yet.");
    } catch (e) {
      toast(errorText(e));
    }
  }
  function updated(graph: LaidOutGraph, style?: RenderProps["style"]) {
    setRun((r) =>
      r?.renderProps
        ? {
            ...r,
            storyboardDirty: true,
            renderProps: {
              ...r.renderProps,
              graph,
              ...(style ? { style } : {}),
            },
          }
        : r,
    );
  }
  if (error)
    return (
      <ErrorState
        message={error}
        action={<Button onClick={load}>Try again</Button>}
      />
    );
  if (!project) return <Skeleton rows={6} />;
  return (
    <>
      <PageHeader
        title={project.name}
        description={
          <span className="workspace-caption">
            {project.owner}/{project.repo}
            <span>·</span>
            <GitCommitHorizontal size={14} />
            {run?.commitSha.slice(0, 7) || "No analysis yet"}
            {run && <Badge status={run.status} />}
          </span>
        }
      >
        <Button
          variant="primary"
          onClick={() => {
            void render();
          }}
          busy={renderBusy}
          disabled={!run?.renderProps}
        >
          <Film size={16} />
          {run?.storyboardDirty ? "Re-render video" : "Render video"}
        </Button>
        <Button onClick={() => setSharing(true)} disabled={!run?.renderProps}>
          <Share2 size={15} />
          Share
        </Button>
        <Menu
          trigger={
            <button className="button secondary" disabled={!run}>
              <Download size={15} />
              <span className="export-label">Export</span>
              <ChevronDown size={14} />
            </button>
          }
          items={["Excalidraw", "Mermaid", "SVG", "PNG", "MP4", "JSON"].map(
            (name, i) => ({
              label: name,
              onSelect: () => {
                void quickDownload(
                  ["excalidraw", "mermaid", "svg", "png", "video", "graph"][i]!,
                );
              },
            }),
          )}
        />
      </PageHeader>
      <nav className="workspace-tabs" aria-label="Project workspace">
        {["Overview", "Diagram", "Storyboard", "Video", "Exports"].map(
          (name) => (
            <Link
              key={name}
              href={`/projects/${projectId}${name === "Overview" ? "" : "/" + name.toLowerCase()}`}
              className={tab === name.toLowerCase() ? "active" : ""}
              aria-current={tab === name.toLowerCase() ? "page" : undefined}
            >
              {name}
              {name === "Storyboard" && run?.storyboardDirty && (
                <span className="dirty-dot" />
              )}
            </Link>
          ),
        )}
      </nav>
      {!run ? (
        <EmptyState
          title="Ready when you are"
          description="Start an analysis to discover this repository’s architecture."
          action={
            <Link className="button primary" href="/projects/new">
              Configure analysis
            </Link>
          }
        />
      ) : run.renderProps ? (
        <>
          {tab === "overview" ? (
            <Overview props={run.renderProps} projectId={projectId} />
          ) : tab === "diagram" ? (
            <FlowCanvas
              renderProps={run.renderProps}
              runId={run.id}
              onUpdated={updated}
            />
          ) : tab === "storyboard" ? (
            <SceneEditor
              renderProps={run.renderProps}
              runId={run.id}
              onSaved={load}
              onRender={() => {
                void render();
              }}
              onPreview={(id) =>
                router.push(`/projects/${projectId}/video?scene=${id}`)
              }
            />
          ) : tab === "video" ? (
            <PlayerPanel
              renderProps={run.renderProps}
              runId={run.id}
              shareUrl={shareUrl}
            />
          ) : tab === "exports" ? (
            <ExportsPanel
              run={run}
              project={project}
              onRefresh={load}
              onShare={() => setSharing(true)}
            />
          ) : (
            <ErrorState message="This workspace tab does not exist." />
          )}
        </>
      ) : (
        <ErrorState
          message={run.error?.message ?? "The analysis is not ready yet."}
          hint={run.error?.hint}
          action={
            <Link
              href={`/projects/${projectId}/runs/${run.id}`}
              className="button primary"
            >
              View pipeline & retry
            </Link>
          }
        />
      )}
      <Modal
        open={sharing}
        onOpenChange={setSharing}
        title="A little clarity, shared."
        description="Anyone with the link can view the video, diagram, file paths and any code excerpts in the walkthrough."
      >
        {project.visibility === "private" && (
          <label className="check-row private-notice">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I understand this publicly exposes details of a private repository.
          </label>
        )}
        {shareUrl ? (
          <>
            <label className="label" htmlFor="share-url">
              Public link
            </label>
            <div className="copy-field">
              <input id="share-url" value={shareUrl} readOnly />
              <Button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(shareUrl)
                    .then(() => toast("Link copied"));
                }}
              >
                <Copy size={15} />
                Copy
              </Button>
            </div>
            <div className="modal-actions">
              <Button
                variant="danger"
                onClick={() => {
                  void mutation(`/runs/${run!.id}/share`, "DELETE")
                    .then(() => {
                      setSharing(false);
                      load();
                      toast("Public link revoked");
                    })
                    .catch((e) => toast(errorText(e)));
                }}
              >
                Revoke link
              </Button>
              <a
                className="button secondary"
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open share
                <ArrowUpRight size={15} />
              </a>
            </div>
          </>
        ) : (
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setSharing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                void createShare();
              }}
              busy={shareBusy}
              disabled={project.visibility === "private" && !consent}
            >
              Create public link
              <Share2 size={15} />
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
function Overview({
  props,
  projectId,
}: {
  props: RenderProps;
  projectId: string;
}) {
  const { repo, graph } = props;
  const technologies = uniqueTechnologies(repo.tech);
  return (
    <div className="overview">
      <div className="stat-row">
        {[
          [repo.stats.analyzedFileCount.toLocaleString(), "Analyzed files"],
          [repo.stats.totalLoc.toLocaleString(), "Analyzed lines"],
          [repo.stats.languages.length, "Languages"],
          [graph.nodes.length, "Architecture modules"],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="overview-description">
        <section>
          <span className="eyebrow">THE BIG PICTURE</span>
          <h2>What this project is.</h2>
          <p className="body-large">{graph.tagline}</p>
          <p className="quiet">
            {repo.readmeExcerpt
              .replace(/^#+\s*/gm, "")
              .split("\n")
              .filter(Boolean)
              .slice(1, 3)
              .join(" ")
              .slice(0, 400) ||
              "Explore the modules below to follow how this repository is organized."}
          </p>
          <div className="verified-label">
            <Check size={14} />
            Grounded in {repo.stats.analyzedFileCount} source files
          </div>
        </section>
        <section>
          <span className="eyebrow">BUILT WITH</span>
          <h2>A familiar set of building blocks.</h2>
          <div className="tech-groups">
            {[...new Set(technologies.map((t) => t.category))]
              .slice(0, 6)
              .map((category) => (
                <div key={category}>
                  <span>{category}</span>
                  <div className="chips">
                    {technologies
                      .filter((t) => t.category === category)
                      .map((t) => (
                        <Chip
                          key={t.name}
                          tone={
                            category === "api"
                              ? "mint"
                              : category === "database"
                                ? "butter"
                                : category === "queue"
                                  ? "lavender"
                                  : category === "test"
                                    ? "lilac"
                                    : "sky"
                          }
                        >
                          {t.label}
                        </Chip>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
      <div className="overview-previews">
        <section>
          <div className="section-heading">
            <h2>
              <Network size={18} />
              The architecture
            </h2>
            <Link href={`/projects/${projectId}/diagram`}>
              Explore diagram
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            className="diagram-thumbnail"
            href={`/projects/${projectId}/diagram`}
          >
            <MiniDiagram graph={graph} />
            <span className="preview-overlay">
              Explore the connections
              <ArrowUpRight size={15} />
            </span>
          </Link>
        </section>
        <section>
          <div className="section-heading">
            <h2>
              <Play size={18} />
              The walkthrough
            </h2>
            <Link href={`/projects/${projectId}/video`}>
              Watch video
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <PlayerPanel renderProps={props} compact />
        </section>
      </div>
      {repo.warnings.length > 0 && (
        <details className="analysis-notes">
          <summary>Analysis notes ({repo.warnings.length})</summary>
          {repo.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      )}
      <div className="evidence-footer">
        <GitCommitHorizontal size={15} />
        <span>
          Analyzed snapshot {repo.meta.commitSha.slice(0, 7)} ·{" "}
          {new Date(repo.meta.analyzedAt).toLocaleDateString("en", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span>No repository code was executed.</span>
      </div>
    </div>
  );
}
