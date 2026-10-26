import type { RepoModel } from "@reporeel/shared";
export function digest(repo: RepoModel, maxChars = 84000) {
  const data = {
    meta: {
      ...repo.meta,
      description: repo.meta.description?.slice(0, 1500) ?? null,
    },
    stats: repo.stats,
    readme: repo.readmeExcerpt.slice(0, 1500),
    tech: repo.tech,
    manifests: repo.manifests.map((m) => ({
      ...m,
      dependencies: m.dependencies.slice(0, 30),
    })),
    infra: repo.infra,
    data: repo.data,
    entrypoints: repo.entrypoints,
    clusters: repo.clusters.map((c) => ({
      ...c,
      files: c.files.slice(0, 12),
      topFiles: repo.files
        .filter((f) => c.files.includes(f.path))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 5)
        .map((f) => ({
          path: f.path,
          loc: f.loc,
          exports: f.symbols.filter((s) => s.exported).slice(0, 15),
          routes: f.routes.slice(0, 16),
          requests: f.requests?.slice(0, 16) ?? [],
          imports: f.imports.slice(0, 64),
        })),
    })),
  };
  let value = JSON.stringify(data);
  if (value.length <= maxChars) return value;
  data.clusters = data.clusters.slice(0, 80);
  for (const c of data.clusters) {
    c.files = c.files.slice(0, 4);
    c.topFiles = c.topFiles.slice(0, 2);
  }
  value = JSON.stringify(data);
  if (value.length <= maxChars) return value;
  const compact = {
    meta: data.meta,
    stats: repo.stats,
    tech: repo.tech.slice(0, 40),
    entrypoints: repo.entrypoints.slice(0, 20),
    clusters: data.clusters.slice(0, 20),
    note: "Digest bounded; remaining files omitted.",
  };
  value = JSON.stringify(compact);
  while (value.length > maxChars && compact.clusters.length) {
    compact.clusters.pop();
    value = JSON.stringify(compact);
  }
  return value.length <= maxChars
    ? value
    : JSON.stringify({ note: "Digest exceeds the requested budget." });
}
