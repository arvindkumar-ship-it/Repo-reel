"use client";
import { useEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Play, Download, Copy, Film, CheckCircle2 } from "lucide-react";
import { Explainer } from "@reporeel/video";
import { sceneStarts, totalFrames, type RenderProps } from "@reporeel/shared";
import {
  api,
  errorText,
  bytes,
  type Download as ArtifactDownload,
} from "../../lib/api";
import { Button, Chip, useToast } from "../ui/primitives";
export function PlayerPanel({
  renderProps,
  runId,
  compact = false,
  shareUrl,
  videoUrl,
}: {
  renderProps: RenderProps;
  runId?: string;
  compact?: boolean;
  shareUrl?: string;
  videoUrl?: string;
}) {
  const ref = useRef<PlayerRef>(null),
    toast = useToast();
  const [artifacts, setArtifacts] = useState<ArtifactDownload[]>([]),
    [chapter, setChapter] = useState(0);
  const starts = sceneStarts(renderProps);
  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    const changed = ({ detail }: { detail: { frame: number } }) => {
      const next = starts.reduce(
        (index, start, i) => (detail.frame >= start ? i : index),
        0,
      );
      setChapter(Math.max(0, next));
    };
    player.addEventListener("frameupdate", changed);
    return () => player.removeEventListener("frameupdate", changed);
  }, [renderProps]);
  useEffect(() => {
    if (runId)
      void api<ArtifactDownload[]>(`/runs/${runId}/artifacts`)
        .then(setArtifacts)
        .catch(() => {});
    const scene = new URLSearchParams(window.location.search).get("scene"),
      index = renderProps.storyboard.scenes.findIndex((s) => s.id === scene);
    if (index >= 0) {
      ref.current?.seekTo(starts[index] ?? 0);
      setChapter(index);
    }
  }, [runId, renderProps]);
  const video =
    artifacts.find((a) => a.kind === "video") ??
    (videoUrl ? { url: videoUrl, bytes: 0 } : undefined);
  return (
    <div className={compact ? "video-panel compact-player" : "video-panel"}>
      <div className="player-and-chapters">
        <div className="player-column">
          <div className="remotion-player">
            <Player
              ref={ref}
              component={Explainer}
              inputProps={renderProps}
              durationInFrames={totalFrames(renderProps)}
              compositionWidth={1920}
              compositionHeight={1080}
              fps={30}
              initialFrame={compact ? (starts[1] ?? 0) + 30 : 30}
              controls
              clickToPlay
              showVolumeControls={renderProps.timings.some((t) => !!t.audioUrl)}
              style={{ width: "100%", aspectRatio: "16/9" }}
              errorFallback={({ error }) => (
                <div className="player-error">
                  Preview unavailable: {error.message}
                </div>
              )}
            />
          </div>
          {!compact && (
            <div className="video-meta">
              <span>
                <Film size={15} />
                1080p · {Math.round(totalFrames(renderProps) / 30)} sec · 30 fps
                {video?.bytes ? " · " + bytes(video.bytes) : ""}
              </span>
              <Chip tone={video ? "mint" : "cream"}>
                {video ? "Render ready" : "Live preview"}
              </Chip>
            </div>
          )}
        </div>
        {!compact && (
          <aside className="chapters">
            <div className="eyebrow">IN THIS WALKTHROUGH</div>
            <h2>The story, chapter by chapter.</h2>
            {renderProps.storyboard.scenes.map((scene, i) => (
              <button
                key={scene.id}
                className={chapter === i ? "active" : ""}
                onClick={() => {
                  ref.current?.seekTo(starts[i] ?? 0);
                  ref.current?.play();
                  setChapter(i);
                }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{scene.onScreenTitle ?? scene.type}</strong>
                  <small>
                    {Math.floor((starts[i] ?? 0) / 1800)}:
                    {String(Math.floor((starts[i] ?? 0) / 30) % 60).padStart(
                      2,
                      "0",
                    )}{" "}
                    · {scene.type}
                  </small>
                </div>
                <Play size={13} />
              </button>
            ))}
          </aside>
        )}
      </div>
      {!compact && (
        <div className="video-downloads">
          <div className="video-status">
            <CheckCircle2 size={18} />
            <span>
              {video
                ? "Your video is ready to share."
                : "Instant preview. Render to download an MP4."}
            </span>
          </div>
          <div className="button-row">
            {video && (
              <a className="button primary" href={video.url} download>
                <Download size={16} />
                Download MP4
              </a>
            )}
            {shareUrl && (
              <Button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(shareUrl)
                    .then(() => toast("Share link copied"))
                    .catch((e) => toast(errorText(e)));
                }}
              >
                <Copy size={15} />
                Copy share link
              </Button>
            )}
            {artifacts.find((a) => a.kind === "poster") && (
              <a
                className="button ghost"
                href={artifacts.find((a) => a.kind === "poster")!.url}
                download
              >
                Download poster
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
