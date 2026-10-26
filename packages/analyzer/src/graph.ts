import Graph from "graphology";
import pagerank from "graphology-metrics/centrality/pagerank.js";
import louvain from "graphology-communities-louvain";
import { posix } from "node:path";
import type { RepoFile, RepoModel } from "@reporeel/shared";
export function buildFileGraph(files: RepoFile[]): RepoModel["clusters"] {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const directed = new Graph({ type: "directed" }),
    undirected = new Graph({ type: "undirected" });
  for (const file of files) {
    directed.addNode(file.path);
    undirected.addNode(file.path);
  }
  for (const f of files)
    for (const target of f.imports)
      if (directed.hasNode(target) && target !== f.path) {
        if (!directed.hasEdge(f.path, target)) directed.addEdge(f.path, target);
        if (!undirected.hasEdge(f.path, target))
          undirected.addEdge(f.path, target, {
            weight: posix.dirname(f.path) === posix.dirname(target) ? 3 : 1,
          });
      }
  if (files.length) {
    const rank = pagerank(directed, {
      alpha: 0.85,
      getEdgeWeight: null,
      maxIterations: 200,
      tolerance: 1e-6,
    });
    for (const file of files) file.rank = rank[file.path] ?? 0;
  }
  const communities = undirected.size
    ? louvain(undirected, {
        randomWalk: false,
        fastLocalMoves: false,
        resolution: 1,
        getEdgeWeight: "weight",
      })
    : {};
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const dir = posix.dirname(file.path),
      prefix =
        dir === "."
          ? "."
          : dir
              .split("/")
              .slice(
                0,
                dir.startsWith("apps/") || dir.startsWith("packages/") ? 3 : 2,
              )
              .join("/");
    const key =
      communities[file.path] !== undefined
        ? `${prefix}:${communities[file.path]}`
        : prefix;
    const group = groups.get(key) ?? [];
    group.push(file.path);
    groups.set(key, group);
  }
  // Merge tiny communities within the same responsibility directory only. Never fabricate dependency edges.
  const byDirectory = new Map<string, [string, string[]][]>();
  for (const entry of groups) {
    const prefix = entry[0].split(":")[0]!,
      list = byDirectory.get(prefix) ?? [];
    list.push(entry);
    byDirectory.set(prefix, list);
  }
  for (const communities of byDirectory.values()) {
    communities.sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
    const largest = communities[0]!;
    for (const [key, paths] of communities.slice(1))
      if (paths.length < 3) {
        largest[1].push(...paths);
        groups.delete(key);
      }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, paths], i) => ({
      id: `cluster-${i}`,
      files: paths.sort(),
      dirHint: key.split(":")[0]!,
      cohesion:
        paths.length <= 1
          ? 1
          : paths.reduce(
              (n, p) =>
                n +
                byPath.get(p)!.imports.filter((t) => paths.includes(t)).length,
              0,
            ) /
            Math.max(
              1,
              paths.reduce((n, p) => n + byPath.get(p)!.imports.length, 0),
            ),
    }));
}
