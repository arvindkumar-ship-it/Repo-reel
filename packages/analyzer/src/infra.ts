import { parse } from "yaml";
import type { RepoModel, SourceFile } from "@reporeel/shared";
export function infrastructure(sources: SourceFile[]): RepoModel["infra"] {
  const result: RepoModel["infra"] = { services: [], ci: [], dockerfiles: [] };
  for (const { path, content } of sources) {
    try {
      if (/(?:^|\/)(?:docker-)?compose\.ya?ml$/.test(path)) {
        const data = parse(content, { maxAliasCount: 50 }) as {
          services?: Record<string, { image?: string; ports?: unknown[] }>;
        };
        for (const [name, value] of Object.entries(data?.services ?? {}))
          result.services.push({
            name,
            image: value.image,
            ports: (value.ports ?? []).map((p) =>
              typeof p === "object" ? JSON.stringify(p) : String(p),
            ),
            source: path,
          });
      }
      if (path.includes(".github/workflows/") && /\.ya?ml$/.test(path)) {
        const data = parse(content, { maxAliasCount: 50 }) as {
          jobs?: Record<string, unknown>;
        };
        result.ci.push({ path, jobs: Object.keys(data?.jobs ?? {}) });
      }
      if (/(?:^|\/)Dockerfile(?:\.[^/]+)?$/.test(path))
        result.dockerfiles.push(path);
      if (/\.tf$/.test(path))
        for (const m of content.matchAll(/resource\s+"([^"]+)"\s+"([^"]+)"/g))
          result.services.push({
            name: m[2]!,
            image: m[1]!,
            ports: [],
            source: path,
          });
      if (
        /\.ya?ml$/.test(path) &&
        /kind:\s*(Deployment|Service|StatefulSet)/.test(content)
      ) {
        const data = parse(content, { maxAliasCount: 50 }) as {
          kind?: string;
          metadata?: { name?: string };
          spec?: { ports?: { port: number }[] };
        };
        if (data?.metadata?.name)
          result.services.push({
            name: data.metadata.name,
            image: data.kind,
            ports: (data.spec?.ports ?? []).map((p) => String(p.port)),
            source: path,
          });
      }
    } catch {
      /* Invalid infra config is recorded as source, never executed. */
    }
  }
  return result;
}
