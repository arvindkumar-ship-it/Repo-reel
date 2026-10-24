"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  MarkerType,
  useReactFlow,
  type Node,
  type NodeProps,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import {
  Search,
  Play,
  Pause,
  X,
  FileCode,
  ArrowUpRight,
  Network,
  SlidersHorizontal,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  colorFor,
  graphAtLevel,
  type LaidOutGraph,
  type RenderProps,
} from "@reporeel/shared";
import {
  Button,
  IconButton,
  Segmented,
  Select,
  Chip,
  useToast,
} from "../ui/primitives";
import { mutation, errorText } from "../../lib/api";
type Data = {
  node: LaidOutGraph["nodes"][number];
  dimmed: boolean;
  style: "clean" | "sketch";
  active: boolean;
};
type CanvasNode = Node<Data, "kind">;
type CanvasEdge = Edge<{
  points: { x: number; y: number }[];
  labelPos: { x: number; y: number };
}>;
function KindNode({ data, selected }: NodeProps<CanvasNode>) {
  const c = colorFor(data.node.kind);
  return (
    <div
      className={`kind-node ${selected || data.active ? "selected" : ""} ${data.style === "sketch" ? "sketch-node" : ""}`}
      style={{
        background: c.fill,
        borderColor: c.stroke,
        opacity: data.dimmed ? 0.3 : 1,
        width: data.node.width,
        height: data.node.height,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <span className="kind-node-title">
        <Network size={15} style={{ color: c.ink }} />
        {data.node.label}
      </span>
      <span style={{ color: c.ink }}>{data.node.kind}</span>
      {data.node.tech.length > 0 && (
        <small>{data.node.tech.join(" · ").slice(0, 32)}</small>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function RoutedEdge({
  id,
  data,
  markerEnd,
  style,
  label,
}: EdgeProps<CanvasEdge>) {
  const path =
    data?.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") ?? "";
  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={data?.labelPos.x}
      labelY={data?.labelPos.y}
      labelStyle={{ fill: "#6B6B76", fontSize: 11 }}
      labelBgStyle={{ fill: "#FBFAF7" }}
    />
  );
}
const nodeTypes = { kind: KindNode },
  edgeTypes = { routed: RoutedEdge };
export function FlowCanvas(props: {
  renderProps: RenderProps;
  runId?: string;
  onUpdated?: (graph: LaidOutGraph, style?: RenderProps["style"]) => void;
  readOnly?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
function Canvas({
  renderProps,
  runId,
  onUpdated,
  readOnly = false,
}: {
  renderProps: RenderProps;
  runId?: string;
  onUpdated?: (graph: LaidOutGraph, style?: RenderProps["style"]) => void;
  readOnly?: boolean;
}) {
  const graph = renderProps.graph,
    toast = useToast(),
    rf = useReactFlow();
  const [selected, setSelected] = useState<string>(),
    [search, setSearch] = useState(""),
    [level, setLevel] = useState(1),
    [kind, setKind] = useState("all"),
    [style, setStyle] = useState(renderProps.style),
    [flowId, setFlowId] = useState(graph.flows[0]?.id ?? ""),
    [playing, setPlaying] = useState(false),
    [step, setStep] = useState(0),
    [editing, setEditing] = useState(false),
    [label, setLabel] = useState(""),
    [summary, setSummary] = useState(""),
    [saving, setSaving] = useState(false),
    [filters, setFilters] = useState(false);
  const [draftPositions, setDraftPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const input = useRef<HTMLInputElement>(null);
  const current = graph.nodes.find((n) => n.id === selected),
    flow = graph.flows.find((f) => f.id === flowId),
    active = playing ? flow?.steps[step]?.nodeId : undefined;
  useEffect(() => {
    if (!playing || !flow) return;
    const timer = setInterval(
      () => setStep((s) => (s + 1) % flow.steps.length),
      1600,
    );
    return () => clearInterval(timer);
  }, [playing, flow]);
  useEffect(() => {
    setLabel(current?.label ?? "");
    setSummary(current?.summary ?? "");
  }, [current]);
  const displayed = graphAtLevel(graph, level as 0 | 1 | 2);
  const visible = displayed.nodes;
  const nodes: CanvasNode[] = visible.map((n) => ({
    id: n.id,
    type: "kind",
    position: draftPositions[n.id] ?? { x: n.x, y: n.y },
    data: {
      node: n,
      dimmed:
        (!!search && !n.label.toLowerCase().includes(search.toLowerCase())) ||
        (kind !== "all" && n.kind !== kind),
      style,
      active: n.id === active,
    },
    selected: n.id === selected,
    width: n.width,
    height: n.height,
    ariaLabel: `${n.label}, ${n.kind}, ${graph.edges.filter((e) => e.from === n.id || e.to === n.id).length} connections`,
    ariaRole: "button",
    focusable: true,
  }));
  const edges: CanvasEdge[] = displayed.edges.map((e) => ({
    id: e.id,
    type: editing ? "smoothstep" : "routed",
    source: e.from,
    target: e.to,
    label: e.label,
    data: { points: e.points, labelPos: e.labelPos },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#B2ACA0" },
    style: {
      stroke:
        active && (e.from === active || e.to === active)
          ? "#F6B183"
          : "#B2ACA0",
      strokeWidth: active && (e.from === active || e.to === active) ? 2.5 : 1.5,
    },
    labelStyle: { fill: "#6B6B76", fontSize: 11 },
    labelBgStyle: { fill: "#FBFAF7" },
  }));
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if (e.key === "Enter" || e.key === " ") {
        const node = (e.target as HTMLElement).closest<HTMLElement>(
          ".react-flow__node",
        );
        const id = node?.dataset.id;
        if (id && graph.nodes.some((n) => n.id === id)) {
          e.preventDefault();
          setSelected(id);
        }
      }
      if (e.key === "/") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") setSelected(undefined);
      if (e.key.toLowerCase() === "f") void rf.fitView({ padding: 0.2 });
      if (e.key === "+") void rf.zoomIn();
      if (e.key === "-") void rf.zoomOut();
      if (["ArrowRight", "ArrowLeft"].includes(e.key) && selected) {
        const edge = graph.edges.find((x) =>
          e.key === "ArrowRight" ? x.from === selected : x.to === selected,
        );
        if (edge) setSelected(e.key === "ArrowRight" ? edge.to : edge.from);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [rf, selected, graph]);
  const focusSearch = useCallback(
    (value: string) => {
      setSearch(value);
      const node = graph.nodes.find(
        (n) => value && n.label.toLowerCase().includes(value.toLowerCase()),
      );
      if (node) setLevel(2);
      if (node)
        void rf.setCenter(node.x + node.width / 2, node.y + node.height / 2, {
          zoom: 1.15,
          duration: 250,
        });
    },
    [graph, rf],
  );
  async function saveNode() {
    if (!current || !runId) return;
    const original = current;
    onUpdated?.({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === current.id ? { ...n, label, summary } : n,
      ),
    });
    setSaving(true);
    try {
      const result = await mutation<{ graph: LaidOutGraph }>(
        `/runs/${runId}/graph`,
        "PATCH",
        { nodes: [{ id: current.id, label, summary }] },
      );
      onUpdated?.(result.graph);
      toast("Node updated. Re-render to update the video.");
    } catch (e) {
      onUpdated?.({
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === original.id ? original : n)),
      });
      toast(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function saveStyle(value: "clean" | "sketch") {
    const previous = style;
    setStyle(value);
    if (!runId || readOnly) return;
    try {
      const result = await mutation<{ graph: LaidOutGraph }>(
        `/runs/${runId}/graph`,
        "PATCH",
        { nodes: [], style: value },
      );
      onUpdated?.(result.graph, value);
      toast("Drawing style saved");
    } catch (e) {
      setStyle(previous);
      toast(errorText(e));
    }
  }
  const kinds = useMemo(
    () => [...new Set(graph.nodes.map((n) => n.kind))],
    [graph],
  );
  return (
    <div className="diagram-workspace">
      <div className="diagram-toolbar">
        <Segmented
          label="Diagram detail level"
          value={level}
          onChange={setLevel}
          options={[
            { value: 0, label: "Overview" },
            { value: 1, label: "Modules" },
            { value: 2, label: "Detail" },
          ]}
        />
        <div className="diagram-tools-right">
          <div className="search-input compact">
            <Search size={15} />
            <input
              ref={input}
              aria-label="Search diagram"
              value={search}
              onChange={(e) => focusSearch(e.target.value)}
              placeholder="Find a module…"
            />
          </div>
          <IconButton
            label="Diagram filters"
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={17} />
          </IconButton>
        </div>
      </div>
      {filters && (
        <div className="diagram-filter-row">
          <Select
            aria-label="Filter by kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">All kinds</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
          <Segmented
            label="Drawing style"
            value={style}
            onChange={(value) => {
              void saveStyle(value);
            }}
            options={[
              { value: "clean", label: "Clean" },
              { value: "sketch", label: "Sketch" },
            ]}
          />
          {!readOnly && (
            <label className="check-row">
              <input
                type="checkbox"
                checked={editing}
                onChange={(e) => setEditing(e.target.checked)}
              />
              Edit layout
            </label>
          )}
        </div>
      )}
      <div className={`diagram-body ${selected ? "with-inspector" : ""}`}>
        <div className="flow-canvas">
          <ReactFlow<CanvasNode, CanvasEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable={editing}
            onNodesChange={(changes) =>
              setDraftPositions((prior) => {
                const next = { ...prior };
                for (const change of changes)
                  if (change.type === "position" && change.position)
                    next[change.id] = change.position;
                return next;
              })
            }
            onNodeClick={(_e, n) => setSelected(n.id)}
            onPaneClick={() => setSelected(undefined)}
            onNodeDragStop={(_e, node) => {
              if (!runId) return;
              void mutation<{ graph: LaidOutGraph }>(
                `/runs/${runId}/graph`,
                "PATCH",
                {
                  nodes: [],
                  layoutOverrides: {
                    ...graph.layoutOverrides,
                    [node.id]: node.position,
                  },
                },
              )
                .then((r) => {
                  onUpdated?.(r.graph);
                  toast("Layout saved");
                })
                .catch((e) => toast(errorText(e)))
                .finally(() => setDraftPositions({}));
            }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            panOnScroll
            nodesConnectable={false}
            deleteKeyCode={null}
          >
            <Background color="#E9E5DD" gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => colorFor((n.data as Data).node.kind).fill}
              maskColor="rgba(251,250,247,.7)"
            />
          </ReactFlow>
          <div className="diagram-legend">
            {kinds.slice(0, 6).map((k) => (
              <span key={k}>
                <i style={{ background: colorFor(k).stroke }} />
                {k}
              </span>
            ))}
          </div>
          {flow && (
            <div className="flow-playback">
              <IconButton
                label={playing ? "Pause flow" : "Play flow"}
                onClick={() => {
                  setPlaying(!playing);
                  setStep(0);
                }}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </IconButton>
              <Select
                aria-label="Choose flow"
                value={flowId}
                onChange={(e) => {
                  setFlowId(e.target.value);
                  setStep(0);
                }}
              >
                {graph.flows.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </Select>
              {playing && (
                <small>
                  {step + 1}/{flow.steps.length}
                </small>
              )}
            </div>
          )}
        </div>
        {current && (
          <aside className="inspector">
            <div className="inspector-heading">
              <span className="eyebrow">MODULE DETAILS</span>
              <IconButton
                label="Close inspector"
                onClick={() => setSelected(undefined)}
              >
                <X size={17} />
              </IconButton>
            </div>
            <Chip
              tone={
                current.kind === "api"
                  ? "mint"
                  : current.kind === "worker"
                    ? "lavender"
                    : "sky"
              }
            >
              {current.kind}
            </Chip>
            {readOnly ? (
              <>
                <h2>{current.label}</h2>
                <p>{current.summary}</p>
              </>
            ) : (
              <>
                <label className="sr-only" htmlFor="node-label">
                  Node label
                </label>
                <input
                  id="node-label"
                  className="inspector-title"
                  maxLength={28}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <label className="sr-only" htmlFor="node-summary">
                  Node summary
                </label>
                <textarea
                  id="node-summary"
                  maxLength={160}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
                {(label !== current.label || summary !== current.summary) && (
                  <Button
                    busy={saving}
                    onClick={() => {
                      void saveNode();
                    }}
                  >
                    <Check size={14} />
                    Save changes
                  </Button>
                )}
              </>
            )}
            {current.detail && <p>{current.detail}</p>}
            <h3>
              <FileCode size={15} />
              Source evidence <span>{current.evidence.length}</span>
            </h3>
            <div className="evidence-list">
              {current.evidence.map((e, i) => {
                const href = `https://github.com/${renderProps.repo.meta.owner}/${renderProps.repo.meta.repo}/blob/${renderProps.repo.meta.commitSha}/${e.path.split("/").map(encodeURIComponent).join("/")}${e.startLine ? `#L${e.startLine}${e.endLine ? "-L" + e.endLine : ""}` : ""}`;
                return (
                  <div key={i}>
                    <code>{e.path}</code>
                    {e.startLine && (
                      <small>
                        Lines {e.startLine}–{e.endLine ?? e.startLine}
                      </small>
                    )}
                    {renderProps.repo.meta.owner !== "sample" && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${e.path} on GitHub`}
                      >
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <h3>
              <Network size={15} />
              Connections
            </h3>
            <div className="connection-list">
              {graph.edges
                .filter((e) => e.from === current.id || e.to === current.id)
                .map((e) => {
                  const neighbor = graph.nodes.find(
                    (n) => n.id === (e.from === current.id ? e.to : e.from),
                  );
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelected(neighbor?.id)}
                    >
                      <span>
                        {e.from === current.id ? "→" : "←"} {neighbor?.label}
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  );
                })}
            </div>
            <h3>Technologies</h3>
            <div className="chips">
              {current.tech.length ? (
                current.tech.map((t) => <Chip key={t}>{t}</Chip>)
              ) : (
                <span className="quiet">No external technology detected.</span>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
