import type { LaidOutGraph } from "@reporeel/shared";
import { toSvg, svgToPng, toExcalidraw, toMermaid } from "@reporeel/diagram";
import { saveArtifact } from "./artifacts";

export async function exportDiagram(
  runId: string,
  graph: LaidOutGraph,
  style: "clean" | "sketch",
) {
  const svg = toSvg(graph, style);
  await saveArtifact(runId, "svg", "diagram.svg", svg, "image/svg+xml");
  await saveArtifact(runId, "png", "diagram.png", svgToPng(svg), "image/png");
  await saveArtifact(
    runId,
    "mermaid",
    "diagram.mmd",
    toMermaid(graph),
    "text/plain",
  );
  await saveArtifact(
    runId,
    "excalidraw",
    "diagram.excalidraw",
    JSON.stringify(toExcalidraw(graph, style), null, 2),
  );
}
