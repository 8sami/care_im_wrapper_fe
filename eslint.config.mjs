import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import i18nextPlugin from "eslint-plugin-i18next";
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";
import path from "path";
import { fileURLToPath } from "url";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default [
  // Base configuration
  {
    ignores: [
      "**/dist",
      "**/public",
      "**/lib",
      "**/build",
      "**/*.css",
      "**/*.csv",
      "**/Dockerfile",
      "tailwind.config.js",
    ],
  },
  eslint.configs.recommended,

  // Global settings for all JavaScript/TypeScript files
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,mts}"],
    languageOptions: {
      ecmaVersion: 12,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        React: true,
      },
      parser: tsParser,
      parserOptions: {
        project: [
          "./tsconfig.app.json",
          "./tsconfig.node.json",
          // Playwright specs and config; typed by tests/tsconfig.json.
          "./tests/tsconfig.json",
        ],
        tsconfigRootDir,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },

  // TypeScript-specific rules
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: [
          "./tsconfig.app.json",
          "./tsconfig.node.json",
          // Playwright specs and config; typed by tests/tsconfig.json.
          "./tests/tsconfig.json",
        ],
        tsconfigRootDir,
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-undef": "off",
    },
  },

  // React-specific rules
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/prop-types": "off",
      "react/no-children-prop": "off",
      "react/no-unescaped-entities": "off",

      // React Compiler rules added to react-hooks v7 `recommended`. Surfaced as
      // warnings so the existing code is not blocked; address incrementally.
      // Mirrors care_fe's eslint.config.mjs.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // No Relative import paths rule
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "no-relative-import-paths": noRelativeImportPaths,
    },
    rules: {
      "no-relative-import-paths/no-relative-import-paths": [
        "error",
        {
          allowSameFolder: true,
          prefix: "@",
        },
      ],
    },
  },

  // i18next plugin rules
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      i18next: i18nextPlugin,
    },
    rules: {
      ...i18nextPlugin.configs.recommended.rules,
      "i18next/no-literal-string": [
        "warn",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: ["label", "placeholder", "error", "title"],
            exclude: [".*"],
          },
          callees: {
            exclude: [".*"],
          },
        },
      ],
    },
  },

  // Add prettier recommended config last
  eslintPluginPrettierRecommended,
];
