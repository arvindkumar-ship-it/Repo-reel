"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  GitCommitHorizontal,
  LoaderCircle,
  ChevronDown,
  X,
} from "lucide-react";
import { STAGES, type Stage, type Project } from "@reporeel/shared";
import { api, mutation, errorText, type RunData } from "../../lib/api";
import {
  PageHeader,
  Progress,
  Button,
  ErrorState,
  Modal,
  useToast,
} from "../ui/primitives";
const names: Record<Stage, string> = {
  ingest: "Fetch repository",
  analyze: "Read the source",
  infer: "Connect the architecture",
  layout: "Arrange the diagram",
  export: "Prepare your exports",
  storyboard: "Write the walkthrough",
  narrate: "Time the narration",
  render: "Bring it to life",
};
export function RunProgress({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const router = useRouter(),
    toast = useToast();
  const [run, setRun] = useState<RunData>(),
    [project, setProject] = useState<Project>(),
    [error, setError] = useState(""),
    [details, setDetails] = useState(false),
    [cancel, setCancel] = useState(false),
    [busy, setBusy] = useState(false);
  const [watchVersion, setWatchVersion] = useState(0);
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void api<RunData>("/runs/" + runId + "/status")
        .then((data) => {
          if (mounted) {
            setRun(data);
            if (data.status === "completed") {
              toast("Your walkthrough is ready");
              router.replace("/projects/" + projectId);
            }
          }
        })
        .catch((e) => {
          if (mounted) setError(errorText(e));
        });
    };
    refresh();
    void api<Project>("/projects/" + projectId)
      .then(setProject)
      .catch(() => {});
    const source = new EventSource("/api/v1/runs/" + runId + "/events");
    let connected = false,
      terminal = false;
    source.onopen = () => {
      connected = true;
    };
    source.addEventListener("progress", (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as RunData["events"][number];
      if (mounted)
        setRun((r) =>
          r && !r.events.some((e) => e.id === event.id)
            ? { ...r, events: [...r.events, event] }
            : r,
        );
    });
    source.addEventListener("status", (message: MessageEvent<string>) => {
      const status = JSON.parse(message.data) as Pick<
        RunData,
        "status" | "stage" | "progress" | "error"
      >;
      if (!mounted) return;
      setRun((r) => (r ? { ...r, ...status } : r));
      terminal = ["completed", "failed", "cancelled"].includes(status.status);
      if (status.status === "completed") {
        toast("Your walkthrough is ready");
        router.replace("/projects/" + projectId);
      }
      if (terminal) source.close();
    });
    source.onerror = () => {
      connected = false;
      source.close();
    };
    const poll = setInterval(() => {
      if (!connected && !terminal) refresh();
    }, 3000);
    return () => {
      mounted = false;
      source.close();
      clearInterval(poll);
    };
  }, [runId, projectId, router, toast, watchVersion]);
  async function retry() {
    setBusy(true);
    try {
      await mutation(`/runs/${runId}/retry`, "POST", {
        fromStage: run?.stage ?? "ingest",
      });
      setError("");
      setRun((r) => (r ? { ...r, status: "queued", error: undefined } : r));
      setWatchVersion((v) => v + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="run-page">
      <div className="run-eyebrow">
        <span className="connection-indicator" />
        FROM SOURCE TO STORY
      </div>
      <PageHeader
        title={`Understanding ${project?.name ?? "your repository"}`}
        description="Each step gets you closer to the big picture."
      />
      {run?.commitSha && (
        <div className="commit-chip">
          <GitCommitHorizontal size={14} />
          {run.commitSha.slice(0, 7)}
        </div>
      )}
      <div className="run-progress-label">
        <strong>{Math.round(run?.progress ?? 0)}% complete</strong>
        <span>
          {run?.status === "failed"
            ? "Needs attention"
            : run?.status === "cancelled"
              ? "Cancelled"
              : run?.stage === "render"
                ? "Rendering your video"
                : "Reading, connecting, explaining"}
        </span>
      </div>
      <Progress value={run?.progress ?? 0} />
      <ol className="pipeline-stepper" aria-live="polite">
        {STAGES.map((stage, i) => {
          const current = run ? STAGES.indexOf(run.stage) : 0,
            done = i < current || run?.status === "completed",
            active = i === current;
          const event = run?.events.filter((e) => e.stage === stage).at(-1);
          const first = run?.events.find((e) => e.stage === stage);
          const duration =
            event && first
              ? Math.round(
                  (new Date(event.ts).getTime() -
                    new Date(first.ts).getTime()) /
                    1000,
                )
              : 0;
          return (
            <li key={stage} className={done ? "done" : active ? "current" : ""}>
              <span className="step-indicator">
                {done ? (
                  <Check size={16} />
                ) : active && run?.status === "running" ? (
                  <LoaderCircle size={17} className="spinner" />
                ) : run?.status === "failed" && active ? (
                  <X size={16} />
                ) : (
                  <span>{String(i + 1).padStart(2, "0")}</span>
                )}
              </span>
              <div>
                <strong>{names[stage]}</strong>
                <p>
                  {event?.message ??
                    (active ? "Waiting to start" : "Coming up next")}
                </p>
              </div>
              {done && <small>{duration}s</small>}
            </li>
          );
        })}
      </ol>
      {(error || run?.error) && (
        <ErrorState
          message={error || run?.error?.message || ""}
          hint={run?.error?.hint}
          action={
            <Button
              variant="primary"
              onClick={() => {
                void retry();
              }}
              busy={busy}
            >
              Retry from {run?.stage ?? "ingest"}
            </Button>
          }
        />
      )}
      <button className="details-toggle" onClick={() => setDetails(!details)}>
        Pipeline details
        <ChevronDown size={16} />
      </button>
      {details && (
        <div className="pipeline-log">
          {run?.events.map((e) => (
            <div key={e.id}>
              <time>{new Date(e.ts).toLocaleTimeString()}</time>
              <span>{e.stage}</span>
              {e.message}
            </div>
          ))}
        </div>
      )}
      <div className="run-footer">
        <span>Your source is read as data. No scripts or hooks are run.</span>
        {run && ["running", "queued"].includes(run.status) && (
          <Button variant="ghost" onClick={() => setCancel(true)}>
            Cancel run
          </Button>
        )}
      </div>
      <Modal
        open={cancel}
        onOpenChange={setCancel}
        title="Cancel this run?"
        description="Completed diagram and analysis artifacts will be kept."
      >
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setCancel(false)}>
            Keep going
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              void mutation(`/runs/${runId}/cancel`, "POST")
                .then(() => {
                  setCancel(false);
                  toast("Run cancelled");
                })
                .catch((e) => toast(errorText(e)));
            }}
          >
            Cancel run
          </Button>
        </div>
      </Modal>
    </div>
  );
}
