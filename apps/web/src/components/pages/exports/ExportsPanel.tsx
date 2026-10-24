"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Download,
  Eye,
  ArrowUpRight,
  Braces,
  FileCode,
  Image,
  Film,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import type { Project } from "@reporeel/shared";
import {
  api,
  errorText,
  bytes,
  type RunData,
  type Download as ArtifactDownload,
} from "../../../lib/api";
import {
  Button,
  Modal,
  EmptyState,
  ErrorState,
  useToast,
  Skeleton,
} from "../../ui/primitives";
const ExcalPreview = dynamic(() => import("./ExcalPreview"), {
  ssr: false,
  loading: () => <Skeleton rows={3} />,
});
const labels: Record<string, { title: string; description: string }> = {
  excalidraw: {
    title: "Excalidraw",
    description: "An editable canvas for your next architecture discussion.",
  },
  mermaid: {
    title: "Mermaid",
    description: "A text diagram. Ready for your README or documentation.",
  },
  svg: {
    title: "SVG diagram",
    description: "A crisp, scalable vector with your project’s palette.",
  },
  png: {
    title: "PNG image",
    description: "A high-resolution image, ready to drop into a document.",
  },
  video: { title: "MP4 video", description: "H.264 · 1920 × 1080 · 30 fps" },
  poster: {
    title: "Video poster",
    description: "A still frame from your walkthrough.",
  },
  graph: {
    title: "Architecture graph",
    description: "Grounded structure with source evidence.",
  },
  storyboard: {
    title: "Storyboard",
    description: "Scenes, narration and source references.",
  },
  repo_model: {
    title: "Repository model",
    description: "Machine-readable facts from static analysis.",
  },
  captions: {
    title: "SubRip captions",
    description: "Timed captions for accessible playback.",
  },
};
export function ExportsPanel({
  run,
  project,
  onShare,
}: {
  run: RunData;
  project: Project;
  onRefresh: () => void;
  onShare: () => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<ArtifactDownload[]>(),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<ArtifactDownload>(),
    [text, setText] = useState(""),
    [json, setJson] = useState<unknown>();
  useEffect(() => {
    void api<ArtifactDownload[]>(`/runs/${run.id}/artifacts`)
      .then(setItems)
      .catch((e) => setError(errorText(e)));
  }, [run.id]);
  async function open(item: ArtifactDownload) {
    setPreview(item);
    setText("");
    setJson(undefined);
    if (
      [
        "excalidraw",
        "mermaid",
        "graph",
        "storyboard",
        "repo_model",
        "captions",
      ].includes(item.kind)
    )
      try {
        const response = await fetch(item.url);
        if (!response.ok)
          throw new Error("Preview link expired. Refresh the page.");
        const value = await response.text();
        if (item.kind === "excalidraw") setJson(JSON.parse(value) as unknown);
        else setText(value);
      } catch (e) {
        toast(errorText(e));
      }
  }
  return (
    <div className="exports-panel">
      <div className="section-heading">
        <div>
          <h2>Your architecture, wherever you need it.</h2>
          <p>Every format uses the same source, layout and colours.</p>
        </div>
        <span className="quiet">
          {items?.filter((i) => labels[i.kind]).length ?? 0} files
        </span>
      </div>
      {error ? (
        <ErrorState message={error} />
      ) : !items ? (
        <Skeleton />
      ) : !items.length ? (
        <EmptyState
          title="No exports yet"
          description="Complete an analysis to create your files."
        />
      ) : (
        <div className="export-list">
          {items
            .filter((item) => labels[item.kind])
            .map((item) => {
              const label = labels[item.kind]!;
              const Icon = ["video", "poster"].includes(item.kind)
                ? Film
                : ["svg", "png"].includes(item.kind)
                  ? Image
                  : ["graph", "storyboard", "repo_model"].includes(item.kind)
                    ? Braces
                    : FileCode;
              return (
                <div className="export-row" key={item.id}>
                  <span
                    className={`format-icon ${item.kind === "video" ? "lavender" : item.kind === "mermaid" ? "mint" : "sky"}`}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="export-name">
                    <strong>{label.title}</strong>
                    <p>{label.description}</p>
                    <small>
                      {item.name} · {bytes(item.bytes)}
                    </small>
                  </div>
                  <div className="button-row">
                    {item.kind !== "video" && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          void open(item);
                        }}
                      >
                        <Eye size={15} />
                        <span>Preview</span>
                      </Button>
                    )}
                    <a className="button secondary" href={item.url} download>
                      <Download size={15} />
                      <span>Download</span>
                    </a>
                    {item.kind === "excalidraw" && (
                      <a
                        className="icon-button"
                        href="https://excalidraw.com"
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open Excalidraw to import your downloaded file"
                      >
                        <ArrowUpRight size={17} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
      <section className="share-section">
        <div className="share-section-icon">
          <Share2 size={21} />
        </div>
        <div>
          <h2>A shared understanding.</h2>
          <p>Give someone a read-only walkthrough of {project.name}.</p>
          {project.visibility === "private" && (
            <small>
              Sharing exposes private architecture and selected code excerpts.
            </small>
          )}
        </div>
        <Button onClick={onShare}>
          <Share2 size={15} />
          Manage share link
        </Button>
      </section>
      <div className="export-footnote">
        <Check size={15} />
        Source files are never executed. Raw working files are discarded after
        processing.
      </div>
      <Modal
        open={!!preview}
        onOpenChange={(v) => {
          if (!v) setPreview(undefined);
        }}
        title={
          preview ? (labels[preview.kind]?.title ?? preview.name) : "Preview"
        }
        description={preview?.name}
      >
        {preview &&
          (["png", "svg", "poster"].includes(preview.kind) ? (
            <img
              className="export-image"
              src={preview.url}
              alt={preview.name}
            />
          ) : preview.kind === "excalidraw" ? (
            json ? (
              <ExcalPreview data={json} />
            ) : (
              <Skeleton rows={3} />
            )
          ) : (
            <pre className="export-code">{text || "Loading preview…"}</pre>
          ))}
        <div className="modal-actions">
          {text && (
            <Button
              onClick={() => {
                void navigator.clipboard
                  .writeText(text)
                  .then(() => toast("Copied to clipboard"));
              }}
            >
              <Copy size={15} />
              Copy
            </Button>
          )}
          {preview && (
            <a className="button secondary" href={preview.url} download>
              <Download size={15} />
              Download
            </a>
          )}
        </div>
      </Modal>
    </div>
  );
}
