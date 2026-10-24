"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Play,
  RefreshCw,
  Check,
  FileCode,
  Layers,
  Film,
} from "lucide-react";
import {
  wordCount,
  type RenderProps,
  type Scene,
  type Storyboard,
} from "@reporeel/shared";
import { mutation, errorText } from "../../lib/api";
import {
  Button,
  Field,
  Select,
  IconButton,
  useToast,
  ErrorState,
} from "../ui/primitives";
export function SceneEditor({
  renderProps,
  runId,
  onSaved,
  onRender,
  onPreview,
}: {
  renderProps: RenderProps;
  runId: string;
  onSaved: () => void;
  onRender: () => void;
  onPreview: (id: string) => void;
}) {
  const toast = useToast(),
    [board, setBoard] = useState<Storyboard>(renderProps.storyboard),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [drag, setDrag] = useState<number>();
  useEffect(() => setBoard(renderProps.storyboard), [renderProps.storyboard]);
  const scene = board.scenes[selected]!,
    dirty = JSON.stringify(board) !== JSON.stringify(renderProps.storyboard);
  const words = board.scenes.reduce((n, s) => n + wordCount(s.narration), 0),
    budget = board.targetSeconds * 2.5;
  function update(patch: Partial<Scene>) {
    setBoard((b) => ({
      ...b,
      scenes: b.scenes.map((s, i) =>
        i === selected ? ({ ...s, ...patch } as Scene) : s,
      ),
    }));
  }
  function reorder(from: number, to: number) {
    if (to < 0 || to >= board.scenes.length) return;
    setBoard((b) => {
      const scenes = [...b.scenes],
        item = scenes.splice(from, 1)[0]!;
      scenes.splice(to, 0, item);
      return { ...b, scenes };
    });
    setSelected(to);
  }
  async function save(render = false) {
    setBusy(true);
    setError("");
    try {
      await mutation(`/runs/${runId}/storyboard`, "PATCH", board);
      toast("Storyboard saved");
      onSaved();
      if (render) onRender();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="storyboard-workspace">
      <aside className="scene-list">
        <div className="scene-list-header">
          <span className="eyebrow">THE WALKTHROUGH</span>
          <span>{board.scenes.length} scenes</span>
        </div>
        {board.scenes.map((s, i) => (
          <div
            key={s.id}
            className={`scene-list-item ${selected === i ? "selected" : ""}`}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== undefined) reorder(drag, i);
              setDrag(undefined);
            }}
          >
            <GripVertical size={14} className="grip" />
            <button onClick={() => setSelected(i)}>
              <span className="scene-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{s.onScreenTitle ?? s.type}</strong>
                <small>
                  {s.type} · ~
                  {Math.round(
                    (renderProps.timings.find((t) => t.sceneId === s.id)
                      ?.durationFrames ?? 90) / 30,
                  )}{" "}
                  sec
                </small>
              </div>
              <span className="scene-dot" />
            </button>
          </div>
        ))}
        <div className="scene-list-footer">
          <Layers size={15} />
          Drag to reorder. Select to refine.
        </div>
      </aside>
      <div className="scene-edit-panel">
        <div className="scene-editor-heading">
          <div>
            <span className="eyebrow">
              SCENE {String(selected + 1).padStart(2, "0")} /{" "}
              {scene.type.toUpperCase()}
            </span>
            <h2>Make the story yours.</h2>
          </div>
          <div className="button-row">
            <IconButton
              label="Move scene up"
              disabled={selected === 0}
              onClick={() => reorder(selected, selected - 1)}
            >
              <ArrowUp size={16} />
            </IconButton>
            <IconButton
              label="Move scene down"
              disabled={selected === board.scenes.length - 1}
              onClick={() => reorder(selected, selected + 1)}
            >
              <ArrowDown size={16} />
            </IconButton>
          </div>
        </div>
        <Field label="On-screen title">
          <input
            maxLength={60}
            value={scene.onScreenTitle ?? ""}
            onChange={(e) => update({ onScreenTitle: e.target.value })}
          />
        </Field>
        <Field
          label="Narration"
          helper="Clear, speakable sentences work best. Captions follow this text."
        >
          <textarea
            className="narration-input"
            maxLength={420}
            value={scene.narration}
            onChange={(e) => update({ narration: e.target.value })}
          />
        </Field>
        <div
          className={`word-budget ${words > budget * 1.15 ? "over" : words > budget ? "near" : ""}`}
        >
          <span>{wordCount(scene.narration)} words in this scene</span>
          <span>
            {words} / {budget} total words
          </span>
        </div>
        {scene.type === "zoom" && (
          <Field label="Focus module">
            <Select
              value={scene.focusNodeIds[0]}
              onChange={(e) =>
                update({ focusNodeIds: [e.target.value], callouts: [] })
              }
            >
              {renderProps.graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {scene.type === "flow" && (
          <Field label="Architecture flow">
            <Select
              value={scene.flowId}
              onChange={(e) => update({ flowId: e.target.value })}
            >
              {renderProps.graph.flows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {scene.type === "code" && (
          <div className="code-scene-source">
            <FileCode size={17} />
            <div>
              <strong>{scene.path}</strong>
              <small>
                Verified source · lines {scene.startLine}–{scene.endLine}
              </small>
            </div>
          </div>
        )}
        {scene.type === "title" && (
          <Field label="Subtitle">
            <input
              maxLength={120}
              value={scene.subtitle}
              onChange={(e) => update({ subtitle: e.target.value })}
            />
          </Field>
        )}
        <div className="scene-editor-actions">
          <Button
            onClick={() => {
              setBusy(true);
              void mutation<Scene>(
                `/runs/${runId}/scenes/${scene.id}/regenerate`,
                "POST",
              )
                .then((s) => {
                  setBoard((b) => ({
                    ...b,
                    scenes: b.scenes.map((x, i) => (i === selected ? s : x)),
                  }));
                  toast("Scene regenerated from source");
                })
                .catch((e) => setError(errorText(e)))
                .finally(() => setBusy(false));
            }}
            busy={busy}
          >
            <RefreshCw size={15} />
            Regenerate this scene
          </Button>
          <Button
            variant="ghost"
            onClick={() => onPreview(scene.id)}
            disabled={dirty}
          >
            <Play size={15} />
            Preview scene
          </Button>
        </div>
        {error && <ErrorState message={error} />}
        <div className="editor-note">
          <Check size={16} />
          <p>
            File paths, statistics and dependencies come from the source
            analysis. You control how the story is told.
          </p>
        </div>
        {dirty && (
          <div className="save-bar">
            <span>Unsaved changes</span>
            <div>
              <Button
                variant="ghost"
                onClick={() => setBoard(renderProps.storyboard)}
              >
                Discard
              </Button>
              <Button
                onClick={() => {
                  void save();
                }}
                busy={busy}
              >
                Save
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  void save(true);
                }}
                busy={busy}
                disabled={words > budget * 1.15}
              >
                <Film size={15} />
                Save & re-render
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
