import type { RepoModel, SourceFile } from "@reporeel/shared";
export function entities(sources: SourceFile[]): RepoModel["data"] {
  const result: RepoModel["data"]["entities"] = [];
  for (const { path, content } of sources) {
    for (const m of content.matchAll(/\bmodel\s+(\w+)\s*\{([^}]+)\}/g))
      result.push({
        name: m[1]!,
        source: path,
        fields: m[2]!
          .split("\n")
          .map((l) => l.trim().split(/\s+/)[0] ?? "")
          .filter((x) => !!x && !x.startsWith("//") && !x.startsWith("@@")),
      });
    for (const m of content.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([\w.]+)["`]?\s*\(([^;]+)\)/gi,
    ))
      result.push({
        name: m[1]!,
        source: path,
        fields: m[2]!
          .split(",")
          .map((s) => s.trim().split(/\s+/)[0] ?? "")
          .filter(Boolean),
      });
    for (const m of content.matchAll(
      /(?:pgTable|mysqlTable|sqliteTable|new\s+(?:mongoose\.)?Schema)\s*\(\s*["'](\w+)["']/g,
    ))
      result.push({ name: m[1]!, source: path, fields: [] });
  }
  return { entities: result };
}
