import { colorFor, type LaidOutGraph } from "@reporeel/shared";
export function MiniDiagram({ graph }: { graph: LaidOutGraph }) {
  return (
    <svg
      viewBox={`0 0 ${graph.bounds.width} ${graph.bounds.height}`}
      role="img"
      aria-label="Repository architecture overview"
      className="mini-diagram"
    >
      <title>Repository architecture overview</title>
      {graph.edges.map((e) => (
        <path
          key={e.id}
          d={e.points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#B9B3A7"
          strokeWidth={2}
        />
      ))}
      {graph.nodes.map((n) => {
        const c = colorFor(n.kind);
        return (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={n.width}
              height={n.height}
              rx={8}
              fill={c.fill}
              stroke={c.stroke}
            />
            <text
              x={n.x + 16}
              y={n.y + 31}
              fontSize={16}
              fontWeight={600}
              fill="#22222A"
            >
              {n.label}
            </text>
            <text x={n.x + 16} y={n.y + 53} fontSize={12} fill={c.ink}>
              {n.kind}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
