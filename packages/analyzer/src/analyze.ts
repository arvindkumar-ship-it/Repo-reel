import {
  RepoModelSchema,
  type RepoModel,
  type SourceFile,
} from "@reporeel/shared";
import { languageFor } from "./languages";
import { extractFallback } from "./parse/fallback";
import { enrichWithTreeSitter } from "./parse/treeSitter";
import { resolveImports } from "./parse/resolve";
import { manifests } from "./manifests";
import { infrastructure } from "./infra";
import { entities } from "./data";
import { buildFileGraph } from "./graph";
import { TECH } from "./knowledge/techmap";
import { skipPath, isSensitive } from "./ignore";
export async function analyze(
  sources: SourceFile[],
  meta: RepoModel["meta"],
  signal?: AbortSignal,
): Promise<RepoModel> {
  const accepted = sources.filter(
    (f) =>
      !skipPath(f.path) &&
      !isSensitive(f.path) &&
      Buffer.byteLength(f.content) <= 1048576 &&
      !f.content.includes("\0"),
  );
  const warnings: string[] = [],
    files = [];
  for (const source of accepted) {
    signal?.throwIfAborted();
    if (files.length % 25 === 0)
      await new Promise<void>((done) => setImmediate(done));
    const file = extractFallback(
      source.path,
      source.content,
      languageFor(source.path),
    );
    try {
      await enrichWithTreeSitter(file, source.content);
    } catch {
      if (!warnings.some((w) => w.includes(file.language)))
        warnings.push(
          `Tree-sitter unavailable for ${file.language}; conservative heuristic extraction used.`,
        );
    }
    files.push(file);
  }
  resolveImports(files, accepted);
  const clusters = buildFileGraph(files),
    manifestList = manifests(accepted),
    infra = infrastructure(accepted),
    tech: RepoModel["tech"] = [];
  const add = (name: string, path: string) => {
    const item =
      TECH[name] ??
      Object.entries(TECH).find(
        ([key]) => name.startsWith(key + "/") || name.startsWith(key + "-"),
      )?.[1];
    if (item && !tech.some((t) => t.name === name))
      tech.push({ name, ...item, evidence: path });
  };
  for (const m of manifestList)
    for (const dep of m.dependencies) add(dep.name, m.path);
  for (const file of files)
    for (const name of file.externalImports) add(name, file.path);
  for (const svc of infra.services) {
    const image = svc.image?.split(":")[0]?.split("/").at(-1);
    if (image) add(image, svc.source);
  }
  const locByLanguage = new Map<string, number>();
  for (const f of files)
    locByLanguage.set(f.language, (locByLanguage.get(f.language) ?? 0) + f.loc);
  const totalLoc = files.reduce((n, f) => n + f.loc, 0);
  const entrypoints = files
    .filter((f) =>
      /(?:^|\/)(?:server|main|index)\.(?:[cm]?[jt]sx?|py|go|rs)$|(?:^|\/)app\/(?:layout|page)\.[jt]sx$|(?:^|\/)cmd\/.*main\.go$/.test(
        f.path,
      ),
    )
    .map((f) => ({
      path: f.path,
      reason: f.routes.length
        ? "HTTP entry point"
        : "Conventional source entry point",
    }));
  return RepoModelSchema.parse({
    meta,
    stats: {
      fileCount: sources.length,
      analyzedFileCount: files.length,
      totalLoc,
      languages: [...locByLanguage]
        .map(([name, loc]) => ({
          name,
          loc,
          pct: totalLoc ? (loc / totalLoc) * 100 : 0,
        }))
        .sort((a, b) => b.loc - a.loc),
    },
    files,
    manifests: manifestList,
    infra,
    data: entities(accepted),
    tech,
    entrypoints,
    clusters,
    readmeExcerpt:
      accepted
        .find((s) => /(^|\/)readme\.md$/i.test(s.path))
        ?.content.slice(0, 1500) ?? "",
    warnings,
  });
}
