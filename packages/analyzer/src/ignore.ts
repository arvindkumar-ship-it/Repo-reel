export const IGNORED = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "vendor",
  "target",
  "__pycache__",
  "coverage",
  ".venv",
  "venv",
  ".data",
  ".turbo",
  "qa-output",
  "test-results",
  "playwright-report",
]);
export const skipPath = (path: string) =>
  path.split("/").some((p) => IGNORED.has(p)) ||
  /\.(?:png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|mp[34]|zip|gz|lock|exe|dll|wasm)$/.test(
    path,
  ) ||
  /\.min\.[jc]s$/i.test(path) ||
  /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock)$/.test(
    path,
  );
export const isSensitive = (path: string) =>
  /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|credentials|\.npmrc)$/.test(path) &&
  !path.endsWith(".example");
