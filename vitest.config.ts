import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const oxc = {
  jsx: {
    importSource: "react",
    runtime: "automatic" as const,
  },
};

export default defineConfig({
  oxc,
  test: {
    projects: [
      {
        oxc,
        resolve: {
          alias: {
            "@": path.resolve(rootDir, "src"),
          },
        },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "evals/**/*.test.ts"],
        },
      },
      {
        oxc,
        resolve: {
          alias: {
            "@": path.resolve(rootDir, "src"),
          },
        },
        test: {
          name: "components",
          environment: "jsdom",
          include: [
            "src/app/**/*.test.tsx",
            "src/components/**/*.test.tsx",
            "src/hooks/**/*.test.tsx",
          ],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
});
