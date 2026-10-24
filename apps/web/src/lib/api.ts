import type { Run, RenderProps, Project, Artifact } from "@reporeel/shared";
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint?: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api/v1" + path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = (await res.json()) as T & {
    error?: { code: string; message: string; hint?: string };
  };
  if (!res.ok)
    throw new ApiError(
      data.error?.code ?? "REQUEST_FAILED",
      data.error?.message ?? "Request failed.",
      data.error?.hint,
    );
  return data;
}
export const mutation = <T>(path: string, method: string, body?: unknown) =>
  api<T>(path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
export type User = {
  id: string;
  name: string;
  avatarUrl?: string;
  plan: string;
  githubConnected: boolean;
  usage: { runs: number; renderSeconds: number };
};
export type ProjectRow = Project & { latestRun?: Run };
export type RunData = Run & {
  renderProps?: RenderProps;
  share?: { slug: string; isPublic: boolean };
};
export type Download = Artifact & { url: string };
export function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export function bytes(n: number) {
  return n < 1024
    ? n + " B"
    : n < 1048576
      ? (n / 1024).toFixed(1) + " KB"
      : (n / 1048576).toFixed(1) + " MB";
}
export function relativeTime(iso: string) {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  return elapsed < 60000
    ? "Just now"
    : elapsed < 3600000
      ? Math.floor(elapsed / 60000) + " min ago"
      : elapsed < 86400000
        ? Math.floor(elapsed / 3600000) + " hours ago"
        : new Intl.DateTimeFormat("en", {
            month: "short",
            day: "numeric",
          }).format(new Date(iso));
}
