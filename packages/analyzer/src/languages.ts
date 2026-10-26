import { extname } from "node:path";
export const languageFor = (path: string) =>
  ({
    ".ts": "TypeScript",
    ".tsx": "TSX",
    ".mts": "TypeScript",
    ".cts": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".java": "Java",
    ".rs": "Rust",
    ".json": "JSON",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".sql": "SQL",
    ".prisma": "Prisma",
    ".md": "Markdown",
    ".toml": "TOML",
    ".tf": "Terraform",
  })[extname(path).toLowerCase()] ??
  (/(?:^|\/)Dockerfile(?:\.[^/]+)?$/.test(path) ? "Dockerfile" : "Text");
export const grammarFor: Record<string, string> = {
  TypeScript: "typescript",
  TSX: "tsx",
  JavaScript: "javascript",
  Python: "python",
  Go: "go",
  Java: "java",
  Rust: "rust",
};
