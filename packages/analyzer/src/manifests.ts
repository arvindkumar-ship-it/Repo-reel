import type { RepoModel, SourceFile } from "@reporeel/shared";
export function manifests(sources: SourceFile[]): RepoModel["manifests"] {
  const result: RepoModel["manifests"] = [];
  for (const { path, content } of sources) {
    const dependencies: RepoModel["manifests"][number]["dependencies"] = [];
    const scripts: Record<string, string> = {};
    let ecosystem = "";
    try {
      if (path.endsWith("package.json")) {
        ecosystem = "npm";
        const data = JSON.parse(content) as Record<string, unknown>;
        for (const section of [
          "dependencies",
          "devDependencies",
          "peerDependencies",
        ])
          for (const [name, version] of Object.entries(
            (data[section] ?? {}) as Record<string, string>,
          ))
            dependencies.push({
              name,
              version: String(version),
              dev: section !== "dependencies",
            });
        Object.assign(scripts, data.scripts ?? {});
      } else if (/(?:pyproject\.toml|requirements[^/]*\.txt)$/.test(path)) {
        ecosystem = "python";
        for (const m of content.matchAll(
          /(?:^|["'\s\[,])([a-zA-Z][\w-]+)(?:\[[^\]]+\])?\s*(?:==|>=|~=|=|\^|<)\s*["']?([\d][\w.*+-]*)/gm,
        ))
          dependencies.push({
            name: m[1]!.toLowerCase(),
            version: m[2],
            dev: false,
          });
      } else if (path.endsWith("go.mod")) {
        ecosystem = "go";
        for (const m of content.matchAll(/^\s*([\w.]+\/\S+)\s+(v\S+)/gm))
          dependencies.push({ name: m[1]!, version: m[2], dev: false });
      } else if (path.endsWith("Cargo.toml")) {
        ecosystem = "cargo";
        let active = false;
        for (const line of content.split("\n")) {
          if (line.trim().startsWith("["))
            active = /^\[(?:dev-)?dependencies\]/.test(line.trim());
          if (active) {
            const m = line.match(
              /^([\w-]+)\s*=\s*(?:"([^"]+)"|\{\s*version\s*=\s*"([^"]+)")/,
            );
            if (m)
              dependencies.push({
                name: m[1]!,
                version: m[2] ?? m[3],
                dev: false,
              });
          }
        }
      } else if (path.endsWith("pom.xml")) {
        ecosystem = "maven";
        for (const m of content.matchAll(
          /<dependency>([\s\S]*?)<\/dependency>/g,
        )) {
          const name = m[1]!.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1],
            version = m[1]!.match(/<version>([^<]+)<\/version>/)?.[1];
          if (name) dependencies.push({ name, version, dev: false });
        }
      }
      if (ecosystem) result.push({ path, ecosystem, dependencies, scripts });
    } catch {
      /* Keep analyzing after malformed manifests. */
    }
  }
  return result;
}
