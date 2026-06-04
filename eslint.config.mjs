import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import importPlugin from "eslint-plugin-import";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const externalSdks = [
  "@anthropic-ai/sdk",
  "@supabase/*",
  "@polar-sh/*",
];

const serviceImports = [
  "@/services",
  "@/services/*",
  "src/services",
  "src/services/*",
  "../services",
  "../services/*",
  "../../services",
  "../../services/*",
  "../../../services",
  "../../../services/*",
];

const libImports = [
  "@/lib",
  "@/lib/*",
  "src/lib",
  "src/lib/*",
  "../lib",
  "../lib/*",
  "../../lib",
  "../../lib/*",
  "../../../lib",
  "../../../lib/*",
];

const appImports = [
  "@/app",
  "@/app/*",
  "src/app",
  "src/app/*",
  "../app",
  "../app/*",
  "../../app",
  "../../app/*",
  "../../../app",
  "../../../app/*",
];

const eslintConfig = [
  {
    ignores: [
      ".claude/**",
      ".codex/**",
      ".next/**",
      "node_modules/**",
      "out/**",
      "next-env.d.ts",
      "postcss.config.mjs",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      import: importPlugin,
    },
    settings: {
      next: {
        root: ["."],
      },
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      },
    },
    rules: {
      "import/no-cycle": ["error", { ignoreExternal: true }],
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...serviceImports,
            ...externalSdks,
          ],
        },
      ],
    },
  },
  {
    files: ["src/types/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...appImports,
            ...libImports,
            ...serviceImports,
            ...externalSdks,
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration:not([importKind='type'])",
          message: "src/types may only use top-level import type declarations.",
        },
      ],
    },
  },
  {
    files: ["src/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...appImports,
            ...libImports,
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
